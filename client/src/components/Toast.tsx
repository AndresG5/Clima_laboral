import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CircleCheck } from 'lucide-react';

const Ctx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg((cur) => (cur === m ? null : cur)), 4000);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        {msg && (
          <div className="pointer-events-auto flex items-center gap-2 rounded-md bg-tinta px-4 py-3 text-white shadow-[0_4px_16px_rgba(22,37,43,0.18)]">
            <CircleCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
            {msg}
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}
