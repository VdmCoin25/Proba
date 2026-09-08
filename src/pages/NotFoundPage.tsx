import { Link } from 'react-router-dom';
import { CompassIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="container flex flex-col items-center gap-5 py-24 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-ink/[0.05] dark:bg-white/[0.06]">
        <CompassIcon size={28} className="text-ink-soft dark:text-ink-darksoft" />
      </span>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink dark:text-ink-dark">
          Страница не найдена
        </h1>
        <p className="mt-2 max-w-sm text-sm text-ink-soft dark:text-ink-darksoft">
          Возможно, объявление было снято с продажи или ссылка устарела.
        </p>
      </div>
      <Link to="/">
        <Button>На главную</Button>
      </Link>
    </div>
  );
}
