import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowUp, ArrowUpDown, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { HEAT_BG, HEAT_LEGEND, heatStep } from '../lib/constants';
import type { Heatmap as HeatmapData } from '../lib/types';
import { Insufficient } from './ui';

type Row = HeatmapData['rows'][number];
type OpenRow = Extract<Row, { suppressed: false }>;

function bestWorst(row: OpenRow): { best: string | null; worst: string | null } {
  const withVal = row.cells.filter((c): c is OpenRow['cells'][number] & { favorable: number } => c.favorable !== null);
  if (withVal.length < 2) return { best: null, worst: null };
  const best = withVal.reduce((a, b) => (b.favorable > a.favorable ? b : a));
  const worst = withVal.reduce((a, b) => (b.favorable < a.favorable ? b : a));
  return { best: best.dimension, worst: worst.dimension };
}

/** Mapa de calor áreas x dimensiones, hecho a mano con tabla y CSS. La cifra siempre va escrita. */
export function Heatmap({ data, selectedAreaId, dimensionFilter, onSelectArea }: {
  data: HeatmapData;
  selectedAreaId?: string | null;
  dimensionFilter?: string | null;
  onSelectArea: (areaId: string) => void;
}) {
  const reduce = useReducedMotion();
  const [sort, setSort] = useState<{ dim: string; dir: 1 | -1 } | null>(null);
  const dims = dimensionFilter ? data.dimensions.filter((d) => d.dimension === dimensionFilter) : data.dimensions;

  const rows = useMemo(() => {
    if (!sort) return data.rows;
    const arr = [...data.rows];
    arr.sort((a, b) => {
      if (a.suppressed || b.suppressed) return a.suppressed === b.suppressed ? 0 : a.suppressed ? 1 : -1;
      const av = a.cells.find((c) => c.dimension === sort.dim)?.favorable;
      const bv = b.cells.find((c) => c.dimension === sort.dim)?.favorable;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      return (av - bv) * sort.dir;
    });
    return arr;
  }, [data.rows, sort]);

  const toggleSort = (dim: string) => setSort((s) => (s?.dim === dim ? (s.dir === 1 ? { dim, dir: -1 } : null) : { dim, dir: 1 }));

  let i = 0;
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="tabular w-full min-w-[720px] border-separate border-spacing-1 text-sm">
          <caption className="sr-only">Porcentaje de respuestas favorables por área y dimensión, con cambio contra la encuesta anterior</caption>
          <thead>
            <tr>
              <th scope="col" className="w-40 p-0" />
              {dims.map((d) => {
                const active = sort?.dim === d.dimension;
                return (
                  <th key={d.dimension} scope="col" className="px-1 pb-1 text-left align-bottom text-xs font-medium leading-4 text-acero">
                    <button
                      type="button" onClick={() => toggleSort(d.dimension)}
                      className="inline-flex items-center gap-1 rounded-sm hover:text-tinta focus-visible:text-tinta"
                      aria-label={`Ordenar por ${d.label}`}
                    >
                      {d.label}
                      {active
                        ? (sort!.dir === 1 ? <ArrowUp className="h-3 w-3" aria-hidden="true" /> : <ArrowDown className="h-3 w-3" aria-hidden="true" />)
                        : <ArrowUpDown className="h-3 w-3 opacity-40" aria-hidden="true" />}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const bw = !row.suppressed ? bestWorst(row) : { best: null, worst: null };
              return (
                <tr key={row.areaId} className={selectedAreaId === row.areaId ? 'bg-azul-tinte/40' : undefined}>
                  <th scope="row" className="pr-2 text-left align-top font-semibold">
                    <button
                      type="button" onClick={() => onSelectArea(row.areaId)}
                      className="rounded-sm text-left text-tinta underline decoration-borde-suave underline-offset-4 hover:decoration-azul-plano focus-visible:decoration-azul-plano"
                    >
                      {row.areaName}
                    </button>
                    {!row.suppressed && <span className="block text-xs font-normal leading-4 text-acero">{row.responses} respuestas</span>}
                  </th>
                  {row.suppressed ? (
                    <td colSpan={dims.length} className="rounded-sm border border-dashed border-acero bg-superficie px-3 py-3">
                      <Insufficient message={row.message} />
                    </td>
                  ) : (
                    dims.map((d) => {
                      const c = row.cells.find((x) => x.dimension === d.dimension)!;
                      const idx = i++;
                      const isBest = bw.best === c.dimension;
                      const isWorst = bw.worst === c.dimension;
                      const descId = `cell-${row.areaId}-${c.dimension}`;
                      const DeltaIcon = c.delta === null ? null : c.delta > 0 ? TrendingUp : c.delta < 0 ? TrendingDown : Minus;
                      return (
                        <motion.td
                          key={c.dimension}
                          className={[
                            'h-14 rounded-sm p-0 text-center font-medium',
                            c.favorable === null ? 'bg-superficie text-acero' : HEAT_BG[heatStep(c.favorable)],
                            isBest ? 'ring-2 ring-inset ring-verde-seguridad' : '',
                            isWorst ? 'ring-2 ring-inset ring-rojo-paro' : '',
                          ].join(' ')}
                          initial={reduce ? false : { opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: reduce ? 0 : idx * 0.012, ease: 'easeOut' }}
                        >
                          <button
                            type="button" aria-describedby={descId}
                            className="flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-azul-plano"
                          >
                            <span>{c.favorable === null ? 'Sin dato' : `${Math.round(c.favorable)} %`}</span>
                            {c.delta !== null && DeltaIcon && (
                              <span className={`inline-flex items-center gap-0.5 text-[11px] font-normal ${c.delta > 0 ? 'text-verde-texto' : c.delta < 0 ? 'text-rojo-texto' : 'text-acero'}`}>
                                <DeltaIcon className="h-3 w-3" aria-hidden="true" />{c.delta > 0 ? '+' : ''}{c.delta}
                              </span>
                            )}
                          </button>
                          <span id={descId} className="sr-only">
                            {row.areaName}, {d.label}: {c.favorable === null ? 'sin dato' : `${c.favorable} % favorable, ${c.neutral} % neutral, ${c.desfavorable} % desfavorable, sobre ${c.n} respuestas`}.
                            {c.deltaAvailable ? (c.delta === null ? '' : ` Cambio de ${c.delta > 0 ? '+' : ''}${c.delta} puntos contra la encuesta anterior.`) : ' Sin encuesta anterior para comparar.'}
                            {isBest ? ' Mejor dimensión del área.' : ''}{isWorst ? ' Peor dimensión del área.' : ''}
                          </span>
                        </motion.td>
                      );
                    })
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium leading-4 text-acero" aria-label="Leyenda de rangos">
        {HEAT_LEGEND.map(([step, label]) => (
          <li key={step} className="inline-flex items-center gap-1.5">
            <span className={`h-3.5 w-6 rounded-sm ${HEAT_BG[step]}`} aria-hidden="true" />
            {label}
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-sm ring-2 ring-inset ring-verde-seguridad" aria-hidden="true" />Mejor dimensión del área</li>
        <li className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-sm ring-2 ring-inset ring-rojo-paro" aria-hidden="true" />Peor dimensión del área</li>
      </ul>
    </div>
  );
}
