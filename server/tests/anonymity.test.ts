import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { INSUFFICIENT_MESSAGE, guard, suppressedKeys, tenureBandFor } from '../src/services/anonymity.js';

const app = createApp();
afterAll(() => prisma.$disconnect());

describe('umbral k (unitarias)', () => {
  it('oculta un grupo con menos de k respuestas', () => {
    expect(guard(4, 5, () => 1)).toEqual({ suppressed: true, message: INSUFFICIENT_MESSAGE });
    expect(guard(5, 5, () => 1)).toEqual({ suppressed: false, value: 1 });
  });
  it('supresión secundaria: si solo un corte se oculta, también se oculta el menor visible', () => {
    const hidden = suppressedKeys({ A: 3, B: 9, C: 20, D: 12 }, 5);
    expect([...hidden].sort()).toEqual(['A', 'B']);
  });
  it('sin cortes chicos no se oculta nada; con dos chicos no hace falta el secundario', () => {
    expect(suppressedKeys({ A: 8, B: 9 }, 5).size).toBe(0);
    expect([...suppressedKeys({ A: 2, B: 3, C: 20 }, 5)].sort()).toEqual(['A', 'B']);
  });
  it('antigüedad por rangos', () => {
    const on = new Date('2026-09-20');
    expect(tenureBandFor(new Date('2026-08-01'), on)).toBe('MENOS_6M');
    expect(tenureBandFor(new Date('2026-01-01'), on)).toBe('DE_6M_A_1A');
    expect(tenureBandFor(new Date('2024-01-01'), on)).toBe('DE_1A_A_3A');
    expect(tenureBandFor(new Date('2019-01-01'), on)).toBe('MAS_3A');
  });
});

describe('anonimato en el diseño de datos', () => {
  it('Response y Answer no tienen columnas ni llaves foráneas hacia User o Invitation', async () => {
    const cols = await prisma.$queryRaw<{ table_name: string; column_name: string; data_type: string }[]>`
      SELECT table_name, column_name, data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name IN ('Response', 'Answer')`;
    const names = cols.map((c) => c.column_name.toLowerCase());
    expect(names).not.toContain('userid');
    expect(names).not.toContain('invitationid');
    // La única columna con "user" es evaluatedUserId: identifica a quien SE EVALÚA (un líder en 360), nunca a quien responde.
    const userish = names.filter((n) => n.includes('user') || n.includes('invitation') || n.includes('email'));
    expect(userish).toEqual(['evaluateduserid']);

    const fks = await prisma.$queryRaw<{ from_table: string; to_table: string }[]>`
      SELECT c.conrelid::regclass::text AS from_table, c.confrelid::regclass::text AS to_table
      FROM pg_constraint c WHERE c.contype = 'f' AND c.conrelid::regclass::text IN ('"Response"', '"Answer"')`;
    for (const fk of fks) expect(['"User"', '"Invitation"']).not.toContain(fk.to_table);
  });

  it('submittedOn es solo fecha, sin hora', async () => {
    const cols = await prisma.$queryRaw<{ data_type: string }[]>`
      SELECT data_type FROM information_schema.columns WHERE table_name = 'Response' AND column_name = 'submittedOn'`;
    expect(cols[0].data_type).toBe('date');
  });

  it('los identificadores de Response son aleatorios (uuid), no ordenables en el tiempo', async () => {
    const rows = await prisma.response.findMany({ take: 50, select: { id: true } });
    for (const r of rows) expect(r.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('al enviar una encuesta, lo guardado no contiene nada que identifique a la persona', async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'rh@clima.demo' } });
    const worker = await prisma.user.findUniqueOrThrow({ where: { email: 'colaborador01@clima.demo' } });
    const rh = request.agent(app);
    await rh.post('/api/auth/login').send({ email: admin.email, password: 'Demo1234!' }).expect(200);
    const created = await rh.post('/api/surveys').send({
      title: 'Prueba de anonimato', type: 'CLIMA', minGroupSize: 3,
      questions: [{ dimension: 'LIDERAZGO', text: 'Mi jefe me trata con respeto.' }, { dimension: 'PERMANENCIA', text: 'Me veo aquí en un año.' }],
    }).expect(201);
    const surveyId = created.body.survey.id as string;
    try {
      await rh.patch(`/api/surveys/${surveyId}/status`).send({ status: 'ACTIVA' }).expect(200);
      await rh.post(`/api/surveys/${surveyId}/invitations`).expect(201);
      const w = request.agent(app);
      await w.post('/api/auth/login').send({ email: worker.email, password: 'Demo1234!' }).expect(200);
      const list = await w.get('/api/me/invitations').expect(200);
      const inv = list.body.pending.find((i: { surveyTitle: string }) => i.surveyTitle === 'Prueba de anonimato');
      const form = await w.get(`/api/invitations/${inv.id}/form`).expect(200);
      const answers = form.body.dimensions.flatMap((d: { questions: { id: string }[] }) => d.questions.map((q) => ({ questionId: q.id, value: 4 })));
      await w.post(`/api/invitations/${inv.id}/submit`).send({ answers }).expect(201);

      const stored = await prisma.response.findMany({ where: { surveyId }, include: { answers: true } });
      expect(stored).toHaveLength(1);
      const blob = JSON.stringify(stored);
      for (const secret of [worker.id, worker.email, worker.name, inv.id]) expect(blob).not.toContain(secret);
      expect(stored[0].submittedOn.toISOString()).toMatch(/T00:00:00\.000Z$/);
      // La invitación sabe que ya respondió, pero no qué respondió.
      const used = await prisma.invitation.findUniqueOrThrow({ where: { id: inv.id } });
      expect(used.usedAt).not.toBeNull();
      expect(Object.keys(used)).not.toContain('responseId');
    } finally {
      await prisma.survey.delete({ where: { id: surveyId } });
    }
  });
});

