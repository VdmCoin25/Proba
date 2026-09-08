import { ReactNode } from 'react';
import { Condition } from '@/types';

const conditionStyles: Record<Condition, string> = {
  'Новый': 'bg-accent/10 text-accent dark:bg-accent-dark/15 dark:text-accent-dark',
  'Как новый': 'bg-amber-500/10 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
  'Б/У': 'bg-ink/8 text-ink-soft dark:bg-white/10 dark:text-ink-darksoft',
};

export function ConditionBadge({ condition }: { condition: Condition }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${conditionStyles[condition]}`}
    >
      {condition}
    </span>
  );
}

export function DiscountBadge({ percent }: { percent: number }) {
  return (
    <span className="inline-flex items-center rounded-md bg-rose-500 px-1.5 py-0.5 text-xs font-semibold text-white">
      −{percent}%
    </span>
  );
}

export function Chip({
  children,
  active,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-pill border px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'border-accent bg-accent text-white dark:border-accent-dark dark:bg-accent-dark'
          : 'border-line text-ink-soft hover:border-ink/25 hover:text-ink dark:border-line-dark dark:text-ink-darksoft dark:hover:border-white/25 dark:hover:text-ink-dark'
      }`}
    >
      {children}
    </button>
  );
}
