import { useApp } from '@/store/AppContext';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/i18n';
import { X, Minus, Plus, Trash2, ShoppingCart, Wallet } from 'lucide-react';
import { useState } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  onOpenTopUp: () => void;
};

export default function CartDrawer({ open, onClose, onOpenTopUp }: Props) {
  const { t, lang, cart, removeFromCart, updateQty, clearCart, cartTotal, profile, session, toast } = useApp();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [shortfall, setShortfall] = useState<number | null>(null);

  const handleCheckout = async () => {
    if (!session) {
      toast(t('login'), 'error');
      return;
    }
    setCheckoutLoading(true);
    setShortfall(null);
    try {
      const items = cart.map((c) => ({ product_id: c.product_id, qty: c.qty }));
      const { data, error } = await supabase.rpc('purchase', { items });
      if (error) throw error;
      toast(t('purchaseSuccess'), 'success');
      clearCart();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('purchaseError');
      if (msg.toLowerCase().includes('balance')) {
        const needed = cartTotal - (profile?.balance || 0);
        setShortfall(Math.max(0, needed));
        toast(t('insufficientBalance', { shortfall: formatCurrency(needed, lang) }), 'error');
      } else {
        toast(msg, 'error');
      }
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-[140] bg-black/60 backdrop-blur-sm transition-opacity ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
      />
      <div
        className={`fixed right-0 top-0 z-[141] h-full w-full max-w-md border-l border-white/10 bg-[#0d0d18] transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-4 sm:px-5">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <ShoppingCart className="h-5 w-5 text-violet-400" />
            {t('cartTitle')}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex h-[calc(100%-64px)] flex-col">
          {cart.length === 0 ? (
            <div className="flex flex-1 items-center justify-center p-8">
              <p className="text-center text-white/40">{t('cartEmpty')}</p>
            </div>
          ) : (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
                {cart.map((item) => (
                  <div key={item.product_id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <p className="font-medium text-white">{lang === 'ru' ? item.name_ru : item.name_en}</p>
                      <button
                        onClick={() => removeFromCart(item.product_id)}
                        className="shrink-0 text-white/40 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQty(item.product_id, item.qty - 1)}
                          className="rounded-md bg-white/10 p-1 text-white/70 hover:bg-white/20"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-[2rem] text-center text-sm text-white">{item.qty}</span>
                        <button
                          onClick={() => updateQty(item.product_id, item.qty + 1)}
                          disabled={item.is_unlimited ? item.qty >= 99 : item.qty >= item.stock}
                          className="rounded-md bg-white/10 p-1 text-white/70 hover:bg-white/20 disabled:opacity-30"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <span className="font-semibold text-white">{formatCurrency(item.price * item.qty, lang)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-white/10 p-4 sm:p-5">
                {shortfall !== null && shortfall > 0 && (
                  <div className="mb-3 flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-400">
                    <Wallet className="h-4 w-4 shrink-0" />
                    {t('insufficientBalance', { shortfall: formatCurrency(shortfall, lang) })}
                  </div>
                )}
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-white/70">{t('cartTotal')}</span>
                  <span className="text-xl font-bold text-white">{formatCurrency(cartTotal, lang)}</span>
                </div>
                {shortfall !== null && shortfall > 0 ? (
                  <button
                    onClick={() => { onClose(); onOpenTopUp(); }}
                    className="w-full rounded-lg bg-gradient-to-r from-cyan-600 to-cyan-500 py-2.5 font-semibold text-white transition hover:from-cyan-500 hover:to-cyan-400"
                  >
                    {t('topUp')}
                  </button>
                ) : (
                  <button
                    onClick={handleCheckout}
                    disabled={checkoutLoading}
                    className="w-full rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 py-2.5 font-semibold text-white transition hover:from-violet-500 hover:to-violet-400 disabled:opacity-50"
                  >
                    {checkoutLoading ? t('loading') : t('checkout')}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
