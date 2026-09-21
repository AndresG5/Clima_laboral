import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Play, Plus, Sparkles, Trash2, UserPlus } from 'lucide-react';
import { api } from '../../lib/api';
import { DIMENSIONS, SAMPLE_QUESTIONS, SURVEY_STATUS_LABELS, SURVEY_TYPE_LABELS } from '../../lib/constants';
import { fmtDate } from '../../lib/format';
import type { SurveyListItem } from '../../lib/types';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState';
import { useToast } from '../../components/Toast';
import { ErrorNote, Field, Input, Loading, PageHeader, Panel, Select, StatusPill } from '../../components/ui';

const schema = z.object({
  title: z.string().trim().min(3, 'Escribe un título de al menos 3 caracteres.').max(120, 'Usa 120 caracteres o menos.'),
  type: z.enum(['CLIMA', 'EVAL_360']),
  opensAt: z.string().optional(),
  closesAt: z.string().optional(),
  minGroupSize: z.number({ error: 'Escribe un número.' }).int('Usa un número entero.').min(3, 'El umbral k debe ser 3 o más.').max(50, 'El umbral k no puede pasar de 50.'),
  questions: z.array(z.object({
    dimension: z.string(),
    text: z.string().trim().min(5, 'Escribe la pregunta completa (5 caracteres o más).').max(300),
    type: z.enum(['LIKERT_5', 'ABIERTA']),
  })).min(1, 'Agrega al menos una pregunta.'),
}).refine((d) => !d.opensAt || !d.closesAt || d.closesAt > d.opensAt, { message: 'La fecha de cierre debe ser posterior a la de apertura.', path: ['closesAt'] });
type Form = z.infer<typeof schema>;

const sampleQuestions = (): Form['questions'] => [
  ...DIMENSIONS.flatMap(([dim]) => SAMPLE_QUESTIONS[dim].map((text) => ({ dimension: dim, text, type: 'LIKERT_5' as const }))),
  { dimension: 'PERMANENCIA', text: '¿Qué cambiarías primero para mejorar tu día a día en el trabajo? (opcional)', type: 'ABIERTA' as const },
];

function CreateSurvey({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { register, control, handleSubmit, setValue, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', type: 'CLIMA', minGroupSize: 5, questions: [{ dimension: 'LIDERAZGO', text: '', type: 'LIKERT_5' }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'questions' });
  const create = useMutation({
    mutationFn: (v: Form) => api.post('/surveys', {
      ...v,
      opensAt: v.opensAt ? new Date(`${v.opensAt}T00:00:00`).toISOString() : null,
      closesAt: v.closesAt ? new Date(`${v.closesAt}T23:59:59`).toISOString() : null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['surveys-admin'] }); toast('Encuesta creada'); onDone(); },
  });

  return (
    <Panel title="Crear encuesta">
      <form noValidate onSubmit={handleSubmit((v) => create.mutate(v))} className="flex flex-col gap-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Título" error={errors.title?.message}>{(id, d) => <Input id={id} aria-describedby={d} {...register('title')} />}</Field>
          <Field label="Tipo">{(id) => <Select id={id} {...register('type')}><option value="CLIMA">Clima laboral</option><option value="EVAL_360">Evaluación 360</option></Select>}</Field>
          <Field label="Apertura" hint="Opcional">{(id) => <Input id={id} type="date" {...register('opensAt')} />}</Field>
          <Field label="Cierre" hint="Opcional" error={errors.closesAt?.message}>{(id, d) => <Input id={id} type="date" aria-describedby={d} {...register('closesAt')} />}</Field>
          <Field label="Umbral de anonimato (k)" hint="Ningún resultado se muestra si el grupo tiene menos respuestas que k." error={errors.minGroupSize?.message}>
            {(id, d) => <Input id={id} type="number" min={3} aria-describedby={d} {...register('minGroupSize', { valueAsNumber: true })} className="tabular" />}
          </Field>
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 flex w-full flex-wrap items-center justify-between gap-3 text-xl font-semibold leading-7">
            Preguntas por dimensión
            <Button type="button" variant="secondary" onClick={() => setValue('questions', sampleQuestions(), { shouldValidate: true })} icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}>Cargar preguntas de ejemplo</Button>
          </legend>
          {fields.map((f, i) => (
            <div key={f.id} className="grid gap-3 rounded-md border border-borde-suave p-3 md:grid-cols-[180px_1fr_150px_auto] md:items-start">
              <Field label="Dimensión">{(id) => <Select id={id} {...register(`questions.${i}.dimension`)}>{DIMENSIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>}</Field>
              <Field label="Pregunta" error={errors.questions?.[i]?.text?.message}>{(id, d) => <Input id={id} aria-describedby={d} {...register(`questions.${i}.text`)} />}</Field>
              <Field label="Respuesta">{(id) => <Select id={id} {...register(`questions.${i}.type`)}><option value="LIKERT_5">Escala 1 a 5</option><option value="ABIERTA">Comentario</option></Select>}</Field>
              <div className="md:pt-7"><Button type="button" variant="quiet" onClick={() => remove(i)} aria-label={`Quitar pregunta ${i + 1}`} icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}>Quitar</Button></div>
            </div>
          ))}
          {errors.questions?.message && <p role="alert" className="text-rojo-texto">{errors.questions.message}</p>}
          <div><Button type="button" variant="secondary" onClick={() => append({ dimension: 'LIDERAZGO', text: '', type: 'LIKERT_5' })} icon={<Plus className="h-4 w-4" aria-hidden="true" />}>Agregar pregunta</Button></div>
        </fieldset>

        {create.isError && <ErrorNote error={create.error} />}
        <div className="flex gap-3">
          <Button type="submit" disabled={create.isPending}>Crear encuesta</Button>
          <Button type="button" variant="secondary" onClick={onDone}>Cancelar</Button>
        </div>
      </form>
    </Panel>
  );
}

