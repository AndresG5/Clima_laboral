import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import type { Me, Role } from '../../lib/types';

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async (): Promise<Me | null> => {
      try {
        return (await api.get<{ user: Me }>('/auth/me')).user;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export const homeFor = (role: Role): string => (role === 'RH' ? '/dashboard' : role === 'LIDER' ? '/mi-equipo' : '/mis-encuestas');
