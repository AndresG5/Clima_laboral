import { describe, it, expect, afterAll } from 'vitest';
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
afterAll(() => prisma.$disconnect());

describe('encuestas: responder una sola vez', () => {
  it('una segunda respuesta a la misma invitación da 409, y la invitación ajena da 404', async () => {
    const rh = await login('rh@clima.demo');
    const created = await rh.post('/api/surveys').send({
      title: 'Prueba de envío único', type: 'CLIMA', minGroupSize: 3,
      questions: [{ dimension: 'LIDERAZGO', text: 'Mi jefe me trata con respeto.' }, { dimension: 'DESARROLLO', text: 'Puedo aprender aquí.' }, { dimension: 'PERMANENCIA', text: 'Comentario opcional.', type: 'ABIERTA' }],
    }).expect(201);
    const surveyId = created.body.survey.id as string;
    try {
      await rh.patch(`/api/surveys/${surveyId}/status`).send({ status: 'ACTIVA' }).expect(200);
      const inv = await rh.post(`/api/surveys/${surveyId}/invitations`).expect(201);
      expect(inv.body.created).toBeGreaterThan(150);
      const again = await rh.post(`/api/surveys/${surveyId}/invitations`).expect(201);
      expect(again.body.created).toBe(0); // no duplica

      const a = await login('colaborador03@clima.demo');
      const b = await login('colaborador04@clima.demo');
      const mine = (await a.get('/api/me/invitations')).body.pending.find((i: { surveyTitle: string }) => i.surveyTitle === 'Prueba de envío único');
      const form = await a.get(`/api/invitations/${mine.id}/form`).expect(200);
      const qs = form.body.dimensions.flatMap((d: { questions: { id: string; type: string }[] }) => d.questions);

      // Incompleta: falta una pregunta de escala
      const first = qs.find((q: { type: string }) => q.type === 'LIKERT_5');
      const bad = await a.post(`/api/invitations/${mine.id}/submit`).send({ answers: [{ questionId: first.id, value: 3 }] }).expect(400);
      expect(bad.body.error.code).toBe('RESPUESTAS_INCOMPLETAS');
      // Valor fuera de escala
      await a.post(`/api/invitations/${mine.id}/submit`).send({ answers: [{ questionId: first.id, value: 9 }] }).expect(400);

      const answers = qs.map((q: { id: string; type: string }) => (q.type === 'ABIERTA' ? { questionId: q.id, text: 'Más comunicación.' } : { questionId: q.id, value: 5 }));
      await b.get(`/api/invitations/${mine.id}/form`).expect(404); // invitación de otra persona
      await b.post(`/api/invitations/${mine.id}/submit`).send({ answers }).expect(404);
      await a.post(`/api/invitations/${mine.id}/submit`).send({ answers }).expect(201);
      const dup = await a.post(`/api/invitations/${mine.id}/submit`).send({ answers }).expect(409);
      expect(dup.body.error.code).toBe('YA_RESPONDIDA');
      expect(await prisma.response.count({ where: { surveyId } })).toBe(1);

      const done = (await a.get('/api/me/invitations')).body.completed.find((i: { surveyTitle: string }) => i.surveyTitle === 'Prueba de envío único');
      expect(done.completed).toBe(true);
    } finally {
      await prisma.survey.delete({ where: { id: surveyId } });
    }
  });

  it('no se puede reabrir una encuesta cerrada ni cerrar una en borrador', async () => {
    const rh = await login('rh@clima.demo');
    const c = await rh.post('/api/surveys').send({ title: 'Transiciones', type: 'CLIMA', questions: [{ dimension: 'LIDERAZGO', text: 'Mi jefe me trata con respeto.' }] }).expect(201);
    const id = c.body.survey.id as string;
    try {
      await rh.patch(`/api/surveys/${id}/status`).send({ status: 'CERRADA' }).expect(409);
      await rh.patch(`/api/surveys/${id}/status`).send({ status: 'ACTIVA' }).expect(200);
      await rh.patch(`/api/surveys/${id}/status`).send({ status: 'CERRADA' }).expect(200);
      await rh.patch(`/api/surveys/${id}/status`).send({ status: 'ACTIVA' }).expect(409);
    } finally {
      await prisma.survey.delete({ where: { id } });
    }
  });
});

