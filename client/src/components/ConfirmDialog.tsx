import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './Button';

export function ConfirmDialog({ open, title, children, confirmLabel, danger, busy, onConfirm, onCancel }:
  { open: boolean; title: string; children: ReactNode; confirmLabel: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onCancel={(e) => { e.preventDefault(); onCancel(); }}
      className="m-auto w-[min(92vw,460px)] rounded-lg border border-borde-suave bg-superficie p-6 text-tinta shadow-[0_4px_16px_rgba(22,37,43,0.18)] backdrop:bg-tinta/40">
      <h2 className="text-xl font-semibold leading-7">{title}</h2>
      <div className="measure mt-2 text-acero">{children}</div>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>Cancelar</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>{confirmLabel}</Button>
      </div>
    </dialog>
  );
}
