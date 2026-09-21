import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex max-w-xl flex-col items-start gap-3 rounded-lg border border-dashed border-acero bg-superficie p-8">
      <Inbox className="h-8 w-8 text-acero" aria-hidden="true" />
      <h3 className="text-base font-semibold">{title}</h3>
      {children && <p className="measure text-acero">{children}</p>}
      {action}
    </div>
  );
}
