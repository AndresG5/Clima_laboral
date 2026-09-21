import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { AppError, ah, parse } from '../errors.js';
import { COOKIE_NAME, requireAuth, signToken } from '../middleware/auth.js';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isTest ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'DEMASIADOS_INTENTOS', message: 'Hiciste demasiados intentos de entrada. Espera 15 minutos e inténtalo de nuevo.' } },
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('escribe un correo válido'),
  password: z.string().min(1, 'escribe tu contraseña'),
});

async function publicUser(id: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id }, include: { area: true } });
  return { id: u.id, name: u.name, email: u.email, role: u.role, area: { id: u.area.id, name: u.area.name } };
}

authRouter.post('/login', loginLimiter, ah(async (req, res) => {
  const { email, password } = parse(loginSchema, req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = user && user.active && (await bcrypt.compare(password, user.passwordHash));
  if (!user || !ok) {
    throw new AppError(401, 'CREDENCIALES_INVALIDAS', 'El correo o la contraseña no coinciden. Revisa que estén bien escritos e inténtalo de nuevo.');
  }
  const token = signToken(user.id);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true, sameSite: env.isProd ? 'none' : 'lax', secure: env.isProd, maxAge: 8 * 60 * 60 * 1000,
  });
  // También se manda en el cuerpo: el cliente lo usa como Authorization: Bearer en producción,
  // donde el navegador bloquea la cookie por ser de un dominio distinto al del frontend.
  res.json({ user: await publicUser(user.id), token });
}));

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: env.isProd ? 'none' : 'lax', secure: env.isProd });
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, ah(async (req, res) => {
  res.json({ user: await publicUser(req.user!.id) });
}));
