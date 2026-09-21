import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { fakerES_MX as faker } from '@faker-js/faker';
import type { Dimension, Prisma, Relation } from '@prisma/client';
import { prisma } from '../src/db.js';
import { dateOnly, tenureBandFor } from '../src/services/anonymity.js';
import { recomputeAlerts } from '../src/services/riskService.js';
import { DIMENSIONS, type Dim } from '../src/services/scoring.js';
import {
  AREAS, CLIMA_SURVEYS, HEADCOUNT, PARTICIPATION, mulberry32, simulateRespondent, turnoverFor, type AreaName,
} from './scenario.js';

faker.seed(42);
const rng = mulberry32(42);
const PASSWORD = 'Demo1234!';
const DOMAIN = 'clima.demo';

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

const QUESTIONS: Record<Dim, string[]> = {
  LIDERAZGO: [
    'Mi jefe inmediato me trata con respeto.',
    'Mi jefe inmediato explica con claridad lo que espera de mi trabajo.',
    'Confío en las decisiones que toma mi jefe inmediato.',
  ],
  COMUNICACION: [
    'Me entero a tiempo de los cambios que afectan mi trabajo.',
    'Puedo decir lo que pienso sin temor a represalias.',
    'La información entre turnos y áreas fluye bien.',
  ],
  RECONOCIMIENTO: [
    'Cuando hago bien mi trabajo, alguien me lo reconoce.',
    'Mi sueldo es justo para lo que hago.',
    'Los ascensos y premios se dan a quien los merece.',
  ],
  CARGA_TRABAJO: [
    'Mi carga de trabajo es razonable.',
    'Tengo el tiempo y las herramientas para hacer bien mi trabajo.',
    'Mis descansos y horarios respetan mi vida personal.',
  ],
  DESARROLLO: [
    'Aquí puedo aprender cosas nuevas.',
    'Conozco qué necesito para crecer dentro de la empresa.',
    'Recibo capacitación útil para mi puesto.',
  ],
  CONDICIONES: [
    'Me siento seguro en mi lugar de trabajo.',
    'El equipo y las instalaciones están en buen estado.',
    'Cuento con el equipo de protección que necesito.',
  ],
  PERMANENCIA: [
    'Me veo trabajando aquí dentro de un año.',
    'Recomendaría esta empresa a un familiar o amigo.',
    'No estoy buscando activamente otro trabajo.',
  ],
};
const OPEN_QUESTION = '¿Qué cambiarías primero para mejorar tu día a día en el trabajo? (opcional)';

const COMMENTS = {
  neg: [
    'Hace falta que el jefe de turno escuche más al personal.',
    'Los cambios de horario nos los avisan el mismo día.',
    'Trabajo mucho y no se nota en el reconocimiento ni en el sueldo.',
    'En el turno de noche nadie de mando revisa cómo estamos.',
    'Se van compañeros y nadie pregunta por qué.',
    'Falta más personal; la carga se reparte mal.',
    'Las promesas de capacitación nunca se cumplen.',
    'Nos cambian de turno sin preguntarnos.',
    'Las horas extra se piden como obligación, no como favor.',
    'Cuando reportamos un problema nadie da respuesta.',
    'El trato del supervisor de noche es distinto al de día.',
    'No sabemos cómo crecer aquí; nadie nos lo explica.',
    'El sueldo no alcanza con la carga que tenemos.',
    'Falta equipo de protección en varias estaciones.',
  ],
  neu: [
    'En general bien, pero mejoraría la comunicación entre turnos.',
    'Más claridad en los objetivos del mes.',
    'Estaría bien tener juntas cortas al inicio del turno.',
    'Mejorar los comedores y las áreas de descanso.',
    'Me gustaría una capacitación más práctica.',
  ],
  pos: [
    'Me gusta el ambiente con mi equipo.',
    'Mi jefe está pendiente y se puede hablar con él.',
    'Seguir con las capacitaciones que hemos tenido.',
    'Todo bien, gracias por preguntar.',
    'Me gusta que se tomen en cuenta nuestras ideas.',
    'Más días de convivencia entre áreas.',
  ],
};

