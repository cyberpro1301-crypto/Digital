import { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '@/store/AppContext';
import { supabase } from '@/lib/supabase';
import { formatCurrency, SUPPORT_TELEGRAM } from '@/lib/i18n';
import type { Product } from '@/lib/supabase';
import ProductCard from '@/components/ProductCard';
import ProductDetailsModal from '@/components/ProductDetailsModal';
import BuyNowModal from '@/components/BuyNowModal';
import FAQ from '@/components/FAQ';
import { Search, Package, Users, Activity, Headphones, ArrowDown, Send, Shield, Zap } from 'lucide-react';

type SortKey = 'newest' | 'price_asc' | 'price_desc' | 'stock';

export default function Home() {
  const { t, lang, addToCart, session, toast } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [detailsProduct, setDetailsProduct] = useState<Product | null>(null);
  const [buyNowProduct, setBuyNowProduct] = useState<Product | null>(null);

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

  const particles = useMemo(() => (
    Array.from({ length: 20 }).map((_, i) => ({
      id: i,
      left: `${(i * 37) % 100}%`,
      delay: `${(i * 0.7) % 15}s`,
      duration: `${12 + (i % 8)}s`,
    }))
  ), []);

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

  const handleAddToCart = (product: Product) => {
    if (!session) {
      toast(t('login'), 'error');
      return;
    }
    addToCart({
      product_id: product.id,
      name_en: product.name_en,
      name_ru: product.name_ru,
      price: product.price,
      qty: 1,
      stock: product.stock,
      has_file: product.has_file,
      is_unlimited: product.is_unlimited,
    });
    const name = lang === 'ru' ? product.name_ru : product.name_en;
    toast(name + ' — ' + t('addToCart'), 'success');
    setDetailsProduct(null);
  };

  const handleBuyNow = (product: Product) => {
    if (!session) {
      toast(t('login'), 'error');
      return;
    }
    setDetailsProduct(null);
    setBuyNowProduct(product);
  };

  return (
    <div>
      {/* Hero with live background */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 grid-bg" />
        {/* Floating orbs */}
        <div className="orb orb-1 h-[300px] w-[300px] left-[10%] top-[10%] bg-violet-600/30" />
        <div className="orb orb-2 h-[250px] w-[250px] right-[15%] top-[20%] bg-cyan-600/25" />
        <div className="orb orb-3 h-[200px] w-[200px] left-[40%] bottom-[5%] bg-lime-500/15" />
        {/* Particles */}
        <div className="absolute inset-0 overflow-hidden">
          {particles.map((p) => (
            <div
              key={p.id}
              className="particle"
              style={{ left: p.left, animationDelay: p.delay, animationDuration: p.duration }}
            />
          ))}
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-12 text-center sm:px-6 sm:py-28">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60 animate-fade-in-up sm:gap-2 sm:px-4 sm:text-sm">
            <Shield className="h-3.5 w-3.5 text-lime-400 sm:h-4 sm:w-4" />
            <span className="hidden xs:inline">Instant delivery · Crypto · 24/7 support</span>
            <span className="xs:hidden">Instant · Crypto · 24/7</span>
          </div>

          <h1 className="mb-4 text-4xl font-black tracking-tight text-white sm:text-6xl animate-fade-in-up" style={{ animationDelay: '50ms' }}>
            <span className="bg-gradient-to-r from-violet-400 via-cyan-400 to-lime-400 bg-clip-text text-transparent animated-gradient">
              {t('heroTitle')}
            </span>
          </h1>
          <p className="mx-auto mb-8 max-w-md text-base text-white/50 animate-fade-in-up sm:max-w-xl sm:text-lg" style={{ animationDelay: '100ms' }}>{t('heroSubtitle')}</p>
          <a
            href="#products"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 px-6 py-3 font-semibold text-white transition hover:from-violet-500 hover:to-cyan-500 glow-pulse animate-fade-in-up"
            style={{ animationDelay: '150ms' }}
          >
            {t('heroCta')} <ArrowDown className="h-4 w-4 float" />
          </a>
          <div className="mt-10 grid grid-cols-2 gap-2 sm:mt-14 sm:gap-4 sm:grid-cols-4">
            {stats.map((s, i) => (
              <div
                key={i}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-sm transition hover:border-violet-500/20 hover:bg-white/[0.05] card-enter sm:p-4"
                style={{ animationDelay: `${200 + i * 80}ms` }}
              >
                <s.icon className="mx-auto mb-2 h-6 w-6 text-violet-400 float" style={{ animationDelay: `${i * 0.3}s` }} />
                <p className="text-xs font-semibold text-white/80 sm:text-sm">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products */}
      <section id="products" className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="mb-6 flex flex-col gap-4">
          <h2 className="text-2xl font-bold text-white animate-fade-in-up">{t('all')} {t('adminProducts')}</h2>
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
              <ProductCard key={p.id} product={p} index={i} onDetails={setDetailsProduct} onBuyNow={handleBuyNow} />
            ))}
          </div>
        )}
      </section>

      {/* Support section */}
      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
        <div className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-500/10 via-cyan-500/5 to-violet-500/10 p-6 text-center sm:p-8">
          <div className="absolute inset-0 grid-bg opacity-50" />
          <div className="relative">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-violet-500/20">
              <Headphones className="h-7 w-7 text-violet-400 wave" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-white sm:text-2xl">{t('supportTitle')}</h2>
            <p className="mb-6 px-2 text-sm text-white/50 sm:text-base">{t('supportDesc')}</p>
            <a
              href={SUPPORT_TELEGRAM}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-[#229ED9] px-6 py-3 font-semibold text-white transition hover:bg-[#1a8bc4]"
            >
              <Send className="h-5 w-5" /> {t('contactSupport')}
            </a>
          </div>
        </div>
      </section>

      <FAQ />

      {/* Modals */}
      <ProductDetailsModal
        product={detailsProduct}
        open={!!detailsProduct}
        onClose={() => setDetailsProduct(null)}
        onAddToCart={() => detailsProduct && handleAddToCart(detailsProduct)}
        onBuyNow={() => detailsProduct && handleBuyNow(detailsProduct)}
      />
      <BuyNowModal
        product={buyNowProduct}
        open={!!buyNowProduct}
        onClose={() => setBuyNowProduct(null)}
      />
    </div>
  );
}
