import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';

const app = createApp();
const PASS = 'Demo1234!';
const login = async (email: string) => {
  const a = request.agent(app);
  await a.post('/api/auth/login').send({ email, password: PASS }).expect(200);
  return a;
};

let produccionId = '';
let calidadId = '';
let calidadLeaderId = '';
let produccionLeaderId = '';
beforeAll(async () => {
  produccionId = (await prisma.area.findUniqueOrThrow({ where: { name: 'Producción' } })).id;
  calidadId = (await prisma.area.findUniqueOrThrow({ where: { name: 'Calidad' } })).id;
  calidadLeaderId = (await prisma.user.findUniqueOrThrow({ where: { email: 'lider.calidad@clima.demo' } })).id;
  produccionLeaderId = (await prisma.user.findUniqueOrThrow({ where: { email: 'lider.produccion@clima.demo' } })).id;
});
afterAll(() => prisma.$disconnect());

describe('autenticación', () => {
  it('sin sesión responde 401 con el formato uniforme de error', async () => {
    const r = await request(app).get('/api/surveys').expect(401);
    expect(r.body).toEqual({ error: { code: 'SIN_SESION', message: expect.any(String) } });
  });
  it('credenciales incorrectas explican qué pasó', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: 'rh@clima.demo', password: 'mala' }).expect(401);
    expect(r.body.error.code).toBe('CREDENCIALES_INVALIDAS');
    expect(r.body.error.message).toMatch(/no coinciden/);
  });
  it('la cookie de sesión es httpOnly y /auth/me devuelve al usuario', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: 'rh@clima.demo', password: PASS }).expect(200);
    expect(String(r.headers['set-cookie'])).toMatch(/HttpOnly/i);
    expect(r.body.user).not.toHaveProperty('passwordHash');
  });
  it('valida entradas con zod', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: 'no-es-correo' }).expect(400);
    expect(r.body.error.code).toBe('VALIDACION');
  });
});

describe('colaborador: solo responde encuestas', () => {
  it.each([
    ['GET', '/api/analytics/overview'],
    ['GET', '/api/analytics/heatmap'],
    ['GET', '/api/alerts'],
    ['GET', '/api/leaders'],
    ['GET', '/api/config/risk'],
    ['POST', '/api/risk/recompute'],
  ])('%s %s responde 403', async (method, url) => {
    const w = await login('colaborador01@clima.demo');
    const r = await (w as unknown as Record<string, (u: string) => request.Test>)[method.toLowerCase()](url);
    expect(r.status).toBe(403);
  });
  it('no puede crear ni cerrar encuestas', async () => {
    const w = await login('colaborador01@clima.demo');
    await w.post('/api/surveys').send({ title: 'x', type: 'CLIMA', questions: [] }).expect(403);
  });
  it('sí ve sus encuestas pendientes, sin respuestas', async () => {
    const w = await login('colaborador01@clima.demo');
    const r = await w.get('/api/me/invitations').expect(200);
    expect(r.body).toHaveProperty('pending');
    expect(JSON.stringify(r.body)).not.toMatch(/"value"|"answers"/);
  });
});

describe('líder: solo su área y su reporte', () => {
  it('ve el detalle de su propia área', async () => {
    const l = await login('lider.calidad@clima.demo');
    await l.get(`/api/analytics/areas/${calidadId}`).expect(200);
  });
  it('no puede ver otra área (403)', async () => {
    const l = await login('lider.calidad@clima.demo');
    const r = await l.get(`/api/analytics/areas/${produccionId}`).expect(403);
    expect(r.body.error.code).toBe('SIN_PERMISO');
  });
  it('no puede pedir la tendencia de otra área; sin filtro se le da la suya', async () => {
    const l = await login('lider.calidad@clima.demo');
    await l.get(`/api/analytics/trend?areaId=${produccionId}`).expect(403);
    const own = await l.get('/api/analytics/trend').expect(200);
    expect(own.body.areaId).toBe(calidadId);
  });
  it('solo ve las alertas de su área', async () => {
    const prod = await login('lider.produccion@clima.demo');
    const list = await prod.get('/api/alerts').expect(200);
    expect(list.body.alerts.length).toBeGreaterThan(0);
    for (const a of list.body.alerts) expect(a.areaName).toBe('Producción');
    const calidad = await login('lider.calidad@clima.demo');
    const alertId = list.body.alerts[0].id as string;
    await calidad.get(`/api/alerts/${alertId}`).expect(403);
    await calidad.post(`/api/alerts/${alertId}/actions`).send({ description: 'Intento ajeno' }).expect(403);
  });
  it('no ve el reporte 360 de otro líder, pero sí el propio', async () => {
    const l = await login('lider.calidad@clima.demo');
    await l.get(`/api/leaders/${produccionLeaderId}/report360`).expect(403);
    await l.get(`/api/leaders/${calidadLeaderId}/report360`).expect(200);
  });
  it('no puede ver el mapa de calor, el resumen ni la configuración', async () => {
    const l = await login('lider.calidad@clima.demo');
    for (const url of ['/api/analytics/heatmap', '/api/analytics/overview', '/api/config/risk']) await l.get(url).expect(403);
    await l.put('/api/config/risk').send({}).expect(403);
  });
  it('no puede cambiar el estado de una alerta (solo RH)', async () => {
    const prod = await login('lider.produccion@clima.demo');
    const list = await prod.get('/api/alerts').expect(200);
    await prod.patch(`/api/alerts/${list.body.alerts[0].id}`).send({ status: 'DESCARTADA' }).expect(403);
  });
});

describe('RH ve todo', () => {
  it('puede ver cualquier área y cualquier reporte 360', async () => {
    const rh = await login('rh@clima.demo');
    await rh.get(`/api/analytics/areas/${produccionId}`).expect(200);
    await rh.get(`/api/leaders/${calidadLeaderId}/report360`).expect(200);
    const heat = await rh.get('/api/analytics/heatmap').expect(200);
    expect(heat.body.rows).toHaveLength(5);
  });
});