describe('riesgo y alertas con los datos del seed', () => {
  it('la encuesta más reciente ya tiene alerta CRITICO en Producción y ALTO en Almacén, y ninguna en las demás', async () => {
    const rh = await login('rh@clima.demo');
    const { body } = await rh.get('/api/alerts').expect(200);
    const by = Object.fromEntries(body.alerts.map((a: { areaName: string; level: string }) => [a.areaName, a.level]));
    expect(by).toEqual({ Producción: 'CRITICO', Almacén: 'ALTO' });
    for (const a of body.alerts) {
      const detail = (await rh.get(`/api/alerts/${a.id}`)).body.alert;
      expect(detail.drivers).toHaveLength(3); // los 3 factores que más pesan
      expect(detail.drivers[0].contribution).toBeGreaterThanOrEqual(detail.drivers[1].contribution);
    }
  });

  it('un líder registra una acción y RH la ve; la alerta pasa a en seguimiento', async () => {
    const lider = await login('lider.produccion@clima.demo');
    const rh = await login('rh@clima.demo');
    const alert = (await lider.get('/api/alerts')).body.alerts[0];
    const before = (await rh.get(`/api/alerts/${alert.id}`)).body.alert;
    try {
      const soon = new Date(Date.now() + 7 * 86_400_000).toISOString();
      const created = await lider.post(`/api/alerts/${alert.id}/actions`).send({ description: 'Reunión con el turno nocturno esta semana', dueDate: soon }).expect(201);
      expect(created.body.alert.status).toBe('EN_SEGUIMIENTO');
      const seen = (await rh.get(`/api/alerts/${alert.id}`)).body.alert;
      expect(seen.actions.map((a: { description: string }) => a.description)).toContain('Reunión con el turno nocturno esta semana');
      expect(seen.actions.at(-1).createdByName).toBeTruthy();
      await lider.post(`/api/alerts/${alert.id}/actions`).send({ description: 'Acción vieja', dueDate: '2020-01-01' }).expect(400);
      const marked = await lider.patch(`/api/alerts/${alert.id}/actions/${seen.actions.at(-1).id}`).send({ done: true }).expect(200);
      expect(marked.body.alert.actions.at(-1).doneAt).not.toBeNull();
    } finally {
      await prisma.alertAction.deleteMany({ where: { alertId: alert.id } });
      await prisma.alert.update({ where: { id: alert.id }, data: { status: before.status } });
    }
  });

  it('RH edita los pesos y el recálculo cambia los resultados; no acepta pesos que no suman 100', async () => {
    const rh = await login('rh@clima.demo');
    const original = (await rh.get('/api/config/risk').expect(200)).body;
    const overview = async () => (await rh.get('/api/analytics/overview').expect(200)).body.areas as { areaName: string; score: number }[];
    const before = (await overview()).find((a) => a.areaName === 'Producción')!.score;
    try {
      const bad = await rh.put('/api/config/risk').send({ weights: { ...original.weights, PERMANENCIA: 40 }, levels: original.levels }).expect(400);
      expect(bad.body.error.message).toMatch(/suman 110/);
      await rh.put('/api/config/risk').send({ weights: { ...original.weights, PERMANENCIA: 10, LIDERAZGO: 10, TENDENCIA: 40 }, levels: original.levels }).expect(200);
      const rec = await rh.post('/api/risk/recompute').expect(200);
      expect(rec.body.areas.find((a: { areaName: string }) => a.areaName === 'Producción').score).not.toBeCloseTo(before, 1);
      const after = (await overview()).find((a) => a.areaName === 'Producción')!.score;
      expect(after).not.toBeCloseTo(before, 1);
    } finally {
      await rh.put('/api/config/risk').send({ weights: original.weights, levels: original.levels }).expect(200);
      await rh.post('/api/risk/recompute').expect(200);
    }
    expect((await overview()).find((a) => a.areaName === 'Producción')!.score).toBeCloseTo(before, 1);
  });

  it('hay tendencia que detectar entre las tres encuestas del seed', async () => {
    const rh = await login('rh@clima.demo');
    const list = await rh.get('/api/analytics/trend').expect(200);
    expect(list.body.points).toHaveLength(3);
    const [t1, , t3] = list.body.points;
    expect(t3.favorable).toBeLessThan(t1.favorable);
  });

  it('al cerrar una encuesta se calcula el riesgo y se crean las alertas (Producción crítico, Almacén alto)', async () => {
    const rh = await login('rh@clima.demo');
    const latest = await prisma.survey.findFirstOrThrow({ where: { type: 'CLIMA', status: 'CERRADA' }, orderBy: { closesAt: 'desc' } });
    await prisma.alert.deleteMany({ where: { surveyId: latest.id } });
    await prisma.survey.update({ where: { id: latest.id }, data: { status: 'ACTIVA' } });
    const closed = await rh.patch(`/api/surveys/${latest.id}/status`).send({ status: 'CERRADA' }).expect(200);
    expect(closed.body.alertsCreated).toBe(2);
    const alerts = await prisma.alert.findMany({ where: { surveyId: latest.id }, include: {} });
    expect(alerts).toHaveLength(2);
    const areas = await prisma.area.findMany();
    const name = (id: string) => areas.find((a) => a.id === id)!.name;
    expect(Object.fromEntries(alerts.map((a) => [name(a.areaId), a.level]))).toEqual({ Producción: 'CRITICO', Almacén: 'ALTO' });
  });
});

