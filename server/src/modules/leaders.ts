import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { AppError, ah, forbidden, notFound, parse, param } from '../errors.js';
import { requireRole } from '../middleware/auth.js';
import { INSUFFICIENT_MESSAGE, meetsK } from '../services/anonymity.js';
import { DIMENSIONS, DIMENSION_LABELS, mean, round1, type Dim } from '../services/scoring.js';
import { getSurvey, latestClosedSurvey } from '../services/surveyData.js';

export const leadersRouter = Router();

leadersRouter.get('/', requireRole('RH'), ah(async (_req, res) => {
  const leaders = await prisma.user.findMany({ where: { role: 'LIDER', active: true }, include: { area: true }, orderBy: { name: 'asc' } });
  res.json({ leaders: leaders.map((l) => ({ id: l.id, name: l.name, areaName: l.area.name })) });
}));

const q = z.object({ surveyId: z.string().min(1).optional() });
type Rel = 'AUTO' | 'SUPERVISOR' | 'PAR';

leadersRouter.get('/:id/report360', requireRole('RH', 'LIDER'), ah(async (req, res) => {
  const { surveyId } = parse(q, req.query);
  const user = req.user!;
  // Un líder solo ve su propio reporte.
  if (user.role === 'LIDER' && user.id !== param(req, 'id')) throw forbidden('Solo puedes ver tu propio reporte 360.');
  const leader = await prisma.user.findUnique({ where: { id: param(req, 'id') }, include: { area: true } });
  if (!leader || leader.role !== 'LIDER') throw notFound('No encontramos a ese líder. Vuelve a la lista y elige otro.');

  const survey = surveyId ? await getSurvey(surveyId) : await latestClosedSurvey('EVAL_360');
  if (!survey) throw notFound('Aún no hay evaluaciones 360 cerradas. Cierra una para ver el reporte.');
  if (survey.type !== 'EVAL_360') throw new AppError(400, 'TIPO_INVALIDO', 'Esta pantalla usa evaluaciones 360. Elige una evaluación de tipo 360.');
  if (user.role !== 'RH' && survey.status !== 'CERRADA') {
    throw new AppError(403, 'RESULTADOS_NO_PUBLICADOS', 'El reporte se publica cuando RH cierra la evaluación.');
  }

  const surveyDims = new Set((await prisma.question.findMany({ where: { surveyId: survey.id, type: 'LIKERT_5' }, select: { dimension: true } })).map((x) => x.dimension as Dim));
  const answers = await prisma.answer.findMany({
    where: { response: { surveyId: survey.id, evaluatedUserId: leader.id }, value: { not: null }, question: { type: 'LIKERT_5' } },
    select: { value: true, question: { select: { dimension: true } }, response: { select: { id: true, relation: true } } },
  });
  const byRel: Record<Rel, { ids: Set<string>; vals: Map<Dim, number[]> }> = {
    AUTO: { ids: new Set(), vals: new Map() }, SUPERVISOR: { ids: new Set(), vals: new Map() }, PAR: { ids: new Set(), vals: new Map() },
  };
  for (const a of answers) {
    const rel = a.response.relation as Rel | null;
    if (!rel) continue;
    const g = byRel[rel];
    g.ids.add(a.response.id);
    const d = a.question.dimension as Dim;
    g.vals.set(d, [...(g.vals.get(d) ?? []), a.value as number]);
  }
  // AUTO es la propia persona evaluada: no requiere umbral. Equipo y pares sí.
  const visible = (rel: Rel) => rel === 'AUTO' ? byRel.AUTO.ids.size > 0 : meetsK(byRel[rel].ids.size, survey.minGroupSize);

  const avg = (rel: Rel, d: Dim): number | null => {
    if (!visible(rel)) return null;
    const m = mean(byRel[rel].vals.get(d) ?? []);
    return m === null ? null : Math.round(m * 100) / 100;
  };
  const gap = (a: number | null, b: number | null) => (a === null || b === null ? null : Math.round((a - b) * 100) / 100);

  res.json({
    leader: { id: leader.id, name: leader.name, areaName: leader.area.name },
    survey: { id: survey.id, title: survey.title, minGroupSize: survey.minGroupSize },
    scale: { min: 1, max: 5 },
    groups: (['AUTO', 'SUPERVISOR', 'PAR'] as Rel[]).map((rel) => ({
      relation: rel,
      label: rel === 'AUTO' ? 'Autoevaluación' : rel === 'SUPERVISOR' ? 'Equipo' : 'Pares',
      ...(visible(rel)
        ? { suppressed: false, responses: byRel[rel].ids.size }
        : byRel[rel].ids.size === 0 ? { suppressed: true, message: 'Sin respuestas todavía' } : { suppressed: true, message: INSUFFICIENT_MESSAGE }),
    })),
    dimensions: DIMENSIONS.filter((d) => surveyDims.has(d)).map((d) => {
      const auto = avg('AUTO', d), team = avg('SUPERVISOR', d), peers = avg('PAR', d);
      return { dimension: d, label: DIMENSION_LABELS[d], auto, team, peers, gapTeam: gap(auto, team), gapPeers: gap(auto, peers) };
    }),
  });
}));
