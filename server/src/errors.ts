import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';

export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export const badRequest = (message: string, code = 'SOLICITUD_INVALIDA') => new AppError(400, code, message);
export const forbidden = (message = 'No tienes permiso para ver o cambiar esto. Pide acceso a RH si lo necesitas.') =>
  new AppError(403, 'SIN_PERMISO', message);
export const notFound = (message = 'No encontramos lo que buscas. Revisa el enlace o vuelve al inicio.') =>
  new AppError(404, 'NO_ENCONTRADO', message);

/** Envuelve un handler async para que sus errores lleguen al errorHandler. */
export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  return schema.parse(data);
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const where = first?.path.length ? ` en "${first.path.join('.')}"` : '';
    res.status(400).json({
      error: { code: 'VALIDACION', message: `Hay un dato inválido${where}: ${first?.message ?? 'revísalo'}. Corrígelo e inténtalo de nuevo.` },
    });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  console.error(err);
  res.status(500).json({
    error: { code: 'ERROR_INTERNO', message: 'Algo falló de nuestro lado. Inténtalo de nuevo en un momento; si sigue igual, avisa a RH.' },
  });
}

/** Parámetro de ruta como texto (Express 5 lo tipa como string | string[]). */
export const param = (req: Request, name: string): string => String(req.params[name]);
