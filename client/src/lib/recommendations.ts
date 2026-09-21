import type { Heatmap, Overview } from './types';

export type Severity = 'CRITICO' | 'ALTO' | 'MEDIO';

export interface Recommendation {
  id: string;
  areaId: string;
  areaName: string;
  severity: Severity;
  title: string;
  detail: string;
}

const SEVERITY_ORDER: Record<Severity, number> = { CRITICO: 0, ALTO: 1, MEDIO: 2 };

function favorableOf(cells: { dimension: string; favorable: number | null }[], dimension: string): number | null {
  return cells.find((c) => c.dimension === dimension)?.favorable ?? null;
}

/**
 * Reglas de negocio ligadas a liderazgo, evaluadas sobre los porcentajes reales de la
 * encuesta (nada de cifras fijas en la interfaz). Devuelve como máximo 6 recomendaciones,
 * ordenadas por severidad.
 */
export function buildRecommendations(heat: Heatmap, overviewAreas: Overview['areas']): Recommendation[] {
  const out: Recommendation[] = [];

  for (const row of heat.rows) {
    if (row.suppressed) continue;
    const permanencia = favorableOf(row.cells, 'PERMANENCIA');
    const carga = favorableOf(row.cells, 'CARGA_TRABAJO');
    const liderazgo = favorableOf(row.cells, 'LIDERAZGO');
    const comunicacion = favorableOf(row.cells, 'COMUNICACION');
    const reconocimiento = favorableOf(row.cells, 'RECONOCIMIENTO');

    if (permanencia !== null && carga !== null && permanencia < 20 && carga < 30) {
      out.push({
        id: `${row.areaId}-permanencia-carga`, areaId: row.areaId, areaName: row.areaName, severity: 'CRITICO',
        title: `Riesgo crítico de rotación en ${row.areaName}`,
        detail: `Permanencia favorable de ${Math.round(permanencia)} % y carga de trabajo favorable de ${Math.round(carga)} %, ambas muy por debajo de lo saludable. Prioriza un plan de retención y una revisión de cargas antes de la próxima encuesta.`,
      });
    }
    if (liderazgo !== null && liderazgo < 35) {
      out.push({
        id: `${row.areaId}-liderazgo`, areaId: row.areaId, areaName: row.areaName, severity: 'ALTO',
        title: `Reforzar liderazgo en ${row.areaName}`,
        detail: `Solo ${Math.round(liderazgo)} % responde favorablemente sobre liderazgo. Agenda retroalimentación y acompañamiento para los jefes inmediatos del área.`,
      });
    }
    if (comunicacion !== null && comunicacion < 35) {
      out.push({
        id: `${row.areaId}-comunicacion`, areaId: row.areaId, areaName: row.areaName, severity: 'ALTO',
        title: `Mejorar comunicación en ${row.areaName}`,
        detail: `${Math.round(comunicacion)} % favorable en comunicación. Revisa cómo se informan los cambios y abre un canal de dudas para el área.`,
      });
    }
    if (reconocimiento !== null && reconocimiento < 35) {
      out.push({
        id: `${row.areaId}-reconocimiento`, areaId: row.areaId, areaName: row.areaName, severity: 'MEDIO',
        title: `Reconocer al equipo de ${row.areaName}`,
        detail: `${Math.round(reconocimiento)} % favorable en reconocimiento. Considera un mecanismo simple y visible de reconocimiento por logros del área.`,
      });
    }
  }

  // Áreas en riesgo alto o crítico que ninguna regla anterior cubrió: se agregan con su driver principal.
  const covered = new Set(out.map((r) => r.areaId));
  for (const a of overviewAreas) {
    if (a.insufficient || !a.level || covered.has(a.areaId)) continue;
    if (a.level === 'ALTO' || a.level === 'CRITICO') {
      const top = a.drivers[0];
      out.push({
        id: `${a.areaId}-riesgo`, areaId: a.areaId, areaName: a.areaName, severity: a.level,
        title: `Atender ${a.areaName}: ${a.level === 'CRITICO' ? 'riesgo crítico' : 'riesgo alto'} de rotación`,
        detail: top
          ? `Índice de ${a.score?.toFixed(1)}. El factor que más pesa es ${top.label.toLowerCase()} (+${top.contribution.toFixed(1)} pts).`
          : `Índice de ${a.score?.toFixed(1)}.`,
      });
    }
  }

  return out
    .sort((x, y) => SEVERITY_ORDER[x.severity] - SEVERITY_ORDER[y.severity] || x.areaName.localeCompare(y.areaName, 'es'))
    .slice(0, 6);
}
