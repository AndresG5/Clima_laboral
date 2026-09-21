import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { Me, Role } from '../lib/types';
import { homeFor } from '../features/auth/useAuth';

/** Oculta rutas según el rol. La validación real de permisos está en el servidor. */
export function RoleRoute({ me, roles, children }: { me: Me; roles: Role[]; children: ReactNode }) {
  if (!roles.includes(me.role)) return <Navigate to={homeFor(me.role)} replace />;
  return <>{children}</>;
}
