import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { CalendarDays, Check, Plus } from 'lucide-react';
import { api, qs } from '../../lib/api';
import { STATUS_LABELS } from '../../lib/constants';
import { fmtDate } from '../../lib/format';
import type { AlertItem, AlertStatus } from '../../lib/types';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { RiskBadge } from '../../components/RiskBadge';
import { useToast } from '../../components/Toast';
import { ErrorNote, Field, Input, Loading, PageHeader, Panel, Select, StatusPill, Textarea } from '../../components/ui';

const actionSchema = z.object({
  description: z.string().trim().min(5, 'Describe la acción con al menos 5 caracteres.').max(500, 'Usa 500 caracteres o menos.'),
  dueDate: z.string().optional(),
});
type ActionForm = z.infer<typeof actionSchema>;

function AlertDetail({ id, mode }: { id: string; mode: 'rh' | 'lider' }) {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['alert', id], queryFn: async () => (await api.get<{ alert: AlertItem }>(`/alerts/${id}`)).alert });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['alert', id] }); qc.invalidateQueries({ queryKey: ['alerts'] }); };
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ActionForm>({ resolver: zodResolver(actionSchema) });
  const [status, setStatus] = useState<AlertStatus>('NUEVA');
  useEffect(() => { if (q.data) setStatus(q.data.status); }, [q.data]);

  const addAction = useMutation({
    mutationFn: (v: ActionForm) => api.post(`/alerts/${id}/actions`, { description: v.description, dueDate: v.dueDate ? new Date(`${v.dueDate}T12:00:00`).toISOString() : null }),
    onSuccess: () => { reset(); refresh(); toast('Acción registrada'); },
  });
  const toggle = useMutation({
    mutationFn: ({ actionId, done }: { actionId: string; done: boolean }) => api.patch(`/alerts/${id}/actions/${actionId}`, { done }),
    onSuccess: refresh,
  });
  const saveStatus = useMutation({
    mutationFn: () => api.patch(`/alerts/${id}`, { status }),
    onSuccess: () => { refresh(); toast('Estado actualizado'); },
  });

  if (q.isLoading) return <Loading />;
  if (q.isError) return <ErrorNote error={q.error} />;
  const a = q.data!;
  const closed = a.status === 'ATENDIDA' || a.status === 'DESCARTADA';
  const max = a.drivers[0]?.contribution || 1;

  return (
    <div className="flex flex-col gap-6">
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold leading-7">{a.areaName}</h2>
            <p className="text-[13px] leading-5 text-acero">{a.surveyTitle}. Creada el {fmtDate(a.createdAt)}</p>
          </div>
          <div className="flex items-center gap-3"><span className="tabular text-[32px] font-semibold leading-9">{a.riskScore.toFixed(1)}</span><RiskBadge level={a.level} /></div>
        </div>
        <h3 className="mt-4 font-semibold">Qué atender primero</h3>
        <ol className="mt-2 flex flex-col gap-3">
          {a.drivers.map((d) => (
            <li key={d.key}>
              <div className="flex justify-between gap-2"><span>{d.label}</span><span className="tabular text-acero">+{d.contribution.toFixed(1)} pts</span></div>
              <div className="mt-1 h-2 rounded-sm bg-concreto"><div className="h-2 rounded-sm bg-acero" style={{ width: `${(d.contribution / max) * 100}%` }} /></div>
            </li>
          ))}
        </ol>
        {mode === 'rh' && (
          <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-borde-suave pt-4">
            <Field label="Estado de la alerta">
              {(fid) => (
                <Select id={fid} value={status} onChange={(e) => setStatus(e.target.value as AlertStatus)} className="!w-auto min-w-48">
                  {(Object.keys(STATUS_LABELS) as AlertStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </Select>
              )}
            </Field>
            <Button variant="secondary" disabled={status === a.status || saveStatus.isPending} onClick={() => saveStatus.mutate()}>Guardar cambios</Button>
            <Link to={`/areas/${a.areaId}?surveyId=${a.surveyId}`} className="pb-2 font-medium text-azul-plano underline underline-offset-4">Ver detalle del área</Link>
          </div>
        )}
        {saveStatus.isError && <div className="mt-3"><ErrorNote error={saveStatus.error} /></div>}
      </Panel>

      <Panel title="Acciones correctivas">
        {(a.actions ?? []).length === 0 ? (
          <p className="text-acero">Todavía no hay acciones. Registra la primera para pasar la alerta a seguimiento.</p>
        ) : (
          <ul className="divide-y divide-borde-suave">
            {a.actions!.map((x) => (
              <li key={x.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div>
                  <p className={x.doneAt ? 'text-acero line-through' : ''}>{x.description}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[13px] leading-5 text-acero">
                    <span>{x.createdByName}</span>
                    {x.dueDate && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />Compromiso: {fmtDate(x.dueDate)}</span>}
                    {x.doneAt && <StatusPill tone="ok">Hecha el {fmtDate(x.doneAt)}</StatusPill>}
                  </p>
                </div>
                <Button variant="quiet" onClick={() => toggle.mutate({ actionId: x.id, done: !x.doneAt })} icon={<Check className="h-4 w-4" aria-hidden="true" />}>{x.doneAt ? 'Marcar pendiente' : 'Marcar hecha'}</Button>
              </li>
            ))}
          </ul>
        )}
        {closed ? (
          <p className="mt-4 text-acero">Esta alerta está {STATUS_LABELS[a.status].toLowerCase()}. {mode === 'rh' ? 'Cambia el estado para registrar más acciones.' : 'Pide a RH que la reabra para registrar más acciones.'}</p>
        ) : (
          <form noValidate onSubmit={handleSubmit((v) => addAction.mutate(v))} className="mt-4 grid gap-4 border-t border-borde-suave pt-4 md:grid-cols-[1fr_200px]">
            <Field label="Descripción de la acción" error={errors.description?.message}>
              {(fid, d) => <Textarea id={fid} rows={2} aria-describedby={d} {...register('description')} />}
            </Field>
            <Field label="Fecha compromiso" hint="Opcional" error={errors.dueDate?.message}>
              {(fid, d) => <Input id={fid} type="date" aria-describedby={d} {...register('dueDate')} />}
            </Field>
            <div className="md:col-span-2">
              {addAction.isError && <div className="mb-3"><ErrorNote error={addAction.error} /></div>}
              <Button type="submit" disabled={addAction.isPending} icon={<Plus className="h-4 w-4" aria-hidden="true" />}>Registrar acción</Button>
            </div>
          </form>
        )}
      </Panel>
    </div>
  );
}

export function AlertsPage({ mode }: { mode: 'rh' | 'lider' }) {
  const { id } = useParams();
  const base = mode === 'rh' ? '/alertas' : '/mis-alertas';
  const [level, setLevel] = useState('');
  const [status, setStatus] = useState('');
  const list = useQuery({ queryKey: ['alerts', level, status], queryFn: async () => (await api.get<{ alerts: AlertItem[] }>(`/alerts${qs({ level, status })}`)).alerts });

  return (
    <>
      <PageHeader title={mode === 'rh' ? 'Alertas de riesgo' : 'Alertas de mi área'}>
        {mode === 'rh' ? 'Áreas con riesgo alto o crítico de rotación. Abre una alerta para ver qué atender y dar seguimiento.' : 'Registra las acciones que vas a tomar y su fecha compromiso.'}
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <Panel title="Bandeja">
          <div className="mb-4 grid grid-cols-2 gap-3">
            <Field label="Nivel">
              {(fid) => (<Select id={fid} value={level} onChange={(e) => setLevel(e.target.value)}><option value="">Todos</option><option value="CRITICO">Riesgo crítico</option><option value="ALTO">Riesgo alto</option></Select>)}
            </Field>
            <Field label="Estado">
              {(fid) => (<Select id={fid} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todos</option>{(Object.keys(STATUS_LABELS) as AlertStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</Select>)}
            </Field>
          </div>
          {list.isLoading ? <Loading /> : list.isError ? <ErrorNote error={list.error} /> : list.data!.length === 0 ? (
            <EmptyState title="No hay alertas con estos filtros">{mode === 'rh' ? 'Las alertas se crean al cerrar una encuesta de clima cuando un área llega a riesgo alto o crítico.' : 'Tu área no tiene alertas abiertas por ahora.'}</EmptyState>
          ) : (
            <ul className="divide-y divide-borde-suave">
              {list.data!.map((a) => (
                <li key={a.id}>
                  <Link to={`${base}/${a.id}`} aria-current={a.id === id ? 'true' : undefined} className={`block rounded-md px-2 py-3 ${a.id === id ? 'bg-azul-tinte' : 'hover:bg-concreto'}`}>
                    <div className="flex items-center justify-between gap-2"><span className="font-semibold">{a.areaName}</span><span className="tabular text-acero">{a.riskScore.toFixed(1)}</span></div>
                    <div className="mt-1 flex flex-wrap items-center gap-2"><RiskBadge level={a.level} /><StatusPill>{STATUS_LABELS[a.status]}</StatusPill></div>
                    <p className="mt-1 text-[13px] leading-5 text-acero">{a.surveyTitle}. {a.actionCount} acción{a.actionCount === 1 ? '' : 'es'}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <div>{id ? <AlertDetail key={id} id={id} mode={mode} /> : <EmptyState title="Elige una alerta">Selecciona una de la bandeja para ver qué factores pesan más y registrar acciones.</EmptyState>}</div>
      </div>
    </>
  );
}
