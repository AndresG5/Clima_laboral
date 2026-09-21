import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { api } from '../../lib/api';
import type { Me } from '../../lib/types';
import { Button } from '../../components/Button';
import { ErrorNote, Field, Input, Loading } from '../../components/ui';
import { homeFor, useMe } from './useAuth';

const schema = z.object({
  email: z.string().min(1, 'Escribe tu correo.').email('Escribe un correo válido, por ejemplo nombre@empresa.com.'),
  password: z.string().min(1, 'Escribe tu contraseña.'),
});
type Form = z.infer<typeof schema>;

export function LoginPage() {
  const me = useMe();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [error, setError] = useState<unknown>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });
  const login = useMutation({
    mutationFn: (v: Form) => api.post<{ user: Me }>('/auth/login', v),
    onSuccess: ({ user }) => {
      qc.setQueryData(['me'], user);
      nav(homeFor(user.role), { replace: true });
    },
    onError: setError,
  });

  if (me.isLoading) return <Loading />;
  if (me.data) return <Navigate to={homeFor(me.data.role)} replace />;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <img src="/logo.png" alt="" className="h-10 w-10 rounded-md" />
        <div>
          <p className="text-xl font-semibold leading-6">Clima Laboral</p>
          <p className="text-acero">Sistema de retroalimentación 360</p>
        </div>
      </div>
      <form
        noValidate
        onSubmit={handleSubmit((v) => { setError(null); login.mutate(v); })}
        className="flex flex-col gap-4 rounded-lg border border-borde-suave bg-superficie p-6"
      >
        <h1 className="text-[28px] font-semibold leading-[34px]">Entrar</h1>
        <Field label="Correo" error={errors.email?.message}>
          {(id, d) => <Input id={id} type="email" autoComplete="username" aria-describedby={d} aria-invalid={!!errors.email} {...register('email')} />}
        </Field>
        <Field label="Contraseña" error={errors.password?.message}>
          {(id, d) => <Input id={id} type="password" autoComplete="current-password" aria-describedby={d} aria-invalid={!!errors.password} {...register('password')} />}
        </Field>
        {error ? <ErrorNote error={error} /> : null}
        <Button type="submit" disabled={login.isPending} icon={<LogIn className="h-4 w-4" aria-hidden="true" />}>
          {login.isPending ? 'Entrando' : 'Entrar'}
        </Button>
      </form>
    </main>
  );
}
