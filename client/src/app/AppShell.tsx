import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, ClipboardList, FileText, Gauge, LayoutGrid, LogOut, Settings, UserRound, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { api } from '../lib/api';
import { ROLE_LABELS } from '../lib/constants';
import type { Me } from '../lib/types';
import { Button } from '../components/Button';

type Item = { to: string; label: string; icon: ReactNode };
const ic = 'h-4 w-4 shrink-0';

function navFor(role: Me['role']): Item[] {
  const mine: Item = { to: '/mis-encuestas', label: 'Mis encuestas', icon: <FileText className={ic} aria-hidden="true" /> };
  if (role === 'RH') return [
    { to: '/dashboard', label: 'Panel', icon: <LayoutGrid className={ic} aria-hidden="true" /> },
    { to: '/encuestas', label: 'Encuestas', icon: <ClipboardList className={ic} aria-hidden="true" /> },
    { to: '/alertas', label: 'Alertas', icon: <Bell className={ic} aria-hidden="true" /> },
    { to: '/lideres', label: 'Líderes', icon: <UserRound className={ic} aria-hidden="true" /> },
    { to: '/configuracion', label: 'Configuración', icon: <Settings className={ic} aria-hidden="true" /> },
    mine,
  ];
  if (role === 'LIDER') return [
    { to: '/mi-equipo', label: 'Mi equipo', icon: <Users className={ic} aria-hidden="true" /> },
    { to: '/mi-reporte', label: 'Mi reporte 360', icon: <Gauge className={ic} aria-hidden="true" /> },
    { to: '/mis-alertas', label: 'Mis alertas', icon: <Bell className={ic} aria-hidden="true" /> },
    mine,
  ];
  return [mine];
}

export function AppShell({ me }: { me: Me }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const logout = useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: () => { qc.clear(); nav('/login', { replace: true }); },
  });
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-superficie focus:px-3 focus:py-2">Saltar al contenido</a>
      <header className="border-b border-borde-suave bg-superficie">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 md:px-6">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="" className="h-7 w-7 rounded-md" />
            <span className="text-base font-semibold">Clima Laboral</span>
          </div>
          <nav aria-label="Principal" className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto">
            {navFor(me.role).map((n) => (
              <NavLink key={n.to} to={n.to}
                className={({ isActive }) => `inline-flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 font-medium ${isActive ? 'bg-azul-tinte text-tinta' : 'text-acero hover:bg-concreto hover:text-tinta'}`}>
                {n.icon}{n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right leading-5">
              <p className="font-semibold">{me.name}</p>
              <p className="text-[13px] text-acero">{ROLE_LABELS[me.role]}, {me.area.name}</p>
            </div>
            <Button variant="secondary" onClick={() => logout.mutate()} disabled={logout.isPending} icon={<LogOut className="h-4 w-4" aria-hidden="true" />}>Salir</Button>
          </div>
        </div>
      </header>
      <main id="contenido" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-6 md:py-8"><Outlet /></main>
    </div>
  );
}
