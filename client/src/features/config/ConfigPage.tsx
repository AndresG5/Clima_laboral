import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Save } from 'lucide-react';
import { api } from '../../lib/api';
import type { RiskConfig } from '../../lib/types';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { ErrorNote, Field, Input, Loading, PageHeader, Panel } from '../../components/ui';

const ORDER = ['PERMANENCIA', 'LIDERAZGO', 'COMUNICACION', 'RECONOCIMIENTO', 'CARGA_TRABAJO', 'TENDENCIA', 'ROTACION'];

export function ConfigPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['risk-config'], queryFn: () => api.get<RiskConfig>('/config/risk') });
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [levels, setLevels] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!q.data) return;
    setWeights(Object.fromEntries(Object.entries(q.data.weights).map(([k, v]) => [k, String(v)])));
    setLevels(Object.fromEntries(Object.entries(q.data.levels).map(([k, v]) => [k, String(v)])));
  }, [q.data]);

  const w = Object.fromEntries(ORDER.map((k) => [k, Number(weights[k] ?? 0)]));
  const l = { medio: Number(levels.medio), alto: Number(levels.alto), critico: Number(levels.critico) };
  const sum = ORDER.reduce((a, k) => a + (Number.isFinite(w[k]) ? w[k] : 0), 0);
  const weightsOk = Math.abs(sum - 100) < 0.001 && ORDER.every((k) => Number.isFinite(w[k]) && w[k] >= 0);
  const levelsOk = l.medio > 0 && l.medio < l.alto && l.alto < l.critico && l.critico <= 100;

  const save = useMutation({
    mutationFn: () => api.put('/config/risk', { weights: w, levels: l }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['risk-config'] }); toast('Cambios guardados'); },
  });
  const recompute = useMutation({
    mutationFn: () => api.post('/risk/recompute'),
    onSuccess: () => { qc.invalidateQueries(); toast('Riesgo recalculado'); },
  });

  if (q.isLoading) return <Loading />;
  if (q.isError) return <ErrorNote error={q.error} />;
  const cfg = q.data!;

  return (
    <>
      <PageHeader title="Configuración del modelo de riesgo">
        El índice es ponderado y explicable, no aprendizaje automático. Los pesos son supuestos de trabajo y no están calibrados con datos reales.
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Pesos del índice" actions={<span className={`tabular font-semibold ${weightsOk ? 'text-verde-texto' : 'text-rojo-texto'}`}>Suman {Number.isFinite(sum) ? sum : 0} %</span>}>
          <div className="grid gap-4 sm:grid-cols-2">
            {ORDER.map((k) => (
              <Field key={k} label={cfg.labels[k]} error={weights[k] !== undefined && (!Number.isFinite(w[k]) || w[k] < 0) ? 'Escribe un número de 0 o más.' : undefined}>
                {(id, d) => <Input id={id} type="number" inputMode="decimal" min={0} max={100} step="any" value={weights[k] ?? ''} aria-describedby={d} onChange={(e) => setWeights((s) => ({ ...s, [k]: e.target.value }))} className="tabular" />}
              </Field>
            ))}
          </div>
          {!weightsOk && <p role="alert" className="mt-3 text-rojo-texto">Los pesos suman {Number.isFinite(sum) ? sum : 0} %. Ajusta los valores hasta que sumen 100 %.</p>}
        </Panel>

        <Panel title="Umbrales de nivel">
          <div className="grid gap-4 sm:grid-cols-3">
            {([['medio', 'Observación desde'], ['alto', 'Alto desde'], ['critico', 'Crítico desde']] as const).map(([k, label]) => (
              <Field key={k} label={label}>
                {(id) => <Input id={id} type="number" min={1} max={100} step="any" value={levels[k] ?? ''} onChange={(e) => setLevels((s) => ({ ...s, [k]: e.target.value }))} className="tabular" />}
              </Field>
            ))}
          </div>
          <p className="measure mt-3 text-[13px] leading-5 text-acero">Por debajo de "en observación" el riesgo es bajo. Solo riesgo alto y crítico generan alerta. Deben cumplir: observación menor que alto, alto menor que crítico, y crítico de 100 o menos.</p>
          {!levelsOk && <p role="alert" className="mt-3 text-rojo-texto">Los umbrales no tienen un orden válido. Usa valores crecientes, por ejemplo 40, 60 y 75.</p>}
        </Panel>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button disabled={!weightsOk || !levelsOk || save.isPending} onClick={() => save.mutate()} icon={<Save className="h-4 w-4" aria-hidden="true" />}>Guardar cambios</Button>
        <Button variant="secondary" disabled={recompute.isPending} onClick={() => recompute.mutate()} icon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}>Recalcular riesgo</Button>
        <Button variant="quiet" onClick={() => { setWeights(Object.fromEntries(Object.entries(cfg.defaults.weights).map(([k, v]) => [k, String(v)]))); setLevels(Object.fromEntries(Object.entries(cfg.defaults.levels).map(([k, v]) => [k, String(v)]))); }}>Restablecer valores iniciales</Button>
      </div>
      <p className="measure mt-2 text-[13px] leading-5 text-acero">Guardar no cambia los resultados por sí solo: usa "Recalcular riesgo" para aplicar los pesos a la encuesta de clima más reciente.</p>
      <div className="mt-4 flex flex-col gap-3">
        {save.isError && <ErrorNote error={save.error} />}
        {recompute.isError && <ErrorNote error={recompute.error} />}
      </div>
    </>
  );
}
