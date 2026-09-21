import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { AppError, ah, notFound, parse, param } from '../errors.js';
import { assertAreaAccess, requireRole, type AuthUser } from '../middleware/auth.js';
import { INSUFFICIENT_MESSAGE, TENURE_LABELS, guard, meetsK, suppressedKeys } from '../services/anonymity.js';
import { computeSurveyRisk } from '../services/riskService.js';
import { DIMENSIONS, DIMENSION_LABELS, round1, summarize } from '../services/scoring.js';
import {
  countResponses, getSurvey, groupBy, latestClosedSurvey, loadClimaRows, previousClimaSurvey,
} from '../services/surveyData.js';

export const analyticsRouter = Router();

const surveyQuery = z.object({ surveyId: z.string().min(1).optional() });

/** Resuelve la encuesta de clima a consultar. Los líderes solo ven encuestas cerradas. */
async function resolveSurvey(user: AuthUser, surveyId?: string) {
  const survey = surveyId ? await getSurvey(surveyId) : await latestClosedSurvey('CLIMA');
  if (!survey) throw notFound('Aún no hay encuestas de clima cerradas. Cierra una encuesta para ver resultados.');
  if (survey.type !== 'CLIMA') throw new AppError(400, 'TIPO_INVALIDO', 'Esta pantalla usa encuestas de clima. Elige una encuesta de tipo clima.');
  if (survey.status === 'BORRADOR') throw new AppError(409, 'SIN_RESULTADOS', 'La encuesta está en borrador y todavía no tiene resultados.');
  if (user.role !== 'RH' && survey.status !== 'CERRADA') {
    throw new AppError(403, 'RESULTADOS_NO_PUBLICADOS', 'Los resultados se publican cuando RH cierra la encuesta.');
  }
  return survey;
}

// ---- Resumen para RH ----
analyticsRouter.get('/overview', requireRole('RH'), ah(async (req, res) => {
  const { surveyId } = parse(surveyQuery, req.query);
  const survey = await resolveSurvey(req.user!, surveyId);
  const [rows, prev, invited, completed, risks] = await Promise.all([
    loadClimaRows(survey.id),
    previousClimaSurvey(survey),
    prisma.invitation.count({ where: { surveyId: survey.id } }),
    prisma.invitation.count({ where: { surveyId: survey.id, usedAt: { not: null } } }),
    computeSurveyRisk(survey.id),
  ]);
  const n = countResponses(rows);
  const global = guard(n, survey.minGroupSize, () => round1(summarize(rows).global));
  let trend: { previousTitle: string; previous: number | null; delta: number | null } | null = null;
  if (prev) {
    const prevRows = await loadClimaRows(prev.id);
    const prevGlobal = meetsK(countResponses(prevRows), prev.minGroupSize) ? summarize(prevRows).global : null;
    const cur = global.suppressed ? null : summarize(rows).global;
    trend = { previousTitle: prev.title, previous: round1(prevGlobal), delta: prevGlobal !== null && cur !== null ? round1(cur - prevGlobal) : null };
  }
  res.json({
    survey: { id: survey.id, title: survey.title, status: survey.status, closesAt: survey.closesAt, minGroupSize: survey.minGroupSize },
    participation: { invited, completed, pct: invited === 0 ? 0 : round1((completed / invited) * 100) },
    globalFavorable: global.suppressed ? { suppressed: true, message: global.message } : { suppressed: false, value: global.value },
    trend,
    areas: risks.map((r) => ({
      areaId: r.areaId, areaName: r.areaName,
      insufficient: r.result.insufficient, score: round1(r.result.score), level: r.result.level,
      drivers: r.result.drivers.map((d) => ({ key: d.key, label: d.label, contribution: round1(d.contribution) })),
    })),
  });
}));

