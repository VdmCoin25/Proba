# MARKET — премиальный маркетплейс техники

Стек: **React 18 + TypeScript + Vite + Tailwind CSS + Framer Motion + Lucide React + React Router**.

## Запуск

```bash
npm install
npm run dev
```

Откройте адрес, который выведет Vite (обычно `http://localhost:5173`).

Сборка для продакшена:

```bash
npm run build
npm run preview
```

> ⚠️ Проект был написан вручную в среде без доступа в интернет, поэтому `npm install`
> и сборка ни разу не запускались в процессе разработки. Код написан максимально аккуратно
> и вычитан (пути импортов, экспорты компонентов, баланс скобок), но при первом запуске
> стоит внимательно посмотреть на консоль — если что-то не так, пришлите мне текст ошибки,
> и я быстро поправлю.

## Структура проекта

```
src/
  components/
    layout/     Header, Footer, MobileNav, Marquee
    ui/         Button, Badge, Rating, Price, Skeleton, Modal, EmptyState
    product/    ProductCard, ProductGrid, ProductCarousel, ProductVisual
    category/   CategoryCard
    search/     SearchOverlay
    catalog/    FilterSidebar
    home/       Hero, CategoriesSection, TrendingSection, HotDeals
  pages/        Home, Catalog, Product, Seller, Sell, Cart, Favorites, NotFound
  layouts/      MainLayout
  context/      Theme, Toast, Cart, Wishlist (персистентность в localStorage)
  data/         products.ts (24 товара), categories.ts (9 категорий), sellers.ts (5 продавцов), reviews.ts
  types/        общие TypeScript-типы
  hooks/        useCountdown, useDebounce, useLocalStorage, useOnClickOutside
```

## Ключевые решения

- **Изображения товаров** — стилизованные плейсхолдеры (`ProductVisual`): градиент по паре
  цветов товара + иконка категории из Lucide. Так проект не зависит от внешних CDN с фото
  и выглядит целостно. Если позже подключите реальные фото — просто замените `ProductVisual`
  на `<img>` внутри тех же карточек, пропсы менять не нужно.
- **Тёмная тема** — через класс `dark` на `<html>`, переключатель в шапке, состояние в localStorage.
- **Корзина/избранное** — React Context + localStorage, тост «Добавлено в корзину ✓» при добавлении.
- **Поиск** — оверлей на всю ширину с недавними запросами, популярными категориями и live-подсказками.
- **Бегущая строка** — чистый CSS `@keyframes` (без лишней JS-анимации), останавливается по `:hover`.
- **Таймер горячих предложений** — реальный `setInterval`, обратный отсчёт от 5 часов 14 минут.
- **Архитектура готова под backend**: все данные лежат в `src/data/*.ts` в формате, который
  легко заменить на fetch к REST API / Supabase / Firebase — типы (`src/types/index.ts`)
  уже описывают форму данных, которую бэкенд должен возвращать.

## Дальнейшие шаги

- Подключить настоящий backend вместо `src/data/*`.
- Заменить `ProductVisual` на реальные фотографии (можно оставить как fallback для товаров без фото).
- Добавить настоящую авторизацию для страницы профиля.