describe('reporte 360', () => {
  it('muestra autoevaluación contra equipo y pares con brecha por dimensión', async () => {
    const rh = await login('rh@clima.demo');
    const leaders = (await rh.get('/api/leaders')).body.leaders as { id: string; areaName: string }[];
    const prod = leaders.find((l) => l.areaName === 'Producción')!;
    const r = (await rh.get(`/api/leaders/${prod.id}/report360`).expect(200)).body;
    expect(r.groups.map((g: { relation: string }) => g.relation)).toEqual(['AUTO', 'SUPERVISOR', 'PAR']);
    const lid = r.dimensions.find((d: { dimension: string }) => d.dimension === 'LIDERAZGO');
    expect(lid.auto).toBeGreaterThan(lid.team);
    expect(lid.gapTeam).toBeGreaterThan(1); // brecha grande en Producción
  });

  it('un grupo con menos de k respuestas no muestra cifras', async () => {
    const rh = await login('rh@clima.demo');
    const leader = await prisma.user.findUniqueOrThrow({ where: { email: 'lider.calidad@clima.demo' } });
    const survey = await prisma.survey.findFirstOrThrow({ where: { type: 'EVAL_360' } });
    const original = survey.minGroupSize;
    try {
      await prisma.survey.update({ where: { id: survey.id }, data: { minGroupSize: 50 } }); // ningún grupo llega a 50
      const r = (await rh.get(`/api/leaders/${leader.id}/report360`).expect(200)).body;
      const team = r.groups.find((g: { relation: string }) => g.relation === 'SUPERVISOR');
      expect(team).toMatchObject({ suppressed: true, message: 'Muestra insuficiente para proteger el anonimato' });
      for (const d of r.dimensions) { expect(d.team).toBeNull(); expect(d.peers).toBeNull(); expect(d.gapTeam).toBeNull(); }
    } finally {
      await prisma.survey.update({ where: { id: survey.id }, data: { minGroupSize: original } });
    }
  });
});
