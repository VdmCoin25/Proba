import { Marquee } from '@/components/layout/Marquee';
import { Hero } from '@/components/home/Hero';
import { CategoriesSection } from '@/components/home/CategoriesSection';
import { TrendingSection } from '@/components/home/TrendingSection';
import { HotDeals } from '@/components/home/HotDeals';

export function HomePage() {
  return (
    <>
      <Marquee />
      <Hero />
      <CategoriesSection />
      <TrendingSection />
      <HotDeals />
    </>
  );
}
