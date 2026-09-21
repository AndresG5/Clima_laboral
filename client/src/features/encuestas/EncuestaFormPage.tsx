import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { CircleCheck, Send, ShieldCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { LIKERT_LABELS, RELATION_LABELS } from '../../lib/constants';
import type { FormDef } from '../../lib/types';
import { Button } from '../../components/Button';
import { ErrorNote, Loading, Textarea } from '../../components/ui';

export function EncuestaFormPage() {
  const { invitationId } = useParams();
  const qc = useQueryClient();
  const form = useQuery({ queryKey: ['form', invitationId], queryFn: () => api.get<FormDef>(`/invitations/${invitationId}/form`), retry: false });
  const [values, setValues] = useState<Record<string, number>>({});
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [showMissing, setShowMissing] = useState(false);
  const firstMissing = useRef<HTMLFieldSetElement | null>(null);

  const likert = useMemo(() => form.data?.dimensions.flatMap((d) => d.questions.filter((q) => q.type === 'LIKERT_5')) ?? [], [form.data]);
  const answered = likert.filter((q) => values[q.id] !== undefined).length;
  const pct = likert.length === 0 ? 0 : Math.round((answered / likert.length) * 100);

  const submit = useMutation({
    mutationFn: () => api.post(`/invitations/${invitationId}/submit`, {
      answers: [
        ...likert.map((q) => ({ questionId: q.id, value: values[q.id] })),
        ...Object.entries(texts).filter(([, t]) => t.trim()).map(([questionId, text]) => ({ questionId, text })),
      ],
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-invitations'] }); },
  });

  if (form.isLoading) return <Loading />;
  if (form.isError) return (
    <div className="flex max-w-xl flex-col gap-4">
      <ErrorNote error={form.error} />
      <Link to="/mis-encuestas" className="font-medium text-azul-plano underline underline-offset-4">Volver a mis encuestas</Link>
    </div>
  );
  if (submit.isSuccess) return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-4 rounded-lg border border-verde-seguridad bg-verde-tinte p-6">
      <CircleCheck className="h-8 w-8 text-verde-texto" aria-hidden="true" />
      <h1 className="text-[28px] font-semibold leading-[34px]">Respuesta enviada</h1>
      <p className="measure">Tu respuesta es anónima: en la base de datos no queda ningún vínculo entre tú y lo que contestaste. Gracias por tu tiempo.</p>
      <Link to="/mis-encuestas" className="inline-flex min-h-10 items-center rounded-md bg-azul-plano px-4 py-2 font-medium text-white hover:bg-azul-oscuro">Volver a mis encuestas</Link>
    </div>
  );

  const f = form.data!;
  const missingIds = new Set(likert.filter((q) => values[q.id] === undefined).map((q) => q.id));
  const onSubmit = () => {
    if (missingIds.size > 0) {
      setShowMissing(true);
      window.setTimeout(() => firstMissing.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
      return;
    }
    submit.mutate();
  };
  let assignedFirst = false;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-[28px] font-semibold leading-[34px]">{f.invitation.surveyTitle}</h1>
      {f.invitation.evaluatedName && f.invitation.relation && (
        <p className="mt-1 text-acero">Evalúas a <strong className="text-tinta">{f.invitation.evaluatedName}</strong> ({RELATION_LABELS[f.invitation.relation].toLowerCase()}).</p>
      )}
      <p className="measure mt-2 flex items-start gap-2 text-acero">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-verde-texto" aria-hidden="true" />
        Tus respuestas son anónimas. Solo se guarda tu área y tu rango de antigüedad, y los resultados de grupos pequeños nunca se muestran.
      </p>

      <div className="sticky top-0 z-10 -mx-4 mt-4 border-b border-borde-suave bg-concreto px-4 py-3 md:mx-0 md:px-0">
        <div className="flex items-center justify-between text-[13px] leading-5">
          <span className="font-semibold">{answered} de {likert.length} respondidas</span>
          <span className="tabular text-acero">{pct} %</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-sm bg-borde-suave" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Avance de la encuesta">
          <div className="h-full bg-azul-plano transition-[width] duration-200" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-8">
        {f.dimensions.map((d) => (
          <section key={d.dimension} aria-labelledby={`dim-${d.dimension}`} className="rounded-lg border border-borde-suave bg-superficie p-4 md:p-6">
            <h2 id={`dim-${d.dimension}`} className="text-xl font-semibold leading-7">{d.label}</h2>
            <div className="mt-4 flex flex-col gap-6">
              {d.questions.map((q) => {
                if (q.type === 'ABIERTA') {
                  const id = `q-${q.id}`;
                  return (
                    <div key={q.id} className="flex flex-col gap-1">
                      <label htmlFor={id} className="font-semibold">{q.text}</label>
                      <Textarea id={id} rows={3} maxLength={1000} value={texts[q.id] ?? ''} onChange={(e) => setTexts((t) => ({ ...t, [q.id]: e.target.value }))} />
                    </div>
                  );
                }
                const missing = showMissing && missingIds.has(q.id);
                const isFirst = missing && !assignedFirst;
                if (isFirst) assignedFirst = true;
                return (
                  <fieldset key={q.id} ref={isFirst ? firstMissing : undefined} className="min-w-0">
                    <legend className="mb-2 font-semibold">{q.text}</legend>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
                      {LIKERT_LABELS.map((label, i) => {
                        const v = i + 1;
                        const checked = values[q.id] === v;
                        return (
                          <label key={v} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 sm:flex-col sm:justify-center sm:gap-1 sm:text-center ${checked ? 'border-azul-plano bg-azul-tinte' : 'border-acero bg-superficie hover:bg-concreto'}`}>
                            <input type="radio" name={q.id} value={v} checked={checked} onChange={() => setValues((s) => ({ ...s, [q.id]: v }))} className="h-4 w-4 accent-azul-plano" />
                            <span className="text-[13px] leading-4"><span className="tabular font-semibold">{v}</span> {label}</span>
                          </label>
                        );
                      })}
                    </div>
                    {missing && <p role="alert" className="mt-1 text-[13px] leading-5 text-rojo-texto">Elige una opción del 1 al 5 para esta pregunta.</p>}
                  </fieldset>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {submit.isError && <div className="mt-6"><ErrorNote error={submit.error} /></div>}
      {showMissing && missingIds.size > 0 && (
        <p role="alert" className="mt-6 text-rojo-texto">Faltan {missingIds.size} pregunta{missingIds.size === 1 ? '' : 's'} por responder. Contesta todas las de escala; el comentario es opcional.</p>
      )}
      <div className="mt-6 flex justify-end pb-8">
        <Button onClick={onSubmit} disabled={submit.isPending} icon={<Send className="h-4 w-4" aria-hidden="true" />}>{submit.isPending ? 'Enviando' : 'Enviar respuestas'}</Button>
      </div>
    </div>
  );
}
