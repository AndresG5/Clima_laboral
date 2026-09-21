import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { AppError, ah, badRequest, notFound, parse, param } from '../errors.js';
import { dateOnly, tenureBandFor } from '../services/anonymity.js';
import { DIMENSIONS, DIMENSION_LABELS } from '../services/scoring.js';

// Rutas colgadas de /api: /me/invitations y /invitations/:id/...
export const responsesRouter = Router();

responsesRouter.get('/me/invitations', ah(async (req, res) => {
  const invitations = await prisma.invitation.findMany({
    where: { userId: req.user!.id, survey: { status: { in: ['ACTIVA', 'CERRADA'] } } },
    include: { survey: true },
  });
  const evaluatedIds = [...new Set(invitations.map((i) => i.evaluatedUserId).filter((x): x is string => !!x))];
  const evaluated = await prisma.user.findMany({ where: { id: { in: evaluatedIds } }, select: { id: true, name: true } });
  const names = new Map(evaluated.map((u) => [u.id, u.name]));
  const items = invitations
    // Una encuesta cerrada solo aparece si la persona la completó.
    .filter((i) => i.survey.status === 'ACTIVA' || i.usedAt)
    .map((i) => ({
      id: i.id,
      surveyTitle: i.survey.title,
      surveyType: i.survey.type,
      closesAt: i.survey.closesAt,
      relation: i.relation,
      evaluatedName: i.evaluatedUserId ? names.get(i.evaluatedUserId) ?? null : null,
      completed: !!i.usedAt, // solo el estado; nunca las respuestas
    }));
  res.json({ pending: items.filter((i) => !i.completed), completed: items.filter((i) => i.completed) });
}));

async function loadOwnInvitation(invitationId: string, userId: string) {
  const inv = await prisma.invitation.findUnique({ where: { id: invitationId }, include: { survey: { include: { questions: { orderBy: { order: 'asc' } } } } } });
  if (!inv || inv.userId !== userId) throw notFound('No encontramos esa encuesta entre tus pendientes. Vuelve a "Mis encuestas".');
  return inv;
}

function assertOpen(inv: { usedAt: Date | null; survey: { status: string; closesAt: Date | null; opensAt: Date | null } }) {
  if (inv.usedAt) throw new AppError(409, 'YA_RESPONDIDA', 'Ya respondiste esta encuesta. Solo se puede responder una vez.');
  if (inv.survey.status !== 'ACTIVA') throw new AppError(409, 'ENCUESTA_NO_ACTIVA', 'Esta encuesta ya no está recibiendo respuestas.');
  const now = new Date();
  if (inv.survey.opensAt && inv.survey.opensAt > now) throw new AppError(409, 'ENCUESTA_NO_ABIERTA', 'Esta encuesta todavía no abre. Vuelve cuando llegue la fecha de apertura.');
  if (inv.survey.closesAt && inv.survey.closesAt < now) throw new AppError(409, 'ENCUESTA_VENCIDA', 'El plazo de esta encuesta terminó. Pide a RH que la revise.');
}

const applicable = <Q extends { relation: string | null }>(qs: Q[], relation: string | null) =>
  qs.filter((q) => !relation || q.relation === null || q.relation === relation);

responsesRouter.get('/invitations/:id/form', ah(async (req, res) => {
  const inv = await loadOwnInvitation(param(req, 'id'), req.user!.id);
  assertOpen(inv);
  const questions = applicable(inv.survey.questions, inv.relation);
  const evaluated = inv.evaluatedUserId ? await prisma.user.findUnique({ where: { id: inv.evaluatedUserId }, select: { name: true } }) : null;
  res.json({
    invitation: { id: inv.id, surveyTitle: inv.survey.title, surveyType: inv.survey.type, relation: inv.relation, evaluatedName: evaluated?.name ?? null },
    dimensions: DIMENSIONS
      .map((d) => ({
        dimension: d, label: DIMENSION_LABELS[d],
        questions: questions.filter((q) => q.dimension === d).map((q) => ({ id: q.id, text: q.text, type: q.type })),
      }))
      .filter((d) => d.questions.length > 0),
  });
}));

const submitSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string().min(1),
    value: z.number().int().min(1, 'la escala va de 1 a 5').max(5, 'la escala va de 1 a 5').optional(),
    text: z.string().trim().max(1000, 'el comentario no puede pasar de 1000 caracteres').optional(),
  })).min(1, 'envía al menos una respuesta'),
});

responsesRouter.post('/invitations/:id/submit', ah(async (req, res) => {
  const body = parse(submitSchema, req.body);
  const user = req.user!;
  const inv = await loadOwnInvitation(param(req, 'id'), user.id);
  assertOpen(inv);

  const questions = applicable(inv.survey.questions, inv.relation);
  const byId = new Map(questions.map((q) => [q.id, q]));
  const seen = new Set<string>();
  for (const a of body.answers) {
    if (!byId.has(a.questionId)) throw badRequest('Hay una respuesta a una pregunta que no pertenece a esta encuesta. Recarga la página e inténtalo de nuevo.');
    if (seen.has(a.questionId)) throw badRequest('Una pregunta se respondió dos veces. Recarga la página e inténtalo de nuevo.');
    seen.add(a.questionId);
  }
  const missing = questions.filter((q) => q.type === 'LIKERT_5' && !body.answers.some((a) => a.questionId === q.id && a.value !== undefined));
  if (missing.length > 0) {
    throw badRequest(`Faltan ${missing.length} pregunta${missing.length === 1 ? '' : 's'} por responder. Contesta todas las de escala del 1 al 5; el comentario es opcional.`, 'RESPUESTAS_INCOMPLETAS');
  }

  const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { hireDate: true, areaId: true } });
  const answers = body.answers
    .map((a) => ({ q: byId.get(a.questionId)!, a }))
    .filter(({ q, a }) => (q.type === 'LIKERT_5' ? a.value !== undefined : !!a.text))
    .map(({ q, a }) => (q.type === 'LIKERT_5' ? { questionId: q.id, value: a.value } : { questionId: q.id, text: a.text }));

  // Una sola transacción: marca la invitación como usada e inserta la respuesta
  // SIN referencia al usuario ni a la invitación.
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.invitation.updateMany({
      where: { id: inv.id, userId: user.id, usedAt: null },
      data: { usedAt: dateOnly() }, // solo la fecha, sin hora
    });
    if (claimed.count !== 1) throw new AppError(409, 'YA_RESPONDIDA', 'Ya respondiste esta encuesta. Solo se puede responder una vez.');
    await tx.response.create({
      data: {
        surveyId: inv.surveyId,
        areaId: dbUser.areaId,
        tenureBand: tenureBandFor(dbUser.hireDate, new Date()),
        evaluatedUserId: inv.evaluatedUserId,
        relation: inv.relation,
        submittedOn: dateOnly(),
        answers: { create: answers },
      },
    });
  });
  res.status(201).json({ ok: true, message: 'Respuesta enviada. Tu respuesta es anónima: nadie puede ligarla contigo.' });
}));
