import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { SURVEY_STATUS_LABELS } from '../lib/constants';
import type { SurveyListItem } from '../lib/types';
import { Select } from './ui';

export function useSurveys(type: 'CLIMA' | 'EVAL_360', onlyClosed = false) {
  return useQuery({
    queryKey: ['surveys', type, onlyClosed],
    // Las cerradas primero: son las que tienen resultados publicables, y la primera es la que se muestra por defecto.
    queryFn: async () => (await api.get<{ surveys: SurveyListItem[] }>('/surveys')).surveys
      .filter((s) => s.type === type && (onlyClosed ? s.status === 'CERRADA' : s.status !== 'BORRADOR'))
      .sort((a, b) => Number(b.status === 'CERRADA') - Number(a.status === 'CERRADA')),
  });
}

/** El servidor los devuelve del cierre más reciente al más antiguo. */
export function SurveySelect({ type, value, onChange, label = 'Encuesta', onlyClosed = false }: { type: 'CLIMA' | 'EVAL_360'; value: string | undefined; onChange: (id: string) => void; label?: string; onlyClosed?: boolean }) {
  const { data } = useSurveys(type, onlyClosed);
  if (!data || data.length === 0) return null;
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={`sel-${type}`} className="text-acero">{label}</label>
      <Select id={`sel-${type}`} value={value ?? data[0].id} onChange={(e) => onChange(e.target.value)} className="!w-auto min-w-64">
        {data.map((s) => <option key={s.id} value={s.id}>{s.title} ({SURVEY_STATUS_LABELS[s.status].toLowerCase()})</option>)}
      </Select>
    </div>
  );
}
