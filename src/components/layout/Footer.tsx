import { Link } from 'react-router-dom';
import { Instagram, Send, Youtube } from 'lucide-react';

const columns = [
  {
    title: 'Покупателям',
    links: ['Как купить', 'Способы оплаты', 'Доставка', 'Возврат товара'],
  },
  {
    title: 'Продавцам',
    links: ['Разместить объявление', 'Тарифы продвижения', 'Правила площадки', 'Проверка продавца'],
  },
  {
    title: 'Помощь',
    links: ['Центр поддержки', 'Безопасная сделка', 'Разрешение споров', 'Связаться с нами'],
  },
  {
    title: 'Компания',
    links: ['О нас', 'Вакансии', 'Пресса', 'Партнёрам'],
  },
];

export function Footer() {
  return (
    <footer className="mt-20 border-t border-line bg-canvas-soft pb-24 pt-14 dark:border-line-dark dark:bg-canvas-darksoft sm:pb-14">
      <div className="container">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-6">
          <div className="col-span-2">
            <Link to="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white dark:bg-accent-dark">
                M
              </span>
              <span className="text-lg font-bold tracking-tight text-ink dark:text-ink-dark">
                MARKET
              </span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-soft dark:text-ink-darksoft">
              Маркетплейс новой и проверенной техники. Покупайте и продавайте напрямую, без
              лишних посредников.
            </p>
            <div className="mt-5 flex items-center gap-3">
              {[Instagram, Send, Youtube].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  aria-label="Социальная сеть"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-soft transition-colors hover:border-ink/25 hover:text-ink dark:border-line-dark dark:text-ink-darksoft dark:hover:border-white/25 dark:hover:text-ink-dark"
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold text-ink dark:text-ink-dark">{col.title}</h3>
              <ul className="mt-3 flex flex-col gap-2.5">
                {col.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm text-ink-soft transition-colors hover:text-ink dark:text-ink-darksoft dark:hover:text-ink-dark"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 text-xs text-ink-soft dark:border-line-dark dark:text-ink-darksoft sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} MARKET. Все права защищены.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-ink dark:hover:text-ink-dark">
              Пользовательское соглашение
            </a>
            <a href="#" className="hover:text-ink dark:hover:text-ink-dark">
              Конфиденциальность
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
