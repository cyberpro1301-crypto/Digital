import { useApp } from '@/store/AppContext';
import { formatCurrency } from '@/lib/i18n';
import type { Product } from '@/lib/supabase';
import { FileText, Plus, Flame, Award } from 'lucide-react';

type Props = {
  product: Product;
  index: number;
};

export default function ProductCard({ product, index }: Props) {
  const { t, lang, addToCart, session, toast } = useApp();
  const outOfStock = !product.is_unlimited && product.stock === 0;
  const name = lang === 'ru' ? product.name_ru : product.name_en;
  const desc = lang === 'ru' ? product.description_ru : product.description_en;

  const handleAdd = () => {
    if (!session) {
      toast(t('login'), 'error');
      return;
    }
    if (outOfStock) return;
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
    toast(name + ' — ' + t('addToCart'), 'success');
  };

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-5 transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/30 hover:shadow-[0_0_30px_-5px_rgba(139,92,246,0.3)] animate-fade-in-up"
      style={{ animationDelay: `${Math.min(index * 60, 600)}ms` }}
    >
      {product.badge && (
        <div className="absolute right-3 top-3">
          {product.badge === 'HOT' ? (
            <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-2.5 py-1 text-xs font-bold text-red-400 animate-pulse">
              <Flame className="h-3 w-3" /> {t('hot')}
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full bg-lime-500/20 px-2.5 py-1 text-xs font-bold text-lime-400">
              <Award className="h-3 w-3" /> {t('bestValue')}
            </span>
          )}
        </div>
      )}

      <div className="mb-3 mt-2">
        <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-cyan-400">
          {t(product.category as 'bundles' | 'accounts' | 'proxies' | 'cards' | 'tools')}
        </span>
      </div>

      <h3 className="mb-2 text-lg font-bold leading-snug text-white">{name}</h3>
      <p className="mb-4 flex-1 text-sm leading-relaxed text-white/50 line-clamp-3">{desc}</p>

      <div className="mb-4 flex items-center gap-3 text-xs text-white/40">
        {product.has_file && (
          <span className="flex items-center gap-1 text-violet-400" title={t('includesFile')}>
            <FileText className="h-3.5 w-3.5" /> {t('includesFile')}
          </span>
        )}
        {!product.is_unlimited && (
          <span className={outOfStock ? 'text-red-400' : ''}>
            {product.stock} {t('inStock')}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xl font-bold text-white">{formatCurrency(product.price, lang)}</span>
        <button
          onClick={handleAdd}
          disabled={outOfStock}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:from-violet-500 hover:to-violet-400 disabled:cursor-not-allowed disabled:from-gray-700 disabled:to-gray-700 disabled:text-white/30"
        >
          {outOfStock ? (
            t('outOfStock')
          ) : (
            <>
              <Plus className="h-4 w-4" /> {t('addToCart')}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
