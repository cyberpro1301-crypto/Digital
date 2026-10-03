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
  order_id: string;
  access_token: string;
  pay_address: string;
  pay_amount: number;
  pay_currency: string;
  amount: number;
};

type Props = {
  product: Product | null;
  open: boolean;
  onClose: () => void;
};

export default function BuyNowModal({ product, open, onClose }: Props) {
  const { t, lang, session, toast } = useApp();
  const [currency, setCurrency] = useState('usdttrc20');
  const [contact, setContact] = useState('');
  const [payment, setPayment] = useState<PaymentState | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('pending');
  const [delivered, setDelivered] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const ru = lang === 'ru';

  useEffect(() => {
    if (!open) {
      setPayment(null);
      setStatus('pending');
      setDelivered(null);
      setFileUrl(null);
      if (pollRef.current) clearInterval(pollRef.current);
    } else if (!contact && session?.user?.email) {
      setContact(session.user.email);
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
      try {
        const { data, error } = await supabase.functions.invoke('get-guest-order', {
          body: { token: payment.access_token },
        });
        if (error || !data || data.error) return;
        setStatus(data.status);
        if (data.status === 'paid') {
          setDelivered(data.delivered_payload ?? null);
          setFileUrl(data.file_url ?? null);
          toast(t('directPurchaseSuccess'), 'success');
          if (pollRef.current) clearInterval(pollRef.current);
        } else if (data.status === 'expired' || data.status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        // сетевая ошибка: попробуем в следующий раз
      }
    }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [payment, open]);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCreate = async () => {
    if (!product) return;
    if (contact.trim().length < 3) {
      toast(ru ? 'Укажите контакт (Telegram или email)' : 'Enter a contact (Telegram or email)', 'error');
      return;
    }
    setLoading(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('create-guest-payment', {
        body: {
          product_id: product.id,
          qty: 1,
          contact: contact.trim(),
          currency,
        },
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setPayment({
        order_id: data.order_id,
        access_token: data.access_token,
        pay_address: data.pay_address,
        pay_amount: data.pay_amount,
        pay_currency: data.pay_currency,
        amount: data.amount,
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
  const productName = ru ? product.name_ru : product.name_en;
  const paid = status === 'paid';

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
            <label className="mb-1.5 block text-sm text-white/70">
              {ru ? 'Контакт (Telegram или email)' : 'Contact (Telegram or email)'}
            </label>
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="@username / name@mail.com"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-white placeholder-white/30 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>

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
          {paid ? (
            <div className="space-y-4 py-2 text-center animate-bounce-in">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-lime-500/10">
                <Check className="h-7 w-7 text-lime-400" />
              </div>
              <p className="text-lg font-semibold text-white">{t('directPurchaseSuccess')}</p>

              {delivered && (
                <div className="space-y-2 text-left">
                  <label className="block text-xs text-white/50">
                    {ru ? 'Ваш заказ (сохраните!)' : 'Your order (save it!)'}
                  </label>
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/90">{delivered}</pre>
                  <button
                    onClick={() => copy(delivered, 'payload')}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 py-2 text-sm text-white hover:bg-white/10"
                  >
                    {copied === 'payload' ? <Check className="h-4 w-4 text-lime-400" /> : <Copy className="h-4 w-4" />}
                    {ru ? 'Скопировать' : 'Copy'}
                  </button>
                </div>
              )}

              {fileUrl && (
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block w-full rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 py-2.5 text-center font-semibold text-white"
                >
                  {ru ? 'Скачать файл (ссылка действует 1 час)' : 'Download file (link valid 1 hour)'}
                </a>
              )}

              <button onClick={onClose} className="text-sm text-white/50 hover:text-white">
                {ru ? 'Закрыть' : 'Close'}
              </button>
            </div>
          ) : status === 'expired' || status === 'failed' ? (
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

              {status === 'partially_paid' && (
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
