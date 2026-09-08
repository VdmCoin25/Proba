import { marqueeItems } from '@/data/products';

export function Marquee() {
  const doubled = [...marqueeItems, ...marqueeItems];

  return (
    <div className="group overflow-hidden border-y border-line bg-canvas-soft dark:border-line-dark dark:bg-canvas-darksoft">
      <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused]">
        {doubled.map((item, i) => (
          <div key={i} className="flex items-center py-3">
            <span className="whitespace-nowrap px-6 text-sm font-medium tracking-wide text-ink-soft dark:text-ink-darksoft">
              {item}
            </span>
            <span className="h-1 w-1 rounded-full bg-ink-soft/40 dark:bg-ink-darksoft/40" />
          </div>
        ))}
      </div>
    </div>
  );
}
