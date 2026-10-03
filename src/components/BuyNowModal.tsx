import { useState, useEffect, useRef } from 'react';
import { useApp } from '@/store/AppContext';
import { supabase } from '@/lib/supabase';
import Modal from './Modal';
import QRCode from './QRCode';
import { formatCurrency } from '@/lib/i18n';
import type { Product } from '@/lib/supabase';
import { Copy, Check, Clock, Loader2, Zap, ShoppingBag } from 'lucide-react';

const CURRENCIES = [
  { id: 'usdttrc20', label: 'USDT (TRC20)' },
  { id: 'usdterc20', label: 'USDT (ERC20)' },
  { id: 'btc', label: 'BTC' },
  { id: 'eth', label: 'ETH' },
  { id: 'ltc', label: 'LTC' },
];

type PaymentState = {
  transaction_id: string;
  payment_id: string;
  pay_address: string;
  pay_amount: number;
  pay_currency: string;
};

type Props = {
  product: Product | null;
  open: boolean;
  onClose: () => void;
};

export default function BuyNowModal({ product, open, onClose }: Props) {
  const { t, lang, session, toast, refreshProfile } = useApp();
  const [currency, setCurrency] = useState('usdttrc20');
  const [payment, setPayment] = useState<PaymentState | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string>('pending');
  const [fulfilled, setFulfilled] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open) {
      setPayment(null);
      setTxStatus('pending');
      setFulfilled(false);
      if (pollRef.current) clearInterval(pollRef.current);
    }
  }, [open]);

  useEffect(() => {
    if (!payment || !open) return;
    const deadline = Date.now() + 30 * 60 * 1000;
    setTimeLeft(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
    const timer = setInterval(() => {
      const left = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
      setTimeLeft(left);
      if (left === 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [payment, open]);

  useEffect(() => {
    if (!payment || !open) return;
    pollRef.current = setInterval(async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('status')
        .eq('id', payment.transaction_id)
        .maybeSingle();
      if (error) return;
      if (data) {
        setTxStatus(data.status);
        if (data.status === 'finished') {
          try {
            const { error: rpcErr } = await supabase.rpc('direct_purchase_fulfill', {
              tx_id: payment.transaction_id,
            });
            if (rpcErr) throw rpcErr;
            setFulfilled(true);
            await refreshProfile();
            toast(t('directPurchaseSuccess'), 'success');
          } catch {
            toast(t('purchaseError'), 'error');
          }
          if (pollRef.current) clearInterval(pollRef.current);
          setTimeout(() => onClose(), 3000);
        } else if (data.status === 'expired' || data.status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }
    }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [payment, open, refreshProfile, toast, t]);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCreate = async () => {
       if (!product) return;
    setLoading(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('create-guest-payment', {
        body: {
          product_id: product.id,
          qty: 1,
          contact: session?.user?.email ?? 'guest',
          currency,
        },
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setPayment({
        transaction_id: data.transaction_id,
        payment_id: data.payment_id,
        pay_address: data.pay_address,
        pay_amount: data.pay_amount,
        pay_currency: data.pay_currency,
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Payment creation failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  if (!product) return null;
  const productName = lang === 'ru' ? product.name_ru : product.name_en;

  return (
    <Modal open={open} onClose={onClose} title={t('buyNowTitle')} maxWidth="max-w-lg">
      {!payment ? (
        <div className="space-y-5">
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/20">
                <ShoppingBag className="h-5 w-5 text-violet-400" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-white">{productName}</p>
                <p className="text-sm text-white/50">{formatCurrency(product.price, lang)}</p>
              </div>
            </div>
          </div>
          <p className="text-sm text-white/50">{t('buyNowDesc')}</p>
          <div>
            <label className="mb-1.5 block text-sm text-white/70">{t('currency')}</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-white focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              {CURRENCIES.map((c) => (
                <option key={c.id} value={c.id} className="bg-[#0d0d18]">{c.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 py-2.5 font-semibold text-white transition hover:from-violet-500 hover:to-cyan-500 disabled:opacity-50 glow-pulse"
          >
            {loading ? t('loading') : (
              <span className="flex items-center justify-center gap-2">
                <Zap className="h-4 w-4" />
                {t('buyNowConfirm', { amount: formatCurrency(product.price, lang), currency: currency.toUpperCase() })}
              </span>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {fulfilled ? (
            <div className="py-8 text-center animate-bounce-in">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-lime-500/10">
                <Check className="h-7 w-7 text-lime-400" />
              </div>
              <p className="text-lg font-semibold text-white">{t('directPurchaseSuccess')}</p>
            </div>
          ) : txStatus === 'expired' || txStatus === 'failed' ? (
            <div className="py-8 text-center">
              <p className="text-lg font-semibold text-red-400">{t('paymentExpired')}</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                <span className="flex items-center gap-2 text-sm text-white/70">
                  <Clock className="h-4 w-4" /> {t('timeLeft')}
                </span>
                <span className={`font-mono font-bold ${timeLeft < 60 ? 'text-red-400' : 'text-white'}`}>
                  {mins}:{secs.toString().padStart(2, '0')}
                </span>
              </div>

              {txStatus === 'partially_paid' && (
                <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-400">
                  {t('paymentPartiallyPaid')}
                </div>
              )}

              <div className="flex justify-center">
                <QRCode data={payment.pay_address} size={200} />
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-white/50">{t('payAddress')}</label>
                  <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <code className="flex-1 truncate text-sm text-white/90">{payment.pay_address}</code>
                    <button onClick={() => copy(payment.pay_address, 'addr')} className="shrink-0 text-white/50 hover:text-white">
                      {copied === 'addr' ? <Check className="h-4 w-4 text-lime-400" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-white/50">{t('payAmount')} ({payment.pay_currency.toUpperCase()})</label>
                  <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <code className="flex-1 text-sm text-white/90">{payment.pay_amount}</code>
                    <button onClick={() => copy(String(payment.pay_amount), 'amt')} className="shrink-0 text-white/50 hover:text-white">
                      {copied === 'amt' ? <Check className="h-4 w-4 text-lime-400" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-sm text-white/50">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('directPurchasePending')}
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