// ---- Mapa de calor áreas x dimensiones ----
analyticsRouter.get('/heatmap', requireRole('RH'), ah(async (req, res) => {
  const { surveyId } = parse(surveyQuery, req.query);
  const survey = await resolveSurvey(req.user!, surveyId);
  const [areas, rows, prev] = await Promise.all([
    prisma.area.findMany({ orderBy: { name: 'asc' } }),
    loadClimaRows(survey.id),
    previousClimaSurvey(survey),
  ]);
  const byArea = groupBy(rows, (r) => r.areaId);
  const prevRows = prev ? await loadClimaRows(prev.id) : [];
  const prevByArea = groupBy(prevRows, (r) => r.areaId);
  const companySummary = summarize(rows);
  res.json({
    survey: { id: survey.id, title: survey.title, minGroupSize: survey.minGroupSize },
    previousSurvey: prev ? { id: prev.id, title: prev.title } : null,
    dimensions: DIMENSIONS.map((d) => ({ dimension: d, label: DIMENSION_LABELS[d] })),
    companyAverage: DIMENSIONS.map((d) => ({
      dimension: d, favorable: round1(companySummary.byDimension[d].favorable),
      neutral: round1(companySummary.byDimension[d].neutral), desfavorable: round1(companySummary.byDimension[d].desfavorable),
    })),
    rows: areas.map((a) => {
      const areaRows = byArea.get(a.id) ?? [];
      const n = countResponses(areaRows);
      if (!meetsK(n, survey.minGroupSize)) {
        return { areaId: a.id, areaName: a.name, suppressed: true, message: INSUFFICIENT_MESSAGE };
      }
      const s = summarize(areaRows);
      const prevAreaRows = prevByArea.get(a.id) ?? [];
      const prevOk = !!prev && meetsK(countResponses(prevAreaRows), prev.minGroupSize);
      const prevSummary = prevOk ? summarize(prevAreaRows) : null;
      return {
        areaId: a.id, areaName: a.name, suppressed: false, responses: n,
        cells: DIMENSIONS.map((d) => {
          const cur = s.byDimension[d];
          const prevFav = prevSummary ? prevSummary.byDimension[d].favorable : null;
          return {
            dimension: d, n: cur.n,
            favorable: round1(cur.favorable), neutral: round1(cur.neutral), desfavorable: round1(cur.desfavorable),
            delta: cur.favorable !== null && prevFav !== null ? round1(cur.favorable - prevFav) : null,
            deltaAvailable: prevOk,
          };
        }),
      };
    }),
  });
}));

// ---- Tendencia global y por área en una sola llamada, para la gráfica de líneas del panel ----
analyticsRouter.get('/trend-all', requireRole('RH'), ah(async (_req, res) => {
  const areas = await prisma.area.findMany({ orderBy: { name: 'asc' } });
  const surveys = await prisma.survey.findMany({ where: { type: 'CLIMA', status: 'CERRADA' }, orderBy: { closesAt: 'asc' } });
  const points = [];
  for (const s of surveys) {
    const rows = await loadClimaRows(s.id);
    const global = meetsK(countResponses(rows), s.minGroupSize) ? round1(summarize(rows).global) : null;
    const byArea = groupBy(rows, (r) => r.areaId);
    points.push({
      surveyId: s.id, title: s.title, closesAt: s.closesAt, global,
      areas: areas.map((a) => {
        const areaRows = byArea.get(a.id) ?? [];
        const ok = meetsK(countResponses(areaRows), s.minGroupSize);
        return { areaId: a.id, areaName: a.name, favorable: ok ? round1(summarize(areaRows).global) : null, suppressed: !ok };
      }),
    });
  }
  res.json({ areas: areas.map((a) => ({ id: a.id, name: a.name })), points });
}));

// ---- Participación por área ----
analyticsRouter.get('/participation', requireRole('RH'), ah(async (req, res) => {
  const { surveyId } = parse(surveyQuery, req.query);
  const survey = await resolveSurvey(req.user!, surveyId);
  const areas = await prisma.area.findMany({ orderBy: { name: 'asc' } });
  const invitations = await prisma.invitation.findMany({
    where: { surveyId: survey.id },
    select: { usedAt: true, userId: true },
  });
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(invitations.map((i) => i.userId))] } },
    select: { id: true, areaId: true },
  });
  const areaOfUser = new Map(users.map((u) => [u.id, u.areaId]));
  const byArea = new Map<string, { invited: number; completed: number }>();
  for (const inv of invitations) {
    const areaId = areaOfUser.get(inv.userId);
    if (!areaId) continue;
    const cur = byArea.get(areaId) ?? { invited: 0, completed: 0 };
    cur.invited += 1;
    if (inv.usedAt) cur.completed += 1;
    byArea.set(areaId, cur);
  }
  res.json({
    survey: { id: survey.id, title: survey.title, minGroupSize: survey.minGroupSize },
    areas: areas.map((a) => {
      const c = byArea.get(a.id) ?? { invited: 0, completed: 0 };
      const suppressed = c.completed > 0 && c.completed < survey.minGroupSize;
      return {
        areaId: a.id, areaName: a.name, invited: c.invited,
        completed: suppressed ? null : c.completed,
        pct: c.invited === 0 || suppressed ? null : round1((c.completed / c.invited) * 100),
        suppressed,
      };
    }),
  });
}));