const iso = (s: string) => new Date(`${s}T12:00:00Z`);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

async function reset() {
  await prisma.alertAction.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.answer.deleteMany();
  await prisma.response.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.question.deleteMany();
  await prisma.survey.deleteMany();
  await prisma.turnoverRecord.deleteMany();
  await prisma.riskConfig.deleteMany();
  await prisma.user.updateMany({ data: { supervisorId: null } });
  await prisma.user.deleteMany();
  await prisma.area.deleteMany();
}

async function main() {
  await reset();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // ---- Áreas ----
  const areaIds = {} as Record<AreaName, string>;
  for (const name of AREAS) areaIds[name] = (await prisma.area.create({ data: { name } })).id;

  // ---- Usuarios (~200) con jerarquía ----
  const supervisorsPerArea: Record<AreaName, number> = { Producción: 6, Calidad: 2, Almacén: 3, Mantenimiento: 2, Administrativo: 2 };
  type U = Prisma.UserUncheckedCreateInput;
  const users: U[] = [];
  const leaderIdByArea = {} as Record<AreaName, string>;
  let colabN = 0;

  for (const area of AREAS) {
    const leaderId = randomUUID();
    leaderIdByArea[area] = leaderId;
    users.push({
      id: leaderId, name: faker.person.fullName(), email: `lider.${slug(area)}@${DOMAIN}`, passwordHash, role: 'LIDER',
      areaId: areaIds[area], hireDate: faker.date.between({ from: '2016-01-01', to: '2021-12-31' }),
    });
    const sups: string[] = [];
    for (let i = 1; i <= supervisorsPerArea[area]; i++) {
      const id = randomUUID();
      sups.push(id);
      users.push({
        id, name: faker.person.fullName(), email: `supervisor${i}.${slug(area)}@${DOMAIN}`, passwordHash, role: 'COLABORADOR',
        areaId: areaIds[area], supervisorId: leaderId, hireDate: faker.date.between({ from: '2017-01-01', to: '2023-12-31' }),
      });
    }
    // Personal restante del área (los 2 usuarios de RH cuentan dentro de Administrativo)
    const rest = HEADCOUNT[area] - 1 - sups.length - (area === 'Administrativo' ? 2 : 0);
    for (let i = 0; i < rest; i++) {
      colabN += 1;
      users.push({
        id: randomUUID(), name: faker.person.fullName(), email: `colaborador${String(colabN).padStart(2, '0')}@${DOMAIN}`, passwordHash,
        role: 'COLABORADOR', areaId: areaIds[area], supervisorId: sups.length ? pick(sups) : leaderId,
        hireDate: faker.date.between({ from: '2016-06-01', to: '2026-08-15' }),
      });
    }
  }
  for (let i = 1; i <= 2; i++) {
    users.push({
      id: randomUUID(), name: faker.person.fullName(), email: i === 1 ? `rh@${DOMAIN}` : `rh2@${DOMAIN}`, passwordHash, role: 'RH',
      areaId: areaIds.Administrativo, supervisorId: leaderIdByArea.Administrativo, hireDate: faker.date.between({ from: '2016-01-01', to: '2022-12-31' }),
    });
  }
  // Los jefes primero para respetar la clave foránea del supervisor
  const rank = (u: U) => (u.supervisorId ? 1 : 0);
  await prisma.user.createMany({ data: users.filter((u) => rank(u) === 0) });
  await prisma.user.createMany({ data: users.filter((u) => rank(u) === 1) });
  const dbUsers = await prisma.user.findMany({ orderBy: { email: 'asc' } }); // orden fijo: el seed es reproducible
  console.log(`Usuarios creados: ${dbUsers.length}`);

  // ---- Configuración de riesgo y rotación histórica ----
  await prisma.riskConfig.create({
    data: {
      id: 1,
      weights: { PERMANENCIA: 30, LIDERAZGO: 20, COMUNICACION: 15, RECONOCIMIENTO: 10, CARGA_TRABAJO: 10, TENDENCIA: 10, ROTACION: 5 },
      levels: { medio: 40, alto: 60, critico: 75 },
    },
  });
  const turnoverData: Prisma.TurnoverRecordCreateManyInput[] = [];
  for (const area of AREAS) {
    turnoverFor(area, rng).forEach((t, i) => {
      turnoverData.push({ areaId: areaIds[area], month: new Date(Date.UTC(2025, 9 + i, 1)), ...t }); // oct 2025 a sep 2026
    });
  }
  await prisma.turnoverRecord.createMany({ data: turnoverData });

  // ---- Encuestas de clima cerradas ----
  for (let idx = 0; idx < CLIMA_SURVEYS.length; idx++) {
    const def = CLIMA_SURVEYS[idx];
    const closes = iso(def.closesAt);
    const opens = addDays(closes, -21);
    const survey = await prisma.survey.create({ data: { title: def.title, type: 'CLIMA', status: 'CERRADA', opensAt: opens, closesAt: closes, minGroupSize: 5 } });
    const qRows: { id: string; dimension: Dimension; text: string; type: 'LIKERT_5' | 'ABIERTA'; order: number }[] = [];
    let order = 1;
    for (const d of DIMENSIONS) for (const text of QUESTIONS[d]) qRows.push({ id: randomUUID(), dimension: d, text, type: 'LIKERT_5', order: order++ });
    const openQ = { id: randomUUID(), dimension: 'PERMANENCIA' as Dimension, text: OPEN_QUESTION, type: 'ABIERTA' as const, order: order++ };
    qRows.push(openQ);
    await prisma.question.createMany({ data: qRows.map((q) => ({ ...q, surveyId: survey.id })) });
    const likertByDim = new Map<Dim, string[]>(DIMENSIONS.map((d) => [d, qRows.filter((q) => q.type === 'LIKERT_5' && q.dimension === d).map((q) => q.id)]));

    const invitations: Prisma.InvitationCreateManyInput[] = [];
    const responses: Prisma.ResponseCreateManyInput[] = [];
    const answers: Prisma.AnswerCreateManyInput[] = [];
    const eligibleAfter = addDays(closes, -30);
    for (const u of dbUsers) {
      if (u.hireDate > eligibleAfter) continue; // aún no trabajaba aquí
      const area = AREAS.find((a) => areaIds[a] === u.areaId) as AreaName;
      const responds = rng() < PARTICIPATION[area];
      const on = dateOnly(addDays(opens, Math.floor(rng() * 20)));
      invitations.push({ surveyId: survey.id, userId: u.id, usedAt: responds ? on : null });
      if (!responds) continue;
      const vals = simulateRespondent(area, idx, 3, rng);
      const responseId = randomUUID();
      responses.push({ id: responseId, surveyId: survey.id, areaId: u.areaId, tenureBand: tenureBandFor(u.hireDate, on), submittedOn: on });
      let total = 0, count = 0;
      for (const d of DIMENSIONS) {
        const ids = likertByDim.get(d) as string[];
        vals[d].forEach((v, i) => { answers.push({ id: randomUUID(), responseId, questionId: ids[i], value: v }); total += v; count += 1; });
      }
      if (rng() < 0.35) {
        const avg = total / count;
        const pool = avg < 3 ? COMMENTS.neg : avg < 3.7 ? COMMENTS.neu : COMMENTS.pos;
        answers.push({ id: randomUUID(), responseId, questionId: openQ.id, text: pick(pool) });
      }
    }
    await prisma.invitation.createMany({ data: invitations });
    // Se insertan en orden aleatorio para que el orden físico no delate quién respondió primero.
    await prisma.response.createMany({ data: shuffle(responses) });
    await prisma.answer.createMany({ data: shuffle(answers) });
    console.log(`${def.title}: ${responses.length} respuestas de ${invitations.length} invitaciones`);
  }

  // ---- Evaluación 360 cerrada (k = 3) ----
  const closes360 = iso('2026-08-28');
  const s360 = await prisma.survey.create({
    data: { title: 'Evaluación 360 de líderes, 2026', type: 'EVAL_360', status: 'CERRADA', opensAt: addDays(closes360, -21), closesAt: closes360, minGroupSize: 3 },
  });
  const dims360: Dim[] = ['LIDERAZGO', 'COMUNICACION', 'RECONOCIMIENTO', 'DESARROLLO', 'CARGA_TRABAJO'];
  const q360: { id: string; dimension: Dim }[] = [];
  let o = 1;
  const qData: Prisma.QuestionCreateManyInput[] = [];
  for (const d of dims360) for (const text of QUESTIONS[d].slice(0, 2)) {
    const id = randomUUID(); q360.push({ id, dimension: d });
    qData.push({ id, surveyId: s360.id, dimension: d, text: text.replace('Mi jefe inmediato', 'Esta persona').replace('mi jefe inmediato', 'esta persona'), type: 'LIKERT_5', order: o++ });
  }
  await prisma.question.createMany({ data: qData });
  const teamMean: Record<AreaName, number> = { Producción: 2.3, Calidad: 3.8, Almacén: 3.4, Mantenimiento: 4.2, Administrativo: 3.9 };
  const autoMean: Record<AreaName, number> = { Producción: 4.3, Calidad: 4.1, Almacén: 4.0, Mantenimiento: 4.3, Administrativo: 4.2 };
  const gaussv = () => Math.sqrt(-2 * Math.log(Math.max(rng(), 1e-9))) * Math.cos(2 * Math.PI * rng());
  const inv360: Prisma.InvitationCreateManyInput[] = [];
  const resp360: Prisma.ResponseCreateManyInput[] = [];
  const ans360: Prisma.AnswerCreateManyInput[] = [];
  const leaders = dbUsers.filter((u) => u.role === 'LIDER');
  const on360 = () => dateOnly(addDays(closes360, -Math.floor(rng() * 18) - 1));
  for (const L of leaders) {
    const area = AREAS.find((a) => areaIds[a] === L.areaId) as AreaName;
    const raters: { user: (typeof dbUsers)[number]; relation: Relation; mean: number; p: number }[] = [
      { user: L, relation: 'AUTO', mean: autoMean[area], p: 1 },
      ...dbUsers.filter((u) => u.areaId === L.areaId && u.id !== L.id && u.role !== 'RH').map((u) => ({ user: u, relation: 'SUPERVISOR' as Relation, mean: teamMean[area], p: 0.6 })),
      ...leaders.filter((p) => p.id !== L.id).map((p) => ({ user: p, relation: 'PAR' as Relation, mean: teamMean[area] + 0.3, p: 1 })),
    ];
    for (const r of raters) {
      if (r.user.hireDate > addDays(closes360, -30)) continue;
      const responds = rng() < r.p;
      const on = on360();
      inv360.push({ surveyId: s360.id, userId: r.user.id, evaluatedUserId: L.id, relation: r.relation, usedAt: responds ? on : null });
      if (!responds) continue;
      const responseId = randomUUID();
      resp360.push({ id: responseId, surveyId: s360.id, areaId: r.user.areaId, tenureBand: tenureBandFor(r.user.hireDate, on), evaluatedUserId: L.id, relation: r.relation, submittedOn: on });
      const bias = gaussv() * 0.3;
      for (const q of q360) {
        const v = Math.round(Math.min(5, Math.max(1, r.mean + bias + gaussv() * 0.6)));
        ans360.push({ id: randomUUID(), responseId, questionId: q.id, value: v });
      }
    }
  }
  await prisma.invitation.createMany({ data: inv360 });
  await prisma.response.createMany({ data: shuffle(resp360) });
  await prisma.answer.createMany({ data: shuffle(ans360) });
  console.log(`Evaluación 360: ${resp360.length} respuestas`);

  // ---- Riesgo y alertas de la encuesta de clima más reciente ----
  const latest = await prisma.survey.findFirstOrThrow({ where: { type: 'CLIMA', status: 'CERRADA' }, orderBy: { closesAt: 'desc' } });
  const risks = await recomputeAlerts(latest.id);
  for (const r of risks) console.log(`  ${r.areaName}: ${r.result.score?.toFixed(1)} ${r.result.level}`);
  console.log('Listo. Entra con rh@clima.demo y la contraseña Demo1234!');
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
