import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Smartphone, Headphones, Watch } from 'lucide-react';

export function Hero() {
  return (
    <section className="container grid grid-cols-1 items-center gap-10 py-14 md:grid-cols-2 md:py-20">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <h1 className="max-w-lg text-4xl font-bold leading-[1.08] tracking-tight text-ink dark:text-ink-dark sm:text-5xl">
          Техника, которую хочется купить.
        </h1>
        <p className="mt-5 max-w-md text-base leading-relaxed text-ink-soft dark:text-ink-darksoft">
          Новые устройства, проверенная техника и лучшие предложения от продавцов.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            to="/catalog"
            className="inline-flex h-14 items-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-sm font-medium text-white shadow-soft transition-colors hover:bg-accent/90 dark:bg-accent-dark dark:hover:bg-accent-dark/90"
          >
            Смотреть каталог <ArrowRight size={16} />
          </Link>
          <Link
            to="/sell"
            className="inline-flex h-14 items-center rounded-xl border border-line px-6 py-3.5 text-sm font-medium text-ink transition-colors hover:border-ink/25 dark:border-line-dark dark:text-ink-dark dark:hover:border-white/25"
          >
            Разместить объявление
          </Link>
        </div>
        <div className="mt-10 flex items-center gap-8">
          <div>
            <p className="text-2xl font-bold text-ink dark:text-ink-dark">24 000+</p>
            <p className="text-sm text-ink-soft dark:text-ink-darksoft">товаров в каталоге</p>
          </div>
          <div className="h-9 w-px bg-line dark:bg-line-dark" />
          <div>
            <p className="text-2xl font-bold text-ink dark:text-ink-dark">98%</p>
            <p className="text-sm text-ink-soft dark:text-ink-darksoft">довольных покупателей</p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
        className="relative mx-auto h-72 w-full max-w-md sm:h-96"
      >
        <div className="absolute inset-0 rounded-full bg-accent/10 blur-3xl dark:bg-accent-dark/10" />

        <div className="absolute left-1/2 top-1/2 h-52 w-40 -translate-x-1/2 -translate-y-1/2 animate-float rounded-[2rem] border border-line bg-surface shadow-lift dark:border-line-dark dark:bg-surface-dark sm:h-64 sm:w-48">
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-[2rem] bg-gradient-to-br from-accent/10 to-transparent">
            <Smartphone size={44} strokeWidth={1.2} className="text-accent dark:text-accent-dark" />
          </div>
        </div>

        <div className="absolute left-4 top-6 flex h-20 w-20 animate-floatSlow items-center justify-center rounded-2xl border border-line bg-surface shadow-lift dark:border-line-dark dark:bg-surface-dark sm:h-24 sm:w-24">
          <Headphones size={30} strokeWidth={1.3} className="text-ink dark:text-ink-dark" />
        </div>

        <div
          className="absolute bottom-6 right-2 flex h-16 w-16 animate-floatSlow items-center justify-center rounded-2xl border border-line bg-surface shadow-lift dark:border-line-dark dark:bg-surface-dark sm:h-20 sm:w-20"
          style={{ animationDelay: '1.2s' }}
        >
          <Watch size={26} strokeWidth={1.3} className="text-ink dark:text-ink-dark" />
        </div>
      </motion.div>
    </section>
  );
}