export function EncuestasAdminPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [closing, setClosing] = useState<SurveyListItem | null>(null);
  const list = useQuery({ queryKey: ['surveys-admin'], queryFn: async () => (await api.get<{ surveys: SurveyListItem[] }>('/surveys')).surveys });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['surveys-admin'] }); qc.invalidateQueries({ queryKey: ['surveys'] }); qc.invalidateQueries({ queryKey: ['alerts'] }); qc.invalidateQueries({ queryKey: ['overview'] }); qc.invalidateQueries({ queryKey: ['heatmap'] }); };

  const activate = useMutation({ mutationFn: (id: string) => api.patch(`/surveys/${id}/status`, { status: 'ACTIVA' }), onSuccess: () => { refresh(); toast('Encuesta activada'); } });
  const close = useMutation({
    mutationFn: (id: string) => api.patch<{ alertsCreated: number }>(`/surveys/${id}/status`, { status: 'CERRADA' }),
    onSuccess: (r) => { refresh(); setClosing(null); toast(r.alertsCreated > 0 ? `Encuesta cerrada. Se crearon ${r.alertsCreated} alerta${r.alertsCreated === 1 ? '' : 's'}` : 'Encuesta cerrada'); },
    onError: () => setClosing(null),
  });
  const invite = useMutation({
    mutationFn: (id: string) => api.post<{ created: number; skipped: number }>(`/surveys/${id}/invitations`),
    onSuccess: (r) => { refresh(); toast(r.created > 0 ? `Invitaciones generadas: ${r.created}` : 'Todas las invitaciones ya existían'); },
  });
  const error = activate.error ?? close.error ?? invite.error;

  return (
    <>
      <PageHeader title="Encuestas" actions={!creating && <Button onClick={() => setCreating(true)} icon={<Plus className="h-4 w-4" aria-hidden="true" />}>Crear encuesta</Button>}>
        Crea encuestas, actívalas, genera invitaciones para todos los usuarios activos y ciérralas para calcular el riesgo.
      </PageHeader>
      {creating && <div className="mb-6"><CreateSurvey onDone={() => setCreating(false)} /></div>}
      {error ? <div className="mb-4"><ErrorNote error={error} /></div> : null}

      {list.isLoading ? <Loading /> : list.isError ? <ErrorNote error={list.error} /> : list.data!.length === 0 ? (
        <EmptyState title="Aún no hay encuestas" action={<Button onClick={() => setCreating(true)}>Crear encuesta</Button>}>Crea la primera para empezar a medir el clima laboral.</EmptyState>
      ) : (
        <Panel>
          <div className="overflow-x-auto">
            <table className="tabular w-full min-w-[760px] text-left">
              <thead><tr className="text-[13px] text-acero">
                <th scope="col" className="pb-2 font-medium">Encuesta</th><th scope="col" className="pb-2 font-medium">Estado</th>
                <th scope="col" className="pb-2 text-right font-medium">Respondieron</th><th scope="col" className="pb-2 text-right font-medium">Umbral k</th><th scope="col" className="pb-2 text-right font-medium">Acciones</th>
              </tr></thead>
              <tbody className="divide-y divide-borde-suave">
                {list.data!.map((s) => (
                  <tr key={s.id}>
                    <th scope="row" className="py-3 pr-3 font-normal"><p className="font-semibold">{s.title}</p><p className="text-[13px] leading-5 text-acero">{SURVEY_TYPE_LABELS[s.type]}. {s.questionCount} preguntas. Cierre: {fmtDate(s.closesAt)}</p></th>
                    <td className="py-3"><StatusPill tone={s.status === 'ACTIVA' ? 'info' : 'neutral'}>{SURVEY_STATUS_LABELS[s.status]}</StatusPill></td>
                    <td className="py-3 text-right">{s.invitationCount ? `${s.completedCount ?? 0} de ${s.invitationCount}` : 'Sin invitaciones'}</td>
                    <td className="py-3 text-right">{s.minGroupSize}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        {s.status === 'BORRADOR' && <Button variant="secondary" disabled={activate.isPending} onClick={() => activate.mutate(s.id)} icon={<Play className="h-4 w-4" aria-hidden="true" />}>Activar encuesta</Button>}
                        {s.status !== 'CERRADA' && <Button variant="secondary" disabled={invite.isPending} onClick={() => invite.mutate(s.id)} icon={<UserPlus className="h-4 w-4" aria-hidden="true" />}>Generar invitaciones</Button>}
                        {s.status === 'ACTIVA' && <Button variant="danger" onClick={() => setClosing(s)} icon={<Lock className="h-4 w-4" aria-hidden="true" />}>Cerrar encuesta</Button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <ConfirmDialog open={!!closing} title="Cerrar encuesta" confirmLabel="Cerrar encuesta" danger busy={close.isPending} onCancel={() => setClosing(null)} onConfirm={() => closing && close.mutate(closing.id)}>
        Al cerrar "{closing?.title}" ya nadie podrá responderla ni reabrirla. Si es de clima, se calculará el riesgo de rotación y se crearán las alertas de las áreas en riesgo alto o crítico.
      </ConfirmDialog>
    </>
  );
}
