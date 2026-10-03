import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/store/AppContext';
import { supabase } from '@/lib/supabase';
import { formatCurrency, SUPPORT_TELEGRAM } from '@/lib/i18n';
import type { Order, OrderItem, Transaction } from '@/lib/supabase';
import {
  ChevronDown, Copy, Check, Eye, EyeOff, Download, FileDown, Package, Receipt,
  User, Send, Wallet, Headphones, Save, Mail, Calendar,
} from 'lucide-react';

export default function Purchases() {
  const { t, lang, session, profile, toast, refreshProfile } = useApp();
  const [orders, setOrders] = useState<(Order & { order_items: OrderItem[] })[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const [telegramInput, setTelegramInput] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const loadData = useCallback(async () => {
    if (!session?.user) return;
    const [ordersRes, txRes] = await Promise.all([
      supabase
        .from('orders')
        .select('*, order_items(*, products:product_id(name_en, name_ru, file_path))')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('transactions')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false }),
    ]);
    if (ordersRes.error) toast(ordersRes.error.message, 'error');
    if (txRes.error) toast(txRes.error.message, 'error');
    setOrders(ordersRes.data as unknown as (Order & { order_items: OrderItem[] })[] || []);
    setTransactions(txRes.data as Transaction[] || []);
    setLoading(false);
  }, [session, toast]);

  useEffect(() => {
    loadData();
    if (profile?.telegram) setTelegramInput(profile.telegram);
  }, [loadData, profile?.telegram]);

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const toggleReveal = (id: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const downloadTxt = (orderId: string, itemName: string, payload: string) => {
    const blob = new Blob([payload || ''], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `order-${orderId}-${itemName.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAllTxt = (order: Order & { order_items: OrderItem[] }) => {
    let content = `Order #${order.id}\nDate: ${new Date(order.created_at).toLocaleString()}\nTotal: ${formatCurrency(order.total, lang)}\n\n`;
    order.order_items.forEach((item) => {
      const name = lang === 'ru' ? item.products?.name_ru : item.products?.name_en;
      content += `=== ${name} (x${item.qty}) ===\n${item.delivered_payload || 'N/A'}\n\n`;
    });
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `order-${order.id}-all.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadFile = async (filePath: string) => {
    const { data, error } = await supabase.storage.from('product-files').createSignedUrl(filePath, 60);
    if (error || !data) {
      toast(error?.message || 'Download failed', 'error');
      return;
    }
    window.open(data.signedUrl, '_blank');
  };

  const handleSaveTelegram = async () => {
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ telegram: telegramInput.trim() || null })
        .eq('id', session!.user.id);
      if (error) throw error;
      await refreshProfile();
      toast(t('profileSaved'), 'success');
    } catch {
      toast(t('profileError'), 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><p className="text-white/40">{t('loading')}</p></div>;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="mb-8 text-3xl font-bold text-white animate-fade-in-up">{t('cabinetTitle')}</h1>

      {/* Profile section */}
      <section className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
        <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold text-white">
          <User className="h-5 w-5 text-violet-400" /> {t('profileInfo')}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <p className="mb-1 text-xs text-white/40">{t('profileUid')}</p>
            <p className="font-mono text-sm text-cyan-400">{profile?.public_uid}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <p className="mb-1 flex items-center gap-1 text-xs text-white/40"><User className="h-3 w-3" /> {t('profileNickname')}</p>
            <p className="text-sm font-medium text-white">{profile?.nickname || '—'}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <p className="mb-1 flex items-center gap-1 text-xs text-white/40"><Wallet className="h-3 w-3" /> {t('profileBalance')}</p>
            <p className="text-sm font-semibold text-lime-400">{formatCurrency(profile?.balance || 0, lang)}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <p className="mb-1 flex items-center gap-1 text-xs text-white/40"><Mail className="h-3 w-3" /> {t('profileEmail')}</p>
            <p className="truncate text-sm text-white/70">{session?.user?.email}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <p className="mb-1 flex items-center gap-1 text-xs text-white/40"><Calendar className="h-3 w-3" /> {t('profileMemberSince')}</p>
            <p className="text-sm text-white/70">
              {profile?.created_at ? new Date(profile.created_at).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US') : '—'}
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <p className="mb-1 flex items-center gap-1 text-xs text-white/40"><Send className="h-3 w-3" /> {t('profileTelegram')}</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={telegramInput}
                onChange={(e) => setTelegramInput(e.target.value)}
                placeholder={t('profileTelegramPlaceholder')}
                className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm text-white placeholder-white/30 focus:border-violet-500 focus:outline-none"
              />
              <button
                onClick={handleSaveTelegram}
                disabled={savingProfile}
                className="shrink-0 rounded-md bg-violet-600 px-2.5 py-1 text-white transition hover:bg-violet-500 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Support section */}
      <section className="mb-8 rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-500/5 to-cyan-500/5 p-5 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20">
              <Headphones className="h-5 w-5 text-violet-400 wave" />
            </div>
            <div>
              <p className="font-semibold text-white">{t('supportTitle')}</p>
              <p className="text-sm text-white/50">{t('supportDesc')}</p>
            </div>
          </div>
          <a
            href={SUPPORT_TELEGRAM}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-2 rounded-lg bg-[#229ED9] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1a8bc4]"
          >
            <Send className="h-4 w-4" /> Telegram
          </a>
        </div>
      </section>

      {/* Orders */}
      <section className="mb-10">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-white animate-fade-in-up" style={{ animationDelay: '150ms' }}>
          <Package className="h-5 w-5 text-violet-400" /> {t('purchases')}
        </h2>
        {orders.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] py-12 text-center text-white/40">{t('noOrders')}</p>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const isOpen = expanded === order.id;
              return (
                <div key={order.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition hover:border-white/20">
                  <button
                    onClick={() => setExpanded(isOpen ? null : order.id)}
                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-white/5"
                  >
                    <div>
                      <p className="font-mono text-sm text-white/50">#{order.id.slice(0, 8)}</p>
                      <p className="text-sm text-white/40">{new Date(order.created_at).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-white">{formatCurrency(order.total, lang)}</span>
                      <ChevronDown className={`h-5 w-5 text-white/40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t border-white/10 p-5">
                      <div className="mb-3 flex justify-end">
                        <button
                          onClick={() => downloadAllTxt(order)}
                          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/70 transition hover:bg-white/10"
                        >
                          <FileDown className="h-4 w-4" /> {t('downloadAll')}
                        </button>
                      </div>
                      <div className="space-y-3">
                        {order.order_items.map((item) => {
                          const name = lang === 'ru' ? item.products?.name_ru : item.products?.name_en;
                          const itemKey = `${order.id}-${item.id}`;
                          const isRevealed = revealed.has(itemKey);
                          return (
                            <div key={item.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                              <div className="mb-2 flex items-center justify-between">
                                <p className="font-medium text-white">{name} <span className="text-white/40">x{item.qty}</span></p>
                                <span className="text-sm text-white/50">{formatCurrency(item.price * item.qty, lang)}</span>
                              </div>
                              {item.delivered_payload && (
                                <div className="mb-3">
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => toggleReveal(itemKey)} className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300">
                                      {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                      {isRevealed ? t('hideCredentials') : t('showCredentials')}
                                    </button>
                                  </div>
                                  {isRevealed && (
                                    <pre className="mt-2 max-h-40 overflow-y-auto rounded-lg bg-black/30 p-3 text-xs text-lime-400 whitespace-pre-wrap break-all">{item.delivered_payload}</pre>
                                  )}
                                </div>
                              )}
                              <div className="flex flex-wrap gap-2">
                                {item.delivered_payload && (
                                  <>
                                    <button onClick={() => copy(item.delivered_payload || '', itemKey)} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-white/60 hover:bg-white/10">
                                      {copied === itemKey ? <Check className="h-3 w-3 text-lime-400" /> : <Copy className="h-3 w-3" />}
                                      {t('copy')}
                                    </button>
                                    <button onClick={() => downloadTxt(order.id, name || 'item', item.delivered_payload || '')} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-white/60 hover:bg-white/10">
                                      <Download className="h-3 w-3" /> {t('downloadTxt')}
                                    </button>
                                  </>
                                )}
                                {item.products?.file_path && (
                                  <button onClick={() => downloadFile(item.products!.file_path!)} className="flex items-center gap-1.5 rounded-lg border border-violet-500/30 px-2.5 py-1 text-xs text-violet-400 hover:bg-violet-500/10">
                                    <FileDown className="h-3 w-3" /> {t('downloadFile')}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Transactions */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-white animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <Receipt className="h-5 w-5 text-cyan-400" /> {t('transactions')}
        </h2>
        {transactions.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] py-12 text-center text-white/40">{t('noTransactions')}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-white/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">{t('txDate')}</th>
                  <th className="px-4 py-3 text-left font-medium">{t('txAmount')}</th>
                  <th className="px-4 py-3 text-left font-medium">{t('txType')}</th>
                  <th className="px-4 py-3 text-left font-medium">{t('txStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-t border-white/5 text-white/70 transition hover:bg-white/[0.02]">
                    <td className="px-4 py-3">{new Date(tx.created_at).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US')}</td>
                    <td className="px-4 py-3 font-semibold text-white">{formatCurrency(tx.amount, lang)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        tx.purchase_type === 'direct' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-violet-500/20 text-violet-400'
                      }`}>
                        {tx.purchase_type === 'direct' ? t('txTypeDirect') : t('txTypeTopup')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        tx.status === 'finished' ? 'bg-lime-500/20 text-lime-400' :
                        tx.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        tx.status === 'partially_paid' ? 'bg-orange-500/20 text-orange-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>{tx.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
