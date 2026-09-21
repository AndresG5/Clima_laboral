import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

/** Panel lateral deslizable, construido sobre <dialog> para foco y teclado nativos (Esc cierra). */
export function Drawer({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className="m-0 ml-auto h-dvh max-h-dvh w-[min(92vw,480px)] max-w-none border-l border-borde-suave bg-superficie p-0 text-tinta shadow-[0_4px_24px_rgba(22,37,43,0.24)] backdrop:bg-tinta/40"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-borde-suave px-5 py-4">
          <h2 className="text-xl font-semibold leading-7">{title}</h2>
          <Button variant="quiet" onClick={onClose} aria-label="Cerrar panel" icon={<X className="h-4 w-4" aria-hidden="true" />} />
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </dialog>
  );
}
