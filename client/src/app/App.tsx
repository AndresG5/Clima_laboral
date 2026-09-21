import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';
import { homeFor, useMe } from '../features/auth/useAuth';
import { AppShell } from './AppShell';
import { RoleRoute } from './guards';
import { ErrorNote, Loading } from '../components/ui';
import { MisEncuestasPage } from '../features/encuestas/MisEncuestasPage';
import { EncuestaFormPage } from '../features/encuestas/EncuestaFormPage';
import { EncuestasAdminPage } from '../features/encuestas/EncuestasAdminPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { AreaDetailPage } from '../features/areas/AreaDetailPage';
import { LeadersPage, LeaderReportPage } from '../features/lideres/LeaderReportPage';
import { AlertsPage } from '../features/alertas/AlertsPage';
import { ConfigPage } from '../features/config/ConfigPage';

export function App() {
  const me = useMe();
  if (me.isLoading) return <Loading label="Cargando tu sesión" />;
  if (me.isError) return <div className="p-6"><ErrorNote error={me.error} /></div>;
  const user = me.data;

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {!user ? (
        <Route path="*" element={<Navigate to="/login" replace />} />
      ) : (
        <Route element={<AppShell me={user} />}>
          <Route index element={<Navigate to={homeFor(user.role)} replace />} />
          <Route path="/mis-encuestas" element={<MisEncuestasPage />} />
          <Route path="/encuesta/:invitationId" element={<EncuestaFormPage />} />

          <Route path="/dashboard" element={<RoleRoute me={user} roles={['RH']}><DashboardPage /></RoleRoute>} />
          <Route path="/areas/:id" element={<RoleRoute me={user} roles={['RH']}><AreaDetailPage /></RoleRoute>} />
          <Route path="/encuestas" element={<RoleRoute me={user} roles={['RH']}><EncuestasAdminPage /></RoleRoute>} />
          <Route path="/lideres" element={<RoleRoute me={user} roles={['RH']}><LeadersPage /></RoleRoute>} />
          <Route path="/lideres/:id" element={<RoleRoute me={user} roles={['RH']}><LeaderReportPage /></RoleRoute>} />
          <Route path="/alertas" element={<RoleRoute me={user} roles={['RH']}><AlertsPage mode="rh" /></RoleRoute>} />
          <Route path="/alertas/:id" element={<RoleRoute me={user} roles={['RH']}><AlertsPage mode="rh" /></RoleRoute>} />
          <Route path="/configuracion" element={<RoleRoute me={user} roles={['RH']}><ConfigPage /></RoleRoute>} />

          <Route path="/mi-equipo" element={<RoleRoute me={user} roles={['LIDER']}><AreaDetailPage own /></RoleRoute>} />
          <Route path="/mi-reporte" element={<RoleRoute me={user} roles={['LIDER']}><LeaderReportPage own /></RoleRoute>} />
          <Route path="/mis-alertas" element={<RoleRoute me={user} roles={['LIDER']}><AlertsPage mode="lider" /></RoleRoute>} />
          <Route path="/mis-alertas/:id" element={<RoleRoute me={user} roles={['LIDER']}><AlertsPage mode="lider" /></RoleRoute>} />
          <Route path="*" element={<Navigate to={homeFor(user.role)} replace />} />
        </Route>
      )}
    </Routes>
  );
}
