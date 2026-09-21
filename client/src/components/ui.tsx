import { useId, type ReactNode, type SelectHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes, forwardRef } from 'react';
import { CircleAlert, LoaderCircle, Lock } from 'lucide-react';
import { ApiError } from '../lib/api';

export function PageHeader({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[28px] font-semibold leading-[34px]">{title}</h1>
        {children && <p className="measure mt-1 text-acero">{children}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

export function Panel({ title, children, actions, className = '' }: { title?: string; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-borde-suave bg-superficie p-4 md:p-6 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="text-xl font-semibold leading-7">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Loading({ label = 'Cargando' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 py-8 text-acero">
      <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  const msg = error instanceof ApiError ? error.message : 'Algo salió mal. Inténtalo de nuevo en un momento.';
  return (
    <div role="alert" className="flex max-w-xl items-start gap-3 rounded-lg border border-rojo-paro bg-rojo-tinte p-4">
      <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-rojo-texto" aria-hidden="true" />
      <p className="measure">{msg}</p>
    </div>
  );
}

export function Insufficient({ message = 'Muestra insuficiente para proteger el anonimato' }: { message?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] leading-4 text-acero">
      <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {message}
    </span>
  );
}

const fieldCls = 'min-h-10 w-full rounded-md border border-acero bg-superficie px-3 py-2 text-[15px] text-tinta placeholder:text-acero';

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: (id: string, describedBy?: string) => ReactNode }) {
  const id = useId();
  const descId = `${id}-d`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-semibold">{label}</label>
      {children(id, error || hint ? descId : undefined)}
      {hint && !error && <p id={descId} className="text-[13px] leading-5 text-acero">{hint}</p>}
      {error && <p id={descId} role="alert" className="text-[13px] leading-5 text-rojo-texto">{error}</p>}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(props, ref) {
  return <input ref={ref} {...props} className={`${fieldCls} ${props.className ?? ''}`} />;
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(props, ref) {
  return <select ref={ref} {...props} className={`${fieldCls} ${props.className ?? ''}`} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(props, ref) {
  return <textarea ref={ref} {...props} className={`${fieldCls} ${props.className ?? ''}`} />;
});

export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div>
      <dt className="text-[13px] leading-5 text-acero">{label}</dt>
      <dd className="tabular text-[32px] font-semibold leading-9">{value}</dd>
      {note && <dd className="text-[13px] leading-5 text-acero">{note}</dd>}
    </div>
  );
}

export function StatusPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'info' | 'ok' }) {
  const cls = tone === 'ok' ? 'bg-verde-tinte border-verde-seguridad' : tone === 'info' ? 'bg-azul-tinte border-azul-plano' : 'bg-concreto border-acero';
  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[13px] font-medium leading-5 ${cls}`}>{children}</span>;
}
