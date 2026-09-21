import { useEffect, useRef, type ReactNode } from 'react';
import { Info } from 'lucide-react';

/**
 * Disclosure accesible por teclado de forma nativa (<details>/<summary>): explica cómo se
 * calcula una cifra, con la fórmula, la escala y los umbrales reales.
 */
export function ExplainPopover({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);
  return (
    <details ref={ref} className="group relative inline-block">
      <summary
        className="inline-flex h-6 w-6 cursor-pointer list-none items-center justify-center rounded-full text-acero hover:bg-concreto hover:text-tinta [&::-webkit-details-marker]:hidden"
        aria-label={`¿Cómo se calcula ${label}?`}
      >
        <Info className="h-4 w-4" aria-hidden="true" />
      </summary>
      <div className="measure absolute right-0 z-20 mt-2 w-80 rounded-lg border border-borde-suave bg-superficie p-4 text-[13px] leading-5 text-tinta shadow-[0_4px_16px_rgba(22,37,43,0.18)]">
        {children}
      </div>
    </details>
  );
}