// ---- Tendencia entre encuestas ----
async function areaTrend(areaId: string | null) {
  const surveys = await prisma.survey.findMany({ where: { type: 'CLIMA', status: 'CERRADA' }, orderBy: { closesAt: 'asc' } });
  const points = [];
  for (const s of surveys) {
    const rows = (await loadClimaRows(s.id)).filter((r) => !areaId || r.areaId === areaId);
    const n = countResponses(rows);
    points.push({
      surveyId: s.id, title: s.title, closesAt: s.closesAt,
      ...(meetsK(n, s.minGroupSize) ? { favorable: round1(summarize(rows).global) } : { favorable: null, suppressed: true }),
    });
  }
  return points;
}

const trendQuery = z.object({ areaId: z.string().min(1).optional() });

analyticsRouter.get('/trend', requireRole('RH', 'LIDER'), ah(async (req, res) => {
  const { areaId } = parse(trendQuery, req.query);
  const user = req.user!;
  const target = areaId ?? (user.role === 'LIDER' ? user.areaId : null);
  if (target) assertAreaAccess(user, target);
  res.json({ areaId: target, points: await areaTrend(target) });
}));

// ---- Detalle de un área ----
analyticsRouter.get('/areas/:id', requireRole('RH', 'LIDER'), ah(async (req, res) => {
  const { surveyId } = parse(surveyQuery, req.query);
  const user = req.user!;
  assertAreaAccess(user, param(req, 'id'));
  const area = await prisma.area.findUnique({ where: { id: param(req, 'id') } });
  if (!area) throw notFound('No encontramos esa área. Vuelve al panel y elige otra.');
  const survey = await resolveSurvey(user, surveyId);
  const rows = (await loadClimaRows(survey.id)).filter((r) => r.areaId === area.id);
  const n = countResponses(rows);
  const head = { area: { id: area.id, name: area.name }, survey: { id: survey.id, title: survey.title, minGroupSize: survey.minGroupSize } };

  // Si el área no llega a k, no se muestra ningún corte.
  if (!meetsK(n, survey.minGroupSize)) {
    return res.json({ ...head, suppressed: true, message: INSUFFICIENT_MESSAGE });
  }

  const s = summarize(rows);
  const byTenure = groupBy(rows, (r) => r.tenureBand);
  const counts = Object.fromEntries([...byTenure.entries()].map(([band, rs]) => [band, countResponses(rs)]));
  const hidden = suppressedKeys(counts, survey.minGroupSize);
  const tenure = (Object.keys(TENURE_LABELS) as (keyof typeof TENURE_LABELS)[])
    .filter((band) => (counts[band] ?? 0) > 0)
    .map((band) => hidden.has(band)
      ? { band, label: TENURE_LABELS[band], suppressed: true, message: INSUFFICIENT_MESSAGE }
      : { band, label: TENURE_LABELS[band], suppressed: false, responses: counts[band], favorable: round1(summarize(byTenure.get(band)!).global) });

  // Comentarios: solo con k cumplido, sin fecha ni autor y en orden alfabético.
  const comments = (await prisma.answer.findMany({
    where: { text: { not: null }, response: { surveyId: survey.id, areaId: area.id }, question: { type: 'ABIERTA' } },
    select: { text: true },
  })).map((c) => c.text as string).sort((a, b) => a.localeCompare(b, 'es'));

  const risk = (await computeSurveyRisk(survey.id)).find((r) => r.areaId === area.id);
  res.json({
    ...head, suppressed: false, responses: n,
    globalFavorable: round1(s.global),
    dimensions: DIMENSIONS.map((d) => ({ dimension: d, label: DIMENSION_LABELS[d], favorable: round1(s.byDimension[d].favorable) })),
    trend: await areaTrend(area.id),
    tenure,
    comments,
    risk: risk && !risk.result.insufficient ? {
      score: round1(risk.result.score), level: risk.result.level,
      components: risk.result.components.map((c) => ({ key: c.key, label: c.label, weight: c.weight, raw: round1(c.raw), contribution: round1(c.contribution) })),
      drivers: risk.result.drivers.map((c) => ({ key: c.key, label: c.label, contribution: round1(c.contribution) })),
    } : null,
  });
}));