describe('ningún endpoint devuelve un corte con menos de k respuestas', () => {
  it('detalle de cada área: cada corte por antigüedad visible tiene al menos k respuestas', async () => {
    const rh = request.agent(app);
    await rh.post('/api/auth/login').send({ email: 'rh@clima.demo', password: 'Demo1234!' }).expect(200);
    const heat = await rh.get('/api/analytics/heatmap').expect(200);
    const k = heat.body.survey.minGroupSize as number;
    for (const row of heat.body.rows) {
      const d = await rh.get(`/api/analytics/areas/${row.areaId}`).expect(200);
      if (d.body.suppressed) continue;
      expect(d.body.responses).toBeGreaterThanOrEqual(k);
      for (const t of d.body.tenure) {
        if (t.suppressed) expect(t.favorable).toBeUndefined();
        else expect(t.responses).toBeGreaterThanOrEqual(k);
      }
    }
  });

  it('una encuesta con muy pocas respuestas devuelve muestra insuficiente en todos los cortes', async () => {
    const rh = request.agent(app);
    await rh.post('/api/auth/login').send({ email: 'rh@clima.demo', password: 'Demo1234!' }).expect(200);
    const created = await rh.post('/api/surveys').send({
      title: 'Prueba de umbral', type: 'CLIMA', minGroupSize: 5,
      questions: [{ dimension: 'LIDERAZGO', text: 'Mi jefe me trata con respeto.' }],
    }).expect(201);
    const surveyId = created.body.survey.id as string;
    try {
      await rh.patch(`/api/surveys/${surveyId}/status`).send({ status: 'ACTIVA' }).expect(200);
      await rh.post(`/api/surveys/${surveyId}/invitations`).expect(201);
      for (const email of ['colaborador01@clima.demo', 'colaborador02@clima.demo']) {
        const w = request.agent(app);
        await w.post('/api/auth/login').send({ email, password: 'Demo1234!' }).expect(200);
        const inv = (await w.get('/api/me/invitations')).body.pending.find((i: { surveyTitle: string }) => i.surveyTitle === 'Prueba de umbral');
        const form = await w.get(`/api/invitations/${inv.id}/form`).expect(200);
        const answers = form.body.dimensions.flatMap((d: { questions: { id: string }[] }) => d.questions.map((q) => ({ questionId: q.id, value: 1 })));
        await w.post(`/api/invitations/${inv.id}/submit`).send({ answers }).expect(201);
      }
      await rh.patch(`/api/surveys/${surveyId}/status`).send({ status: 'CERRADA' }).expect(200);
      const heat = await rh.get(`/api/analytics/heatmap?surveyId=${surveyId}`).expect(200);
      for (const row of heat.body.rows) {
        expect(row.suppressed).toBe(true);
        expect(row.cells).toBeUndefined();
      }
      const overview = await rh.get(`/api/analytics/overview?surveyId=${surveyId}`).expect(200);
      expect(overview.body.globalFavorable).toMatchObject({ suppressed: true, message: INSUFFICIENT_MESSAGE });
      for (const a of overview.body.areas) expect(a.insufficient).toBe(true);
      const someArea = heat.body.rows[0].areaId;
      const detail = await rh.get(`/api/analytics/areas/${someArea}?surveyId=${surveyId}`).expect(200);
      expect(detail.body).toMatchObject({ suppressed: true });
      expect(detail.body.tenure).toBeUndefined();
      expect(detail.body.comments).toBeUndefined();
    } finally {
      await prisma.survey.delete({ where: { id: surveyId } });
    }
  });
});
