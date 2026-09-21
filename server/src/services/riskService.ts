import { prisma } from '../db.js';
import {
  annualizedTurnover, computeRisk, type RiskResult,
} from './riskModel.js';
import { summarize } from './scoring.js';
import {
  countResponses, getRiskConfig, getSurvey, groupBy, loadClimaRows, previousClimaSurvey, recentTurnover,
} from './surveyData.js';

export interface AreaRisk {
  areaId: string;
  areaName: string;
  responses: number;
  minGroupSize: number;
  previousGlobal: number | null;
  annualizedTurnover: number | null;
  result: RiskResult;
}

/** Calcula el riesgo de todas las áreas para una encuesta de clima. */
export async function computeSurveyRisk(surveyId: string): Promise<AreaRisk[]> {
  const survey = await getSurvey(surveyId);
  const [{ weights, levels }, areas, rows, prev] = await Promise.all([
    getRiskConfig(),
    prisma.area.findMany({ orderBy: { name: 'asc' } }),
    loadClimaRows(surveyId),
    previousClimaSurvey(survey),
  ]);
  const prevRows = prev ? await loadClimaRows(prev.id) : [];
  const byArea = groupBy(rows, (r) => r.areaId);
  const prevByArea = groupBy(prevRows, (r) => r.areaId);

  const out: AreaRisk[] = [];
  for (const area of areas) {
    const areaRows = byArea.get(area.id) ?? [];
    const responses = countResponses(areaRows);
    const summary = summarize(areaRows);
    const prevArea = prevByArea.get(area.id) ?? [];
    // Solo se usa la encuesta anterior si su muestra también cumplía k.
    const previousGlobal = prevArea.length > 0 && countResponses(prevArea) >= (prev?.minGroupSize ?? 0)
      ? summarize(prevArea).global : null;
    const turnover = annualizedTurnover(await recentTurnover(area.id, survey.closesAt));
    const result = computeRisk(
      { summary, responses, minGroupSize: survey.minGroupSize, previousGlobal, annualizedTurnover: turnover },
      weights, levels,
    );
    out.push({ areaId: area.id, areaName: area.name, responses, minGroupSize: survey.minGroupSize, previousGlobal, annualizedTurnover: turnover, result });
  }
  return out.sort((a, b) => (b.result.score ?? -1) - (a.result.score ?? -1));
}

/**
 * Recalcula el riesgo y sincroniza alertas. Solo ALTO y CRITICO generan alerta.
 * Una alerta que ya no califica se elimina únicamente si nadie la ha trabajado.
 */
export async function recomputeAlerts(surveyId: string): Promise<AreaRisk[]> {
  const risks = await computeSurveyRisk(surveyId);
  for (const r of risks) {
    const level = r.result.level;
    const existing = await prisma.alert.findUnique({ where: { surveyId_areaId: { surveyId, areaId: r.areaId } }, include: { _count: { select: { actions: true } } } });
    if (level === 'ALTO' || level === 'CRITICO') {
      const data = { level, riskScore: r.result.score as number, drivers: r.result.drivers as unknown as object };
      if (existing) await prisma.alert.update({ where: { id: existing.id }, data });
      else await prisma.alert.create({ data: { surveyId, areaId: r.areaId, ...data } });
    } else if (existing && existing.status === 'NUEVA' && existing._count.actions === 0) {
      await prisma.alert.delete({ where: { id: existing.id } });
    }
  }
  return risks;
}
