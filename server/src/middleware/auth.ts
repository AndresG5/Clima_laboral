import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { AppError, forbidden } from '../errors.js';

export interface AuthUser { id: string; name: string; email: string; role: Role; areaId: string }

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request { user?: AuthUser }
  }
}

export const COOKIE_NAME = 'token';

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: '8h' });
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.[COOKIE_NAME] as string | undefined;
    if (!token) throw new AppError(401, 'SIN_SESION', 'Tu sesión no está iniciada. Entra con tu correo y contraseña.');
    let sub: string;
    try {
      sub = (jwt.verify(token, env.jwtSecret) as { sub: string }).sub;
    } catch {
      throw new AppError(401, 'SESION_EXPIRADA', 'Tu sesión venció. Vuelve a entrar con tu correo y contraseña.');
    }
    const user = await prisma.user.findUnique({ where: { id: sub } });
    if (!user || !user.active) {
      throw new AppError(401, 'SIN_SESION', 'Tu cuenta no está activa. Pide a RH que la revise.');
    }
    req.user = { id: user.id, name: user.name, email: user.email, role: user.role, areaId: user.areaId };
    next();
  } catch (e) {
    next(e);
  }
}

/** Validación de permisos en el servidor: ocultar botones no basta. */
export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new AppError(401, 'SIN_SESION', 'Tu sesión no está iniciada. Entra con tu correo y contraseña.'));
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };

/** RH ve cualquier área; un líder solo la suya; el colaborador ninguna. */
export function assertAreaAccess(user: AuthUser, areaId: string): void {
  if (user.role === 'RH') return;
  if (user.role === 'LIDER' && user.areaId === areaId) return;
  throw forbidden('Solo puedes ver los resultados de tu propia área.');
}
