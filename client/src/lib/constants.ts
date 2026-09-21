import type { AlertStatus, Level } from './types';

export const LIKERT_LABELS = [
  'Muy en desacuerdo', 'En desacuerdo', 'Ni de acuerdo ni en desacuerdo', 'De acuerdo', 'Muy de acuerdo',
];

export const ROLE_LABELS = { RH: 'Recursos Humanos', LIDER: 'Líder de área', COLABORADOR: 'Colaborador' } as const;

export const STATUS_LABELS: Record<AlertStatus, string> = {
  NUEVA: 'Nueva', EN_SEGUIMIENTO: 'En seguimiento', ATENDIDA: 'Atendida', DESCARTADA: 'Descartada',
};

export const LEVEL_LABELS: Record<Level, string> = {
  BAJO: 'Riesgo bajo', MEDIO: 'En observación', ALTO: 'Riesgo alto', CRITICO: 'Riesgo crítico',
};

export const SURVEY_STATUS_LABELS = { BORRADOR: 'Borrador', ACTIVA: 'Activa', CERRADA: 'Cerrada' } as const;
export const SURVEY_TYPE_LABELS = { CLIMA: 'Clima laboral', EVAL_360: 'Evaluación 360' } as const;
export const RELATION_LABELS = { AUTO: 'Autoevaluación', SUPERVISOR: 'Equipo', PAR: 'Pares' } as const;

export const DIMENSIONS = [
  ['LIDERAZGO', 'Liderazgo'], ['COMUNICACION', 'Comunicación'], ['RECONOCIMIENTO', 'Reconocimiento'],
  ['CARGA_TRABAJO', 'Carga de trabajo'], ['DESARROLLO', 'Desarrollo'], ['CONDICIONES', 'Condiciones'], ['PERMANENCIA', 'Permanencia'],
] as const;

export const SAMPLE_QUESTIONS: Record<string, string[]> = {
  LIDERAZGO: ['Mi jefe inmediato me trata con respeto.', 'Mi jefe inmediato explica con claridad lo que espera de mi trabajo.', 'Confío en las decisiones que toma mi jefe inmediato.'],
  COMUNICACION: ['Me entero a tiempo de los cambios que afectan mi trabajo.', 'Puedo decir lo que pienso sin temor a represalias.', 'La información entre turnos y áreas fluye bien.'],
  RECONOCIMIENTO: ['Cuando hago bien mi trabajo, alguien me lo reconoce.', 'Mi sueldo es justo para lo que hago.', 'Los ascensos y premios se dan a quien los merece.'],
  CARGA_TRABAJO: ['Mi carga de trabajo es razonable.', 'Tengo el tiempo y las herramientas para hacer bien mi trabajo.', 'Mis descansos y horarios respetan mi vida personal.'],
  DESARROLLO: ['Aquí puedo aprender cosas nuevas.', 'Conozco qué necesito para crecer dentro de la empresa.', 'Recibo capacitación útil para mi puesto.'],
  CONDICIONES: ['Me siento seguro en mi lugar de trabajo.', 'El equipo y las instalaciones están en buen estado.', 'Cuento con el equipo de protección que necesito.'],
  PERMANENCIA: ['Me veo trabajando aquí dentro de un año.', 'Recomendaría esta empresa a un familiar o amigo.', 'No estoy buscando activamente otro trabajo.'],
};

/** Rangos del mapa de calor (% favorable). */
export function heatStep(v: number): 1 | 2 | 3 | 4 | 5 {
  return v >= 80 ? 5 : v >= 65 ? 4 : v >= 50 ? 3 : v >= 35 ? 2 : 1;
}
export const HEAT_BG: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'bg-heat-1', 2: 'bg-heat-2', 3: 'bg-heat-3', 4: 'bg-heat-4', 5: 'bg-heat-5',
};
export const HEAT_LEGEND: [1 | 2 | 3 | 4 | 5, string][] = [
  [1, 'Menos de 35 %'], [2, '35 a 49 %'], [3, '50 a 64 %'], [4, '65 a 79 %'], [5, '80 % o más'],
];
