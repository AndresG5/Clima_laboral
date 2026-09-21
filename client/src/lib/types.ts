export type Role = 'RH' | 'LIDER' | 'COLABORADOR';
export type Level = 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO';
export type AlertStatus = 'NUEVA' | 'EN_SEGUIMIENTO' | 'ATENDIDA' | 'DESCARTADA';
export type Suppressed = { suppressed: true; message: string };

export interface Me { id: string; name: string; email: string; role: Role; area: { id: string; name: string } }

export interface SurveyListItem {
  id: string; title: string; type: 'CLIMA' | 'EVAL_360'; status: 'BORRADOR' | 'ACTIVA' | 'CERRADA';
  opensAt: string | null; closesAt: string | null; minGroupSize: number; questionCount: number;
  invitationCount?: number; completedCount?: number;
}

export interface InvitationItem {
  id: string; surveyTitle: string; surveyType: 'CLIMA' | 'EVAL_360'; closesAt: string | null;
  relation: 'AUTO' | 'SUPERVISOR' | 'PAR' | null; evaluatedName: string | null; completed: boolean;
}

export interface FormDef {
  invitation: { id: string; surveyTitle: string; surveyType: 'CLIMA' | 'EVAL_360'; relation: 'AUTO' | 'SUPERVISOR' | 'PAR' | null; evaluatedName: string | null };
  dimensions: { dimension: string; label: string; questions: { id: string; text: string; type: 'LIKERT_5' | 'ABIERTA' }[] }[];
}

export interface Overview {
  survey: { id: string; title: string; status: string; closesAt: string | null; minGroupSize: number };
  participation: { invited: number; completed: number; pct: number };
  globalFavorable: Suppressed | { suppressed: false; value: number | null };
  trend: { previousTitle: string; previous: number | null; delta: number | null } | null;
  areas: { areaId: string; areaName: string; insufficient: boolean; score: number | null; level: Level | null;
    drivers: { key: string; label: string; contribution: number }[] }[];
}

export interface HeatCell {
  dimension: string; n: number; favorable: number | null; neutral: number | null; desfavorable: number | null;
  delta: number | null; deltaAvailable: boolean;
}
export interface Heatmap {
  survey: { id: string; title: string; minGroupSize: number };
  previousSurvey: { id: string; title: string } | null;
  dimensions: { dimension: string; label: string }[];
  companyAverage: { dimension: string; favorable: number | null; neutral: number | null; desfavorable: number | null }[];
  rows: ({ areaId: string; areaName: string; suppressed: true; message: string } |
    { areaId: string; areaName: string; suppressed: false; responses: number; cells: HeatCell[] })[];
}

export interface TrendAll {
  areas: { id: string; name: string }[];
  points: {
    surveyId: string; title: string; closesAt: string | null; global: number | null;
    areas: { areaId: string; areaName: string; favorable: number | null; suppressed: boolean }[];
  }[];
}

export interface Participation {
  survey: { id: string; title: string; minGroupSize: number };
  areas: { areaId: string; areaName: string; invited: number; completed: number | null; pct: number | null; suppressed: boolean }[];
}

export interface TrendPoint { surveyId: string; title: string; closesAt: string | null; favorable: number | null; suppressed?: boolean }

export type AreaDetail =
  | { area: { id: string; name: string }; survey: { id: string; title: string; minGroupSize: number }; suppressed: true; message: string }
  | {
    area: { id: string; name: string }; survey: { id: string; title: string; minGroupSize: number }; suppressed: false;
    responses: number; globalFavorable: number | null;
    dimensions: { dimension: string; label: string; favorable: number | null }[];
    trend: TrendPoint[];
    tenure: ({ band: string; label: string } & (Suppressed | { suppressed: false; responses: number; favorable: number | null }))[];
    comments: string[];
    risk: null | {
      score: number; level: Level;
      components: { key: string; label: string; weight: number; raw: number; contribution: number }[];
      drivers: { key: string; label: string; contribution: number }[];
    };
  };

export interface Report360 {
  leader: { id: string; name: string; areaName: string };
  survey: { id: string; title: string; minGroupSize: number };
  groups: { relation: 'AUTO' | 'SUPERVISOR' | 'PAR'; label: string; suppressed: boolean; responses?: number; message?: string }[];
  dimensions: { dimension: string; label: string; auto: number | null; team: number | null; peers: number | null; gapTeam: number | null; gapPeers: number | null }[];
}

export interface AlertItem {
  id: string; surveyId: string; surveyTitle: string; areaId: string; areaName: string; level: 'ALTO' | 'CRITICO';
  riskScore: number; drivers: { key: string; label: string; contribution: number; raw: number; weight: number }[];
  status: AlertStatus; createdAt: string; closedAt: string | null; actionCount: number;
  actions?: { id: string; description: string; dueDate: string | null; doneAt: string | null; createdByName: string }[];
}

export interface RiskConfig {
  weights: Record<string, number>; levels: { medio: number; alto: number; critico: number };
  labels: Record<string, string>; defaults: { weights: Record<string, number>; levels: { medio: number; alto: number; critico: number } };
}
