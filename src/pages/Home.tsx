import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useApp } from '@/store/AppContext';
import { supabase } from '@/lib/supabase';
import { formatCurrency, SUPPORT_TELEGRAM } from '@/lib/i18n';
import type { Product } from '@/lib/supabase';
import ProductCard from '@/components/ProductCard';
import ProductDetailsModal from '@/components/ProductDetailsModal';
import BuyNowModal from '@/components/BuyNowModal';
import FAQ from '@/components/FAQ';
import {
  Search, Package, Users, Activity, Headphones, ArrowDown, Send, Shield,
  Zap, Clock, Lock, CheckCircle, Star, Globe, ChevronRight,
} from 'lucide-react';

type SortKey = 'newest' | 'price_asc' | 'price_desc' | 'stock';

const TICKER_ITEMS = [
  '⚡ Мгновенная доставка',
  '🔒 Безопасные платежи',
  '💎 Премиум аккаунты',
  '🌍 USDT · BTC · ETH · LTC',
  '24/7 Поддержка',
  '✅ Гарантия замены',
  '🚀 iGaming инструменты',
  '💳 Крипто-оплата',
  '⚡ Instant delivery',
  '🔒 Secure payments',
  '💎 Premium accounts',
  '✅ Replacement guarantee',
];

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.12 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

