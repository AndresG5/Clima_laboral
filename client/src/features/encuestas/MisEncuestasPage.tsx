import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CircleCheck, ClipboardCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { RELATION_LABELS, SURVEY_TYPE_LABELS } from '../../lib/constants';
import { fmtDate } from '../../lib/format';
import type { InvitationItem } from '../../lib/types';
import { EmptyState } from '../../components/EmptyState';
import { ErrorNote, Loading, PageHeader, Panel } from '../../components/ui';

export function MisEncuestasPage() {
  const q = useQuery({ queryKey: ['my-invitations'], queryFn: () => api.get<{ pending: InvitationItem[]; completed: InvitationItem[] }>('/me/invitations') });
  if (q.isLoading) return <Loading />;
  if (q.isError) return <ErrorNote error={q.error} />;
  const { pending, completed } = q.data!;
  return (
    <>
      <PageHeader title="Mis encuestas">Tus respuestas son anónimas. Aquí solo se muestra si ya respondiste, nunca lo que respondiste.</PageHeader>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Pendientes">
          {pending.length === 0 ? (
            <EmptyState title="No tienes encuestas pendientes">Cuando RH active una encuesta y te invite, aparecerá aquí.</EmptyState>
          ) : (
            <ul className="divide-y divide-borde-suave">
              {pending.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-semibold">{i.surveyTitle}</p>
                    <p className="text-[13px] leading-5 text-acero">
                      {SURVEY_TYPE_LABELS[i.surveyType]}
                      {i.evaluatedName && i.relation ? `. Evalúas a ${i.evaluatedName} (${RELATION_LABELS[i.relation].toLowerCase()})` : ''}
                      {i.closesAt ? `. Cierra el ${fmtDate(i.closesAt)}` : ''}
                    </p>
                  </div>
                  <Link to={`/encuesta/${i.id}`} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-azul-plano px-4 py-2 font-medium text-white hover:bg-azul-oscuro">
                    <ClipboardCheck className="h-4 w-4" aria-hidden="true" />Responder encuesta
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Completadas">
          {completed.length === 0 ? (
            <p className="text-acero">Todavía no has completado ninguna encuesta.</p>
          ) : (
            <ul className="divide-y divide-borde-suave">
              {completed.map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-3">
                  <CircleCheck className="h-5 w-5 shrink-0 text-verde-texto" aria-hidden="true" />
                  <div>
                    <p className="font-semibold">{i.surveyTitle}</p>
                    <p className="text-[13px] leading-5 text-acero">Completada{i.evaluatedName ? `. Evaluaste a ${i.evaluatedName}` : ''}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
