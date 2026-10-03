import { useApp } from '@/store/AppContext';
import { formatCurrency } from '@/lib/i18n';
import type { Product } from '@/lib/supabase';
import { FileText, Plus, Flame, Award, Zap, Eye } from 'lucide-react';

type Props = {
  product: Product;
  index: number;
  onDetails: (product: Product) => void;
  onBuyNow: (product: Product) => void;
};

export default function ProductCard({ product, index, onDetails, onBuyNow }: Props) {
  const { t, lang, addToCart, session, toast } = useApp();
  const outOfStock = !product.is_unlimited && product.stock === 0;
  const name = lang === 'ru' ? product.name_ru : product.name_en;
  const desc = lang === 'ru' ? product.description_ru : product.description_en;

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleBuyNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!session) {
      toast(t('login'), 'error');
      return;
    }
    if (outOfStock) return;
    onBuyNow(product);
  };

  return (
    <div
      onClick={() => onDetails(product)}
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-5 transition-all duration-300 hover:-translate-y-1.5 hover:border-violet-500/40 hover:shadow-[0_0_40px_-8px_rgba(139,92,246,0.4)] card-enter"
      style={{ animationDelay: `${Math.min(index * 60, 600)}ms` }}
    >
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-violet-600/0 via-cyan-600/0 to-violet-600/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-hover:from-violet-600/[0.03] group-hover:via-cyan-600/[0.02] group-hover:to-violet-600/[0.03]" />

      {product.badge && (
        <div className="absolute right-3 top-3">
          {product.badge === 'HOT' ? (
            <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-2.5 py-1 text-xs font-bold text-red-400 pulse-ring">
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
      <p className="mb-4 flex-1 text-sm leading-relaxed text-white/50 line-clamp-2">{desc}</p>

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
        <span className="ml-auto flex items-center gap-1 text-violet-400 opacity-0 transition-opacity group-hover:opacity-100">
          <Eye className="h-3.5 w-3.5" /> {t('viewDetails')}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-xl font-bold text-white">{formatCurrency(product.price, lang)}</span>
        <div className="flex gap-2">
          <button
            onClick={handleAdd}
            disabled={outOfStock}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={handleBuyNow}
            disabled={outOfStock}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:from-violet-500 hover:to-cyan-500 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Zap className="h-4 w-4" /> {t('buyNow')}
          </button>
        </div>
      </div>
    </div>
  );
}