function RevealSection({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(32px)',
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const { ref, visible } = useScrollReveal();
  useEffect(() => {
    if (!visible) return;
    let start = 0;
    const step = Math.ceil(target / 40);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(start);
    }, 30);
    return () => clearInterval(timer);
  }, [visible, target]);
  return <span ref={ref}>{count}{suffix}</span>;
}

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
    if (error) setProducts([]);
    else setProducts(data as Product[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const particles = useMemo(() => (
    Array.from({ length: 24 }).map((_, i) => ({
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

  const handleAddToCart = (product: Product) => {
    if (!session) { toast(t('login'), 'error'); return; }
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
    if (!session) { toast(t('login'), 'error'); return; }
    setDetailsProduct(null);
    setBuyNowProduct(product);
  };

  const steps = lang === 'ru'
    ? [
        { icon: CheckCircle, title: 'Выберите товар', desc: 'Просмотрите каталог и выберите нужные аккаунты, прокси или инструменты.' },
        { icon: Zap, title: 'Оплатите криптой', desc: 'Пополните баланс через USDT, BTC, ETH или LTC. Минимум $10.' },
        { icon: Clock, title: 'Получите мгновенно', desc: 'Товары автоматически появляются в вашем кабинете после оплаты.' },
      ]
    : [
        { icon: CheckCircle, title: 'Choose a product', desc: 'Browse the catalog and pick the accounts, proxies, or tools you need.' },
        { icon: Zap, title: 'Pay with crypto', desc: 'Top up your balance via USDT, BTC, ETH, or LTC. Minimum $10.' },
        { icon: Clock, title: 'Get it instantly', desc: 'Items appear in your cabinet automatically right after payment.' },
      ];

  const features = lang === 'ru'
    ? [
        { icon: Shield, title: 'Гарантия замены', desc: 'Если товар недействителен — заменим в течение 24 часов.' },
        { icon: Lock, title: 'Безопасно', desc: 'Шифрование всех данных. Никаких лишних данных не хранится.' },
        { icon: Globe, title: 'Крипто-оплата', desc: 'USDT TRC20/ERC20, BTC, ETH, LTC — принимаем всё.' },
        { icon: Star, title: 'Премиум качество', desc: 'Только проверенные товары от надёжных поставщиков.' },
      ]
    : [
        { icon: Shield, title: 'Replacement guarantee', desc: 'If an item is invalid we replace it within 24 hours.' },
        { icon: Lock, title: 'Secure by default', desc: 'All data is encrypted. No unnecessary data is stored.' },
        { icon: Globe, title: 'Crypto payments', desc: 'USDT TRC20/ERC20, BTC, ETH, LTC — we accept it all.' },
        { icon: Star, title: 'Premium quality', desc: 'Only verified goods from trusted suppliers.' },
      ];

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 grid-bg" />
        <div className="orb orb-1 h-[350px] w-[350px] left-[5%] top-[5%] bg-violet-600/30" />
        <div className="orb orb-2 h-[280px] w-[280px] right-[10%] top-[15%] bg-cyan-600/25" />
        <div className="orb orb-3 h-[220px] w-[220px] left-[45%] bottom-[0%] bg-lime-500/15" />
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {particles.map((p) => (
            <div key={p.id} className="particle" style={{ left: p.left, animationDelay: p.delay, animationDuration: p.duration }} />
          ))}
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-14 text-center sm:px-6 sm:py-32">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-white/60 animate-fade-in-up sm:text-sm">
            <Shield className="h-3.5 w-3.5 text-lime-400 sm:h-4 sm:w-4" />
            <span>Instant delivery · Crypto · 24/7 support</span>
          </div>

          <h1 className="mb-4 text-5xl font-black tracking-tight text-white sm:text-7xl animate-fade-in-up" style={{ animationDelay: '50ms' }}>
            <span className="bg-gradient-to-r from-violet-400 via-cyan-400 to-lime-400 bg-clip-text text-transparent animated-gradient">
              Digital
            </span>
            <span className="text-white">Traff</span>
          </h1>
          <p className="mx-auto mb-8 max-w-md text-base text-white/50 animate-fade-in-up sm:max-w-xl sm:text-lg" style={{ animationDelay: '100ms' }}>
            {t('heroSubtitle')}
          </p>
          <a
            href="#products"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 px-7 py-3.5 font-semibold text-white transition hover:from-violet-500 hover:to-cyan-500 glow-pulse animate-fade-in-up"
            style={{ animationDelay: '150ms' }}
          >
            {t('heroCta')} <ArrowDown className="h-4 w-4 float" />
          </a>

          {/* Animated stats */}
          <div className="mt-12 grid grid-cols-2 gap-3 sm:mt-16 sm:gap-4 sm:grid-cols-4">
            {[
              { icon: Package, value: 12, suffix: '+', label: lang === 'ru' ? 'Товаров' : 'Products' },
              { icon: Users, value: 10, suffix: 'K+', label: lang === 'ru' ? 'Аккаунтов' : 'Accounts' },
              { icon: Activity, value: 99, suffix: '%', label: lang === 'ru' ? 'Аптайм' : 'Uptime' },
              { icon: Headphones, value: 24, suffix: '/7', label: lang === 'ru' ? 'Поддержка' : 'Support' },
            ].map((s, i) => (
              <div
                key={i}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm transition hover:border-violet-500/30 hover:bg-white/[0.06] card-enter"
                style={{ animationDelay: `${200 + i * 80}ms` }}
              >
                <s.icon className="mx-auto mb-2 h-6 w-6 text-violet-400 float" style={{ animationDelay: `${i * 0.3}s` }} />
                <p className="text-xl font-black text-white sm:text-2xl">
                  <AnimatedCounter target={s.value} suffix={s.suffix} />
                </p>
                <p className="text-xs text-white/50 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Marquee ticker */}
      <div className="ticker-strip overflow-hidden border-b border-white/5 py-2.5">
        <div className="ticker-track flex gap-10 whitespace-nowrap">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span key={i} className="text-xs font-medium text-white/40 shrink-0 flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-violet-500 shrink-0" />
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* How it works */}
      <section className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
        <RevealSection className="mb-10 text-center">
          <span className="inline-block rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-400 mb-3">
            {lang === 'ru' ? 'Как это работает' : 'How it works'}
          </span>
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            {lang === 'ru' ? 'Три шага до вашего заказа' : 'Three steps to your order'}
          </h2>
        </RevealSection>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {steps.map((step, i) => (
            <RevealSection key={i} delay={i * 120}>
              <div className="relative rounded-2xl border border-white/8 bg-white/[0.03] p-6 h-full group hover:border-violet-500/30 hover:bg-white/[0.05] transition-all duration-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/15 border border-violet-500/20 group-hover:bg-violet-500/25 transition">
                    <step.icon className="h-5 w-5 text-violet-400" />
                  </div>
                  <span className="text-3xl font-black text-white/8 select-none">0{i + 1}</span>
                </div>
                <h3 className="mb-2 font-bold text-white">{step.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{step.desc}</p>
                {i < 2 && (
                  <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/10 hidden sm:block" />
                )}
              </div>
            </RevealSection>
          ))}
        </div>
      </section>

      {/* Products */}
      <section id="products" className="relative mx-auto max-w-7xl px-4 pb-12 sm:px-6">
        <div className="mb-6 flex flex-col gap-4">
          <RevealSection>
            <h2 className="text-2xl font-bold text-white">{lang === 'ru' ? 'Каталог товаров' : 'Product Catalog'}</h2>
          </RevealSection>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  category === cat
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20'
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
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-white placeholder-white/30 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition"
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

      {/* Why DigitalTraff */}
      <section className="relative overflow-hidden border-t border-white/5 py-16 sm:py-20">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="orb h-[300px] w-[300px] right-[5%] top-[10%] bg-cyan-600/15" style={{ filter: 'blur(80px)', position: 'absolute', borderRadius: '50%', pointerEvents: 'none' }} />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <RevealSection className="mb-10 text-center">
            <span className="inline-block rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-400 mb-3">
              {lang === 'ru' ? 'Почему мы' : 'Why us'}
            </span>
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              {lang === 'ru' ? 'Почему выбирают DigitalTraff' : 'Why choose DigitalTraff'}
            </h2>
          </RevealSection>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => (
              <RevealSection key={i} delay={i * 100}>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6 h-full group hover:border-cyan-500/20 hover:bg-white/[0.05] transition-all duration-300">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/20 group-hover:bg-cyan-500/20 transition">
                    <f.icon className="h-5 w-5 text-cyan-400" />
                  </div>
                  <h3 className="mb-2 font-bold text-white text-sm">{f.title}</h3>
                  <p className="text-xs text-white/50 leading-relaxed">{f.desc}</p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* Support */}
      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
        <RevealSection>
          <div className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-500/10 via-cyan-500/5 to-violet-500/10 p-6 text-center sm:p-10">
            <div className="absolute inset-0 grid-bg opacity-50" />
            <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-violet-600/10" style={{ filter: 'blur(60px)' }} />
            <div className="relative">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-violet-500/20 border border-violet-500/20">
                <Headphones className="h-7 w-7 text-violet-400 wave" />
              </div>
              <h2 className="mb-2 text-xl font-bold text-white sm:text-2xl">{t('supportTitle')}</h2>
              <p className="mb-6 px-2 text-sm text-white/50 sm:text-base">{t('supportDesc')}</p>
              <a
                href={SUPPORT_TELEGRAM}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-[#229ED9] px-7 py-3 font-semibold text-white transition hover:bg-[#1a8bc4] hover:scale-105 active:scale-100"
              >
                <Send className="h-5 w-5" /> {t('contactSupport')}
              </a>
            </div>
          </div>
        </RevealSection>
      </section>

      <FAQ />

      {/* Footer */}
      <footer className="border-t border-white/5 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-white text-sm">
              <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">Digital</span>Traff
            </span>
          </div>
          <p className="text-xs text-white/30">© 2026 DigitalTraff · digitaltraff.store · All rights reserved</p>
          <a
            href={SUPPORT_TELEGRAM}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition"
          >
            <Send className="h-3.5 w-3.5" />
            @DigitalTraffStore
          </a>
        </div>
      </footer>

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
