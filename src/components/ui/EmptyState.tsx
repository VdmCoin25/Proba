import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl2 border border-dashed border-line px-6 py-16 text-center dark:border-line-dark">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ink/[0.05] dark:bg-white/[0.06]">
        <Icon size={24} className="text-ink-soft dark:text-ink-darksoft" />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-base font-semibold text-ink dark:text-ink-dark">{title}</h3>
        {description && (
          <p className="mx-auto max-w-sm text-sm text-ink-soft dark:text-ink-darksoft">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
