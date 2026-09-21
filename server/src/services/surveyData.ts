import type { Prisma, TenureBand } from '@prisma/client';
import { prisma } from '../db.js';
import { notFound } from '../errors.js';
import { DEFAULT_LEVELS, DEFAULT_WEIGHTS, type RiskLevels, type RiskWeights } from './riskModel.js';
import type { Dim } from './scoring.js';

export interface ClimaRow { areaId: string; responseId: string; tenureBand: TenureBand; dimension: Dim; value: number }

export async function getRiskConfig(): Promise<{ weights: RiskWeights; levels: RiskLevels }> {
  const cfg = await prisma.riskConfig.findUnique({ where: { id: 1 } });
  return {
    weights: { ...DEFAULT_WEIGHTS, ...((cfg?.weights as Partial<RiskWeights> | undefined) ?? {}) },
    levels: { ...DEFAULT_LEVELS, ...((cfg?.levels as Partial<RiskLevels> | undefined) ?? {}) },
  };
}

/** Respuestas Likert de una encuesta. Nunca incluye nada que identifique a una persona. */
export async function loadClimaRows(surveyId: string): Promise<ClimaRow[]> {
  const answers = await prisma.answer.findMany({
    where: { response: { surveyId }, value: { not: null }, question: { type: 'LIKERT_5' } },
    select: {
      value: true,
      question: { select: { dimension: true } },
      response: { select: { id: true, areaId: true, tenureBand: true } },
    },
  });
  return answers.map((a) => ({
    areaId: a.response.areaId,
    responseId: a.response.id,
    tenureBand: a.response.tenureBand,
    dimension: a.question.dimension as Dim,
    value: a.value as number,
  }));
}

export const countResponses = (rows: ClimaRow[]): number => new Set(rows.map((r) => r.responseId)).size;

export function groupBy<T, K extends string>(items: T[], key: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const it of items) {
    const k = key(it);
    const arr = m.get(k);
    if (arr) arr.push(it);
    else m.set(k, [it]);
  }
  return m;
}

export async function getSurvey(surveyId: string) {
  const s = await prisma.survey.findUnique({ where: { id: surveyId } });
  if (!s) throw notFound('No encontramos esa encuesta. Elige otra en el selector.');
  return s;
}

/** Encuesta de clima cerrada anterior a la dada (por fecha de cierre). */
export async function previousClimaSurvey(survey: { id: string; closesAt: Date | null }) {
  if (!survey.closesAt) return null;
  return prisma.survey.findFirst({
    where: { type: 'CLIMA', status: 'CERRADA', closesAt: { lt: survey.closesAt }, id: { not: survey.id } },
    orderBy: { closesAt: 'desc' },
  });
}

/** Salidas de los 6 meses previos (incluido el mes del cierre) para un área. */
export async function recentTurnover(areaId: string, closesAt: Date | null) {
  const end = closesAt ?? new Date();
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 5, 1));
  const where: Prisma.TurnoverRecordWhereInput = { areaId, month: { gte: start, lte: end } };
  return prisma.turnoverRecord.findMany({ where, select: { headcountStart: true, exits: true } });
}

export async function latestClosedSurvey(type: 'CLIMA' | 'EVAL_360') {
  return prisma.survey.findFirst({ where: { type, status: 'CERRADA' }, orderBy: { closesAt: 'desc' } });
}
