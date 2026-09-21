import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { AppError, ah, badRequest, notFound, parse, param } from '../errors.js';
import { requireRole } from '../middleware/auth.js';
import { recomputeAlerts } from '../services/riskService.js';
import { DIMENSIONS } from '../services/scoring.js';

export const surveysRouter = Router();

const questionSchema = z.object({
  dimension: z.enum(DIMENSIONS),
  text: z.string().trim().min(5, 'escribe la pregunta completa').max(300),
  type: z.enum(['LIKERT_5', 'ABIERTA']).default('LIKERT_5'),
  relation: z.enum(['SUPERVISOR', 'PAR', 'AUTO']).nullish(),
});

const createSchema = z.object({
  title: z.string().trim().min(3, 'escribe un título de al menos 3 caracteres').max(120),
  type: z.enum(['CLIMA', 'EVAL_360']),
  opensAt: z.coerce.date().nullish(),
  closesAt: z.coerce.date().nullish(),
  minGroupSize: z.number().int().min(3, 'el umbral k debe ser 3 o más').max(50).default(5),
  questions: z.array(questionSchema).min(1, 'agrega al menos una pregunta'),
}).refine((d) => !d.opensAt || !d.closesAt || d.closesAt > d.opensAt, {
  message: 'la fecha de cierre debe ser posterior a la de apertura', path: ['closesAt'],
});

// Lista: RH ve todas y con avance; los demás solo activas y cerradas, sin conteos.
surveysRouter.get('/', ah(async (req, res) => {
  const isRh = req.user!.role === 'RH';
  const surveys = await prisma.survey.findMany({
    where: isRh ? {} : { status: { in: ['ACTIVA', 'CERRADA'] } },
    orderBy: [{ closesAt: { sort: 'desc', nulls: 'last' } }, { title: 'asc' }],
    include: { _count: { select: { questions: true, invitations: true } } },
  });
  const used = isRh
    ? await prisma.invitation.groupBy({ by: ['surveyId'], where: { usedAt: { not: null } }, _count: { _all: true } })
    : [];
  const usedMap = new Map(used.map((u) => [u.surveyId, u._count._all]));
  res.json({
    surveys: surveys.map((s) => ({
      id: s.id, title: s.title, type: s.type, status: s.status, opensAt: s.opensAt, closesAt: s.closesAt,
      minGroupSize: s.minGroupSize, questionCount: s._count.questions,
      ...(isRh ? { invitationCount: s._count.invitations, completedCount: usedMap.get(s.id) ?? 0 } : {}),
    })),
  });
}));

surveysRouter.post('/', requireRole('RH'), ah(async (req, res) => {
  const body = parse(createSchema, req.body);
  const survey = await prisma.survey.create({
    data: {
      title: body.title, type: body.type, opensAt: body.opensAt ?? null, closesAt: body.closesAt ?? null,
      minGroupSize: body.minGroupSize,
      questions: { create: body.questions.map((q, i) => ({ ...q, relation: q.relation ?? null, order: i + 1 })) },
    },
  });
  res.status(201).json({ survey });
}));

const statusSchema = z.object({ status: z.enum(['ACTIVA', 'CERRADA']) });

surveysRouter.patch('/:id/status', requireRole('RH'), ah(async (req, res) => {
  const { status } = parse(statusSchema, req.body);
  const survey = await prisma.survey.findUnique({ where: { id: param(req, 'id') }, include: { _count: { select: { questions: true, invitations: true } } } });
  if (!survey) throw notFound('No encontramos esa encuesta. Actualiza la lista e inténtalo de nuevo.');
  const allowed = (survey.status === 'BORRADOR' && status === 'ACTIVA') || (survey.status === 'ACTIVA' && status === 'CERRADA');
  if (!allowed) {
    throw new AppError(409, 'TRANSICION_INVALIDA',
      survey.status === 'CERRADA' ? 'La encuesta ya está cerrada y no se puede reabrir. Crea una nueva.' :
      survey.status === status ? `La encuesta ya está ${status === 'ACTIVA' ? 'activa' : 'cerrada'}.` :
      'Primero activa la encuesta; solo una encuesta activa se puede cerrar.');
  }
  if (status === 'ACTIVA' && survey._count.questions === 0) throw badRequest('La encuesta no tiene preguntas. Agrega al menos una antes de activarla.');
  const updated = await prisma.survey.update({
    where: { id: survey.id },
    data: { status, ...(status === 'CERRADA' && !survey.closesAt ? { closesAt: new Date() } : {}) },
  });
  // Al cerrar una encuesta de clima se calcula el riesgo y se crean las alertas.
  const risk = status === 'CERRADA' && survey.type === 'CLIMA' ? await recomputeAlerts(survey.id) : null;
  res.json({ survey: updated, alertsCreated: risk ? risk.filter((r) => r.result.level === 'ALTO' || r.result.level === 'CRITICO').length : 0 });
}));

// Genera invitaciones. CLIMA: una por usuario activo. EVAL_360: por cada líder,
// autoevaluación, equipo (su área) y pares (otros líderes).
surveysRouter.post('/:id/invitations', requireRole('RH'), ah(async (req, res) => {
  const survey = await prisma.survey.findUnique({ where: { id: param(req, 'id') } });
  if (!survey) throw notFound('No encontramos esa encuesta. Actualiza la lista e inténtalo de nuevo.');
  if (survey.status === 'CERRADA') throw new AppError(409, 'ENCUESTA_CERRADA', 'La encuesta está cerrada. Crea una nueva para generar invitaciones.');
  const users = await prisma.user.findMany({ where: { active: true } });
  const data: { surveyId: string; userId: string; evaluatedUserId?: string; relation?: 'SUPERVISOR' | 'PAR' | 'AUTO' }[] = [];
  if (survey.type === 'CLIMA') {
    for (const u of users) data.push({ surveyId: survey.id, userId: u.id });
  } else {
    const leaders = users.filter((u) => u.role === 'LIDER');
    for (const l of leaders) {
      data.push({ surveyId: survey.id, userId: l.id, evaluatedUserId: l.id, relation: 'AUTO' });
      for (const u of users) {
        if (u.id === l.id || u.role === 'RH') continue;
        if (u.areaId === l.areaId) data.push({ surveyId: survey.id, userId: u.id, evaluatedUserId: l.id, relation: 'SUPERVISOR' });
      }
      for (const p of leaders) if (p.id !== l.id) data.push({ surveyId: survey.id, userId: p.id, evaluatedUserId: l.id, relation: 'PAR' });
    }
  }
  const result = await prisma.invitation.createMany({ data, skipDuplicates: true });
  res.status(201).json({ created: result.count, skipped: data.length - result.count });
}));
