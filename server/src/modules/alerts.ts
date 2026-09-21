import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { AppError, ah, notFound, parse, param } from '../errors.js';
import { assertAreaAccess, requireRole, type AuthUser } from '../middleware/auth.js';
import { round1 } from '../services/scoring.js';

export const alertsRouter = Router();

const include = { actions: { orderBy: { id: 'asc' } }, survey: { select: { title: true } } } satisfies Prisma.AlertInclude;
type AlertFull = Prisma.AlertGetPayload<{ include: typeof include }>;

async function present(alerts: AlertFull[], withActions: boolean) {
  const areas = await prisma.area.findMany({ select: { id: true, name: true } });
  const areaName = new Map(areas.map((a) => [a.id, a.name]));
  const creatorIds = [...new Set(alerts.flatMap((a) => a.actions.map((x) => x.createdById)))];
  const creators = await prisma.user.findMany({ where: { id: { in: creatorIds } }, select: { id: true, name: true } });
  const names = new Map(creators.map((u) => [u.id, u.name]));
  return alerts.map((a) => ({
    id: a.id, surveyId: a.surveyId, surveyTitle: a.survey.title, areaId: a.areaId, areaName: areaName.get(a.areaId) ?? '',
    level: a.level, riskScore: round1(a.riskScore), drivers: a.drivers, status: a.status, createdAt: a.createdAt, closedAt: a.closedAt,
    actionCount: a.actions.length,
    ...(withActions ? { actions: a.actions.map((x) => ({ id: x.id, description: x.description, dueDate: x.dueDate, doneAt: x.doneAt, createdByName: names.get(x.createdById) ?? '' })) } : {}),
  }));
}

async function loadAlert(id: string, user: AuthUser) {
  const alert = await prisma.alert.findUnique({ where: { id }, include });
  if (!alert) throw notFound('No encontramos esa alerta. Vuelve a la bandeja y elige otra.');
  assertAreaAccess(user, alert.areaId);
  return alert;
}

const listSchema = z.object({
  level: z.enum(['ALTO', 'CRITICO']).optional(),
  status: z.enum(['NUEVA', 'EN_SEGUIMIENTO', 'ATENDIDA', 'DESCARTADA']).optional(),
  areaId: z.string().optional(),
});

alertsRouter.get('/', requireRole('RH', 'LIDER'), ah(async (req, res) => {
  const q = parse(listSchema, req.query);
  const user = req.user!;
  const where: Prisma.AlertWhereInput = { level: q.level, status: q.status };
  if (user.role === 'LIDER') where.areaId = user.areaId;
  else if (q.areaId) where.areaId = q.areaId;
  const alerts = await prisma.alert.findMany({ where, include, orderBy: [{ survey: { closesAt: 'desc' } }, { riskScore: 'desc' }] });
  res.json({ alerts: await present(alerts, false) });
}));

alertsRouter.get('/:id', requireRole('RH', 'LIDER'), ah(async (req, res) => {
  const alert = await loadAlert(param(req, 'id'), req.user!);
  res.json({ alert: (await present([alert], true))[0] });
}));

const patchSchema = z.object({ status: z.enum(['NUEVA', 'EN_SEGUIMIENTO', 'ATENDIDA', 'DESCARTADA']) });

alertsRouter.patch('/:id', requireRole('RH'), ah(async (req, res) => {
  const { status } = parse(patchSchema, req.body);
  await loadAlert(param(req, 'id'), req.user!);
  const closed = status === 'ATENDIDA' || status === 'DESCARTADA';
  await prisma.alert.update({ where: { id: param(req, 'id') }, data: { status, closedAt: closed ? new Date() : null } });
  res.json({ alert: (await present([await loadAlert(param(req, 'id'), req.user!)], true))[0] });
}));

const actionSchema = z.object({
  description: z.string().trim().min(5, 'describe la acción con al menos 5 caracteres').max(500),
  dueDate: z.coerce.date().nullish(),
});

alertsRouter.post('/:id/actions', requireRole('RH', 'LIDER'), ah(async (req, res) => {
  const body = parse(actionSchema, req.body);
  const alert = await loadAlert(param(req, 'id'), req.user!);
  if (alert.status === 'ATENDIDA' || alert.status === 'DESCARTADA') {
    throw new AppError(409, 'ALERTA_CERRADA', 'Esta alerta ya está cerrada. Pide a RH que la reabra para registrar más acciones.');
  }
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  if (body.dueDate && body.dueDate < startOfToday) {
    throw new AppError(400, 'FECHA_PASADA', 'La fecha compromiso ya pasó. Elige hoy o una fecha futura.');
  }
  await prisma.$transaction([
    prisma.alertAction.create({ data: { alertId: alert.id, createdById: req.user!.id, description: body.description, dueDate: body.dueDate ?? null } }),
    ...(alert.status === 'NUEVA' ? [prisma.alert.update({ where: { id: alert.id }, data: { status: 'EN_SEGUIMIENTO' } })] : []),
  ]);
  res.status(201).json({ alert: (await present([await loadAlert(alert.id, req.user!)], true))[0] });
}));

const doneSchema = z.object({ done: z.boolean() });

alertsRouter.patch('/:id/actions/:actionId', requireRole('RH', 'LIDER'), ah(async (req, res) => {
  const { done } = parse(doneSchema, req.body);
  await loadAlert(param(req, 'id'), req.user!);
  const action = await prisma.alertAction.findFirst({ where: { id: param(req, 'actionId'), alertId: param(req, 'id') } });
  if (!action) throw notFound('No encontramos esa acción en esta alerta. Recarga la página.');
  await prisma.alertAction.update({ where: { id: action.id }, data: { doneAt: done ? new Date() : null } });
  res.json({ alert: (await present([await loadAlert(param(req, 'id'), req.user!)], true))[0] });
}));
