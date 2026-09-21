import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { ah, badRequest, parse } from '../errors.js';
import { requireRole } from '../middleware/auth.js';
import { COMPONENT_LABELS, DEFAULT_LEVELS, DEFAULT_WEIGHTS, validateLevels, validateWeights, type RiskLevels, type RiskWeights } from '../services/riskModel.js';
import { getRiskConfig, latestClosedSurvey } from '../services/surveyData.js';
import { recomputeAlerts } from '../services/riskService.js';

export const configRouter = Router();
export const riskRouter = Router();

configRouter.get('/risk', requireRole('RH'), ah(async (_req, res) => {
  res.json({ ...(await getRiskConfig()), labels: COMPONENT_LABELS, defaults: { weights: DEFAULT_WEIGHTS, levels: DEFAULT_LEVELS } });
}));

const weightSchema = z.number().min(0, 'no puede ser negativo').max(100, 'no puede pasar de 100');
const putSchema = z.object({
  weights: z.object({
    PERMANENCIA: weightSchema, LIDERAZGO: weightSchema, COMUNICACION: weightSchema, RECONOCIMIENTO: weightSchema,
    CARGA_TRABAJO: weightSchema, TENDENCIA: weightSchema, ROTACION: weightSchema,
  }),
  levels: z.object({ medio: z.number(), alto: z.number(), critico: z.number() }),
});

configRouter.put('/risk', requireRole('RH'), ah(async (req, res) => {
  const body = parse(putSchema, req.body);
  const wErr = validateWeights(body.weights as RiskWeights);
  if (wErr) throw badRequest(wErr, 'PESOS_INVALIDOS');
  const lErr = validateLevels(body.levels as RiskLevels);
  if (lErr) throw badRequest(lErr, 'UMBRALES_INVALIDOS');
  await prisma.riskConfig.upsert({
    where: { id: 1 },
    create: { id: 1, weights: body.weights, levels: body.levels },
    update: { weights: body.weights, levels: body.levels },
  });
  res.json({ ...(await getRiskConfig()) });
}));

const recomputeSchema = z.object({ surveyId: z.string().min(1).optional() });

riskRouter.post('/recompute', requireRole('RH'), ah(async (req, res) => {
  const { surveyId } = parse(recomputeSchema, req.query);
  const survey = surveyId ? await prisma.survey.findUnique({ where: { id: surveyId } }) : await latestClosedSurvey('CLIMA');
  if (!survey) throw badRequest('No hay una encuesta de clima cerrada para recalcular. Cierra una encuesta primero.', 'SIN_ENCUESTA');
  if (survey.type !== 'CLIMA') throw badRequest('El riesgo de rotación solo se calcula con encuestas de clima.', 'TIPO_INVALIDO');
  const risks = await recomputeAlerts(survey.id);
  res.json({
    surveyId: survey.id,
    areas: risks.map((r) => ({ areaId: r.areaId, areaName: r.areaName, score: r.result.score, level: r.result.level, insufficient: r.result.insufficient })),
  });
}));
