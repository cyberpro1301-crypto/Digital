import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/store/AppContext';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/lib/supabase';
import ProductCard from '@/components/ProductCard';
import FAQ from '@/components/FAQ';
import { Search, Package, Users, Activity, Headphones, ArrowDown } from 'lucide-react';

type SortKey = 'newest' | 'price_asc' | 'price_desc' | 'stock';

export default function Home() {
  const { t, lang } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');

  const categories = ['all', 'bundles', 'accounts', 'proxies', 'cards', 'tools'];

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('products_public').select('*');
    if (error) {
      setProducts([]);
    } else {
      setProducts(data as Product[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  let filtered = products;
  if (category !== 'all') filtered = filtered.filter((p) => p.category === category);
  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter((p) =>
      p.name_en.toLowerCase().includes(q) ||
      p.name_ru.toLowerCase().includes(q) ||
      p.description_en.toLowerCase().includes(q) ||
      p.description_ru.toLowerCase().includes(q),
    );
  }
  switch (sort) {
    case 'price_asc': filtered = [...filtered].sort((a, b) => a.price - b.price); break;
    case 'price_desc': filtered = [...filtered].sort((a, b) => b.price - a.price); break;
    case 'stock': filtered = [...filtered].sort((a, b) => b.stock - a.stock); break;
    default: filtered = [...filtered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  const stats = [
    { icon: Package, label: t('statProducts') },
    { icon: Users, label: t('statAccounts') },
    { icon: Activity, label: t('statUptime') },
    { icon: Headphones, label: t('statSupport') },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 grid-bg" />
        <div className="absolute left-1/2 top-0 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-violet-600/20 blur-[120px]" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <h1 className="mb-4 text-5xl font-black tracking-tight text-white sm:text-6xl">
            <span className="bg-gradient-to-r from-violet-400 via-cyan-400 to-lime-400 bg-clip-text text-transparent">
              {t('heroTitle')}
            </span>
          </h1>
          <p className="mx-auto mb-8 max-w-xl text-lg text-white/50">{t('heroSubtitle')}</p>
          <a
            href="#products"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 px-6 py-3 font-semibold text-white transition hover:from-violet-500 hover:to-cyan-500"
          >
            {t('heroCta')} <ArrowDown className="h-4 w-4" />
          </a>
          <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map((s, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm">
                <s.icon className="mx-auto mb-2 h-6 w-6 text-violet-400" />
                <p className="text-sm font-semibold text-white/80">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products */}
      <section id="products" className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="mb-6 flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  category === cat
                    ? 'bg-violet-600 text-white'
                    : 'border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                {cat === 'all' ? t('all') : t(cat as 'bundles' | 'accounts' | 'proxies' | 'cards' | 'tools')}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('search')}
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-white placeholder-white/30 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-white focus:border-violet-500 focus:outline-none"
            >
              <option value="newest" className="bg-[#0d0d18]">{t('sortNewest')}</option>
              <option value="price_asc" className="bg-[#0d0d18]">{t('sortPriceAsc')}</option>
              <option value="price_desc" className="bg-[#0d0d18]">{t('sortPriceDesc')}</option>
              <option value="stock" className="bg-[#0d0d18]">{t('sortStock')}</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl border border-white/10 bg-white/[0.02]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-white/40">{t('noProducts')}</p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        )}
      </section>

      <FAQ />
    </div>
  );
}
