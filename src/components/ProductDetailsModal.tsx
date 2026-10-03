import { useApp } from '@/store/AppContext';
import { formatCurrency } from '@/lib/i18n';
import type { Product } from '@/lib/supabase';
import Modal from './Modal';
import { FileText, Flame, Award, Package, ShoppingCart, Zap, X } from 'lucide-react';

type Props = {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onAddToCart: () => void;
  onBuyNow: () => void;
};

export default function ProductDetailsModal({ product, open, onClose, onAddToCart, onBuyNow }: Props) {
  const { t, lang, session } = useApp();
  if (!product) return null;

  const name = lang === 'ru' ? product.name_ru : product.name_en;
  const desc = lang === 'ru' ? product.description_ru : product.description_en;
  const details = lang === 'ru' ? product.details_ru : product.details_en;
  const outOfStock = !product.is_unlimited && product.stock === 0;

  return (
    <Modal open={open} onClose={onClose} title={name} maxWidth="max-w-2xl">
      <div className="space-y-5">
        <div className="flex items-center gap-3 animate-fade-in">
          {product.badge && (
            <span className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
              product.badge === 'HOT'
                ? 'bg-red-500/20 text-red-400 pulse-ring'
                : 'bg-lime-500/20 text-lime-400'
            }`}>
              {product.badge === 'HOT' ? <Flame className="h-3 w-3" /> : <Award className="h-3 w-3" />}
              {product.badge === 'HOT' ? t('hot') : t('bestValue')}
            </span>
          )}
          <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-cyan-400">
            {t(product.category as 'bundles' | 'accounts' | 'proxies' | 'cards' | 'tools')}
          </span>
        </div>

        <p className="text-white/60 leading-relaxed animate-fade-in-up">{desc}</p>

        {details && (
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-5 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-white">
              <Package className="h-4 w-4 text-violet-400" />
              {t('whatsIncluded')}
            </h3>
            <div className="space-y-2">
              {details.split('\n').filter(Boolean).map((line, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-white/70">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                  <span>{line.trim()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 text-sm text-white/50 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
          {product.has_file && (
            <span className="flex items-center gap-1.5 text-violet-400">
              <FileText className="h-4 w-4" /> {t('includesFile')}
            </span>
          )}
          {!product.is_unlimited && (
            <span className={outOfStock ? 'text-red-400' : 'text-lime-400'}>
              {product.stock} {t('inStock')}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-white/10 pt-5 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <span className="text-2xl font-bold text-white">{formatCurrency(product.price, lang)}</span>
          <div className="flex gap-3">
            <button
              onClick={onAddToCart}
              disabled={outOfStock}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ShoppingCart className="h-4 w-4" /> {t('addToCart')}
            </button>
            <button
              onClick={onBuyNow}
              disabled={outOfStock || !session}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:from-violet-500 hover:to-cyan-500 disabled:cursor-not-allowed disabled:opacity-40 glow-pulse"
            >
              <Zap className="h-4 w-4" /> {t('buyNow')}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
