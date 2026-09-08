import { Navigate, useParams } from 'react-router-dom';
import { Shield, Star, Clock, PackageCheck } from 'lucide-react';
import { sellers } from '@/data/sellers';
import { products } from '@/data/products';
import { ProductGrid } from '@/components/product/ProductGrid';
import { formatDate } from '@/utils/format';

export function SellerPage() {
  const { slug } = useParams();
  const seller = sellers.find((s) => s.slug === slug);

  if (!seller) return <Navigate to="/catalog" replace />;

  const sellerProducts = products.filter((p) => p.sellerId === seller.id);

  return (
    <div className="container py-8">
      <div className="flex flex-col items-start gap-5 border-b border-line pb-8 dark:border-line-dark sm:flex-row sm:items-center">
        <span
          className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-3xl font-semibold text-white"
          style={{ backgroundColor: seller.avatarColor }}
        >
          {seller.name.slice(0, 1)}
        </span>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-ink dark:text-ink-dark">
              {seller.name}
            </h1>
            {seller.verified && (
              <span className="inline-flex items-center gap-1 rounded-md bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent dark:bg-accent-dark/15 dark:text-accent-dark">
                <Shield size={12} /> Проверенный продавец
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-ink-soft dark:text-ink-darksoft">
            {seller.city} · на площадке с {formatDate(seller.registeredAt)}
          </p>
        </div>

        <div className="grid w-full grid-cols-2 gap-3 sm:w-auto sm:grid-cols-4">
          <Stat icon={Star} label="Рейтинг" value={seller.rating.toString()} />
          <Stat icon={PackageCheck} label="Продаж" value={seller.salesCount.toString()} />
          <Stat icon={Clock} label="Отвечает" value={seller.responseTime} />
          <Stat icon={Shield} label="Отвечает на" value={`${seller.responseRate}%`} />
        </div>
      </div>

      <div className="mt-8">
        <h2 className="mb-5 text-lg font-semibold text-ink dark:text-ink-dark">
          Товары продавца ({sellerProducts.length})
        </h2>
        <ProductGrid products={sellerProducts} />
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Star;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col items-start gap-1 rounded-xl border border-line px-3 py-2.5 dark:border-line-dark">
      <span className="flex items-center gap-1 text-xs text-ink-soft dark:text-ink-darksoft">
        <Icon size={12} /> {label}
      </span>
      <span className="text-sm font-semibold text-ink dark:text-ink-dark">{value}</span>
    </div>
  );
}
