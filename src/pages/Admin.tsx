import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/store/AppContext';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/i18n';
import type { Product } from '@/lib/supabase';
import Modal from '@/components/Modal';
import {
  Plus, Pencil, Trash2, Package, Boxes, ShoppingCart, DollarSign, Search,
  Upload, X, FileText, Layers, Users, Wallet,
} from 'lucide-react';

type AdminProduct = Product & { file_path?: string };

type AdminUser = {
  id: string;
  public_uid: string;
  role: string;
  balance: number;
  nickname: string | null;
  telegram: string | null;
  created_at: string;
};

type Tab = 'products' | 'users' | 'orders';

export default function Admin() {
  const { t, lang, toast } = useApp();
  const [tab, setTab] = useState<Tab>('products');
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [orders, setOrders] = useState<(Record<string, unknown> & { id: string; total: number; created_at: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<AdminProduct | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<AdminProduct | null>(null);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockProduct, setStockProduct] = useState('');
  const [stockPayloads, setStockPayloads] = useState('');
  const [totalStock, setTotalStock] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [balanceModalUser, setBalanceModalUser] = useState<AdminUser | null>(null);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceMode, setBalanceMode] = useState<'add' | 'subtract'>('add');

  const [fNameEn, setFNameEn] = useState('');
  const [fNameRu, setFNameRu] = useState('');
  const [fDescEn, setFDescEn] = useState('');
  const [fDescRu, setFDescRu] = useState('');
  const [fDetailsEn, setFDetailsEn] = useState('');
  const [fDetailsRu, setFDetailsRu] = useState('');
  const [fPrice, setFPrice] = useState('');
  const [fCategory, setFCategory] = useState('accounts');
  const [fBadge, setFBadge] = useState('');
  const [fUnlimited, setFUnlimited] = useState(false);
  const [fFile, setFFile] = useState<File | null>(null);
  const [fFilePath, setFFilePath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    const [prodRes, stockRes, ordersRes, revRes, usersRes] = await Promise.all([
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('stock_items').select('id').eq('is_sold', false),
      supabase.from('orders').select('*, profiles:user_id(public_uid, nickname)').order('created_at', { ascending: false }).limit(50),
      supabase.from('orders').select('total'),
      supabase.from('profiles').select('id, public_uid, role, balance, nickname, telegram, created_at').order('created_at', { ascending: false }),
    ]);
    if (prodRes.error) toast(prodRes.error.message, 'error');
    if (ordersRes.error) toast(ordersRes.error.message, 'error');
    if (usersRes.error) toast(usersRes.error.message, 'error');
    setProducts(prodRes.data as AdminProduct[] || []);
    setTotalStock(stockRes.data?.length || 0);
    setOrders(ordersRes.data as unknown as typeof orders || []);
    setTotalRevenue(revRes.data?.reduce((s, o) => s + Number(o.total), 0) || 0);
    setUsers(usersRes.data as AdminUser[] || []);
    setLoading(false);
  }, [toast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const stats = [
    { icon: Package, label: t('totalProducts'), value: String(products.length) },
    { icon: Boxes, label: t('totalStock'), value: String(totalStock) },
    { icon: ShoppingCart, label: t('totalOrders'), value: String(orders.length) },
    { icon: DollarSign, label: t('totalRevenue'), value: formatCurrency(totalRevenue, lang) },
  ];

  const openAdd = () => {
    setEditProduct(null);
    setFNameEn(''); setFNameRu(''); setFDescEn(''); setFDescRu('');
    setFDetailsEn(''); setFDetailsRu('');
    setFPrice(''); setFCategory('accounts'); setFBadge(''); setFUnlimited(false);
    setFFile(null); setFFilePath(null);
    setModalOpen(true);
  };

  const openEdit = (p: AdminProduct) => {
    setEditProduct(p);
    setFNameEn(p.name_en); setFNameRu(p.name_ru);
    setFDescEn(p.description_en); setFDescRu(p.description_ru);
    setFDetailsEn((p as AdminProduct & { details_en?: string }).details_en || '');
    setFDetailsRu((p as AdminProduct & { details_ru?: string }).details_ru || '');
    setFPrice(String(p.price)); setFCategory(p.category);
    setFBadge(p.badge || ''); setFUnlimited(p.is_unlimited);
    setFFile(null); setFFilePath((p as AdminProduct & { file_path: string | null }).file_path || null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!fNameEn.trim() || !fNameRu.trim() || !fPrice) {
      toast('Validation error', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name_en: fNameEn.trim(),
        name_ru: fNameRu.trim(),
        description_en: fDescEn.trim(),
        description_ru: fDescRu.trim(),
        details_en: fDetailsEn.trim(),
        details_ru: fDetailsRu.trim(),
        price: Number(fPrice),
        category: fCategory,
        badge: fBadge || null,
        is_unlimited: fUnlimited,
      };

      let filePath = fFilePath;
      if (fFile) {
        const ext = fFile.name.split('.').pop();
        const allowed = ['txt', 'zip', 'pdf', 'rar', 'docx'];
        if (!allowed.includes(ext || '')) {
          toast('File type not allowed', 'error');
          setSaving(false);
          return;
        }
        if (fFile.size > 20 * 1024 * 1024) {
          toast('File too large (max 20MB)', 'error');
          setSaving(false);
          return;
        }
        const prodId = editProduct?.id || crypto.randomUUID();
        const path = `products/${prodId}/${fFile.name}`;
        const { error: upErr } = await supabase.storage.from('product-files').upload(path, fFile, { upsert: true });
        if (upErr) { toast(upErr.message, 'error'); setSaving(false); return; }
        filePath = path;
      }

      payload.file_path = filePath;

      if (editProduct) {
        const { error } = await supabase.from('products').update(payload).eq('id', editProduct.id);
        if (error) throw error;
        toast('Product updated', 'success');
      } else {
        const { error } = await supabase.from('products').insert(payload);
        if (error) throw error;
        toast('Product added', 'success');
      }
      setModalOpen(false);
      loadAll();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const { error } = await supabase.from('products').delete().eq('id', deleteConfirm.id);
    if (error) { toast(error.message, 'error'); return; }
    toast('Product deleted', 'success');
    setDeleteConfirm(null);
    loadAll();
  };

  const handleAddStock = async () => {
    if (!stockProduct || !stockPayloads.trim()) {
      toast('Select product and add credentials', 'error');
      return;
    }
    const lines = stockPayloads.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    const rows = lines.map((l) => ({ product_id: stockProduct, payload: l }));
    const { error } = await supabase.from('stock_items').insert(rows);
    if (error) { toast(error.message, 'error'); return; }
    toast(t('stockAdded', { count: lines.length }), 'success');
    setStockModalOpen(false);
    setStockPayloads('');
    setStockProduct('');
    loadAll();
  };

  const handleAdjustBalance = async () => {
    if (!balanceModalUser || !balanceAmount) {
      toast('Enter amount', 'error');
      return;
    }
    const amt = Number(balanceAmount);
    if (!amt || amt <= 0) {
      toast('Invalid amount', 'error');
      return;
    }
    const delta = balanceMode === 'add' ? amt : -amt;
    const { error } = await supabase.rpc('admin_adjust_balance', {
      target_uid: balanceModalUser.id,
      delta,
    });
    if (error) {
      toast(t('balanceAdjustError'), 'error');
      return;
    }
    toast(t('balanceAdjusted', { nickname: balanceModalUser.nickname || balanceModalUser.public_uid }), 'success');
    setBalanceModalUser(null);
    setBalanceAmount('');
    loadAll();
  };

  const removeFile = async () => {
    if (fFilePath) {
      await supabase.storage.from('product-files').remove([fFilePath]);
      if (editProduct) {
        await supabase.from('products').update({ file_path: null }).eq('id', editProduct.id);
      }
    }
    setFFilePath(null);
    setFFile(null);
  };

  let filtered = products;
  if (categoryFilter !== 'all') filtered = filtered.filter((p) => p.category === categoryFilter);
  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter((p) => p.name_en.toLowerCase().includes(q) || p.name_ru.toLowerCase().includes(q));
  }

  let filteredUsers = users;
  if (userSearch.trim()) {
    const q = userSearch.toLowerCase();
    filteredUsers = filteredUsers.filter((u) =>
      u.public_uid.toLowerCase().includes(q) ||
      (u.nickname || '').toLowerCase().includes(q) ||
      (u.telegram || '').toLowerCase().includes(q)
    );
  }

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><p className="text-white/40">{t('loading')}</p></div>;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="mb-8 text-3xl font-bold text-white">{t('adminTitle')}</h1>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          ...stats,
          { icon: Users, label: t('totalUsers'), value: String(users.length) },
        ].map((s, i) => (
          <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-violet-500/20">
            <s.icon className="mb-2 h-5 w-5 text-violet-400" />
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-white/40">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 flex gap-2 border-b border-white/10">
        {([
          { key: 'products' as Tab, label: t('adminProducts') },
          { key: 'users' as Tab, label: t('adminUsers') },
          { key: 'orders' as Tab, label: t('adminOrders') },
        ]).map((tabItem) => (
          <button
            key={tabItem.key}
            onClick={() => setTab(tabItem.key)}
            className={`px-4 py-2.5 text-sm font-semibold transition border-b-2 ${
              tab === tabItem.key
                ? 'border-violet-500 text-white'
                : 'border-transparent text-white/50 hover:text-white/70'
            }`}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      {/* Products tab */}
      {tab === 'products' && (
        <>
          <div className="mb-4 flex flex-wrap gap-3">
            <button onClick={openAdd} className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">
              <Plus className="h-4 w-4" /> {t('addProduct')}
            </button>
            <button onClick={() => setStockModalOpen(true)} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 hover:bg-white/10">
              <Layers className="h-4 w-4" /> {t('addStock')}
            </button>
          </div>

          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('search')}
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-3 text-white placeholder-white/30 focus:border-violet-500 focus:outline-none"
              />
            </div>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-violet-500 focus:outline-none">
              <option value="all" className="bg-[#0d0d18]">{t('all')}</option>
              <option value="bundles" className="bg-[#0d0d18]">{t('bundles')}</option>
              <option value="accounts" className="bg-[#0d0d18]">{t('accounts')}</option>
              <option value="proxies" className="bg-[#0d0d18]">{t('proxies')}</option>
              <option value="cards" className="bg-[#0d0d18]">{t('cards')}</option>
              <option value="tools" className="bg-[#0d0d18]">{t('tools')}</option>
            </select>
          </div>

          <div className="mb-10 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-white/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">{t('nameEn')}</th>
                  <th className="px-4 py-3 text-left font-medium">{t('category')}</th>
                  <th className="px-4 py-3 text-left font-medium">{t('price')}</th>
                  <th className="px-4 py-3 text-left font-medium">{t('badge')}</th>
                  <th className="px-4 py-3 text-left font-medium">File</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const fp = (p as AdminProduct & { file_path: string | null }).file_path;
                  return (
                    <tr key={p.id} className="border-t border-white/5 text-white/70 transition hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-medium text-white">{p.name_en}</td>
                      <td className="px-4 py-3 uppercase text-xs">{p.category}</td>
                      <td className="px-4 py-3">{formatCurrency(p.price, lang)}</td>
                      <td className="px-4 py-3">{p.badge || '—'}</td>
                      <td className="px-4 py-3">{fp ? <FileText className="h-4 w-4 text-violet-400" /> : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => openEdit(p)} className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white"><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => setDeleteConfirm(p)} className="rounded-lg p-1.5 text-red-400/50 hover:bg-red-500/10 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Users tab */}
      {tab === 'users' && (
        <>
          <div className="mb-4 relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder={t('userSearch')}
              className="w-full max-w-md rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-3 text-white placeholder-white/30 focus:border-violet-500 focus:outline-none"
            />
          </div>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-white/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">{t('userUid')}</th>
                  <th className="px-4 py-3 text-left font-medium">{t('userNickname')}</th>
                  <th className="px-4 py-3 text-left font-medium">{t('userTelegram')}</th>
                  <th className="px-4 py-3 text-left font-medium">{t('userBalance')}</th>
                  <th className="px-4 py-3 text-left font-medium">{t('userRole')}</th>
                  <th className="px-4 py-3 text-left font-medium">{t('userCreated')}</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-white/40">No users found</td></tr>
                ) : filteredUsers.map((u) => (
                  <tr key={u.id} className="border-t border-white/5 text-white/70 transition hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-mono text-xs text-cyan-400">{u.public_uid}</td>
                    <td className="px-4 py-3 font-medium text-white">{u.nickname || '—'}</td>
                    <td className="px-4 py-3 text-sm">{u.telegram || '—'}</td>
                    <td className="px-4 py-3 font-semibold text-lime-400">{formatCurrency(u.balance, lang)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.role === 'admin' ? 'bg-violet-500/20 text-violet-400' : 'bg-white/5 text-white/50'
                      }`}>{u.role}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">{new Date(u.created_at).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US')}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <button
                          onClick={() => { setBalanceModalUser(u); setBalanceAmount(''); setBalanceMode('add'); }}
                          className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white"
                        >
                          <Wallet className="h-3.5 w-3.5" /> {t('adjustBalance')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Orders tab */}
      {tab === 'orders' && (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-white/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">ID</th>
                <th className="px-4 py-3 text-left font-medium">{t('buyerUid')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('txAmount')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('date')}</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-white/40">{t('noOrders')}</td></tr>
              ) : orders.map((o) => {
                const profile = o.profiles as { public_uid: string; nickname: string | null } | null;
                return (
                  <tr key={o.id} className="border-t border-white/5 text-white/70 transition hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-mono text-xs">#{o.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-cyan-400">
                      {profile?.public_uid || '—'}
                      {profile?.nickname && <span className="ml-2 text-white/50">{profile.nickname}</span>}
                    </td>
                    <td className="px-4 py-3 font-semibold text-white">{formatCurrency(Number(o.total), lang)}</td>
                    <td className="px-4 py-3 text-xs">{new Date(o.created_at).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editProduct ? t('editProduct') : t('addProduct')} maxWidth="max-w-2xl">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-white/70">{t('nameEn')}</label>
              <input value={fNameEn} onChange={(e) => setFNameEn(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-violet-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-white/70">{t('nameRu')}</label>
              <input value={fNameRu} onChange={(e) => setFNameRu(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-violet-500 focus:outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-white/70">{t('descEn')}</label>
              <textarea value={fDescEn} onChange={(e) => setFDescEn(e.target.value)} rows={2} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-violet-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-white/70">{t('descRu')}</label>
              <textarea value={fDescRu} onChange={(e) => setFDescRu(e.target.value)} rows={2} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-violet-500 focus:outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-white/70">{t('detailsEn')}</label>
              <textarea value={fDetailsEn} onChange={(e) => setFDetailsEn(e.target.value)} rows={5} placeholder="Item 1: description&#10;Item 2: description" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none" />
              <p className="mt-1 text-xs text-white/30">{t('detailsHint')}</p>
            </div>
            <div>
              <label className="mb-1 block text-sm text-white/70">{t('detailsRu')}</label>
              <textarea value={fDetailsRu} onChange={(e) => setFDetailsRu(e.target.value)} rows={5} placeholder="Пункт 1: описание&#10;Пункт 2: описание" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none" />
              <p className="mt-1 text-xs text-white/30">{t('detailsHint')}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm text-white/70">{t('price')} ($)</label>
              <input type="number" value={fPrice} onChange={(e) => setFPrice(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-violet-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-white/70">{t('category')}</label>
              <select value={fCategory} onChange={(e) => setFCategory(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-violet-500 focus:outline-none">
                <option value="bundles" className="bg-[#0d0d18]">{t('bundles')}</option>
                <option value="accounts" className="bg-[#0d0d18]">{t('accounts')}</option>
                <option value="proxies" className="bg-[#0d0d18]">{t('proxies')}</option>
                <option value="cards" className="bg-[#0d0d18]">{t('cards')}</option>
                <option value="tools" className="bg-[#0d0d18]">{t('tools')}</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-white/70">{t('badge')}</label>
              <select value={fBadge} onChange={(e) => setFBadge(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-violet-500 focus:outline-none">
                <option value="" className="bg-[#0d0d18]">{t('noBadge')}</option>
                <option value="HOT" className="bg-[#0d0d18]">{t('hot')}</option>
                <option value="BEST VALUE" className="bg-[#0d0d18]">{t('bestValue')}</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input type="checkbox" checked={fUnlimited} onChange={(e) => setFUnlimited(e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-white/5 accent-violet-500" />
            {t('unlimited')}
          </label>
          <div>
            <label className="mb-1 block text-sm text-white/70">{t('fileUpload')}</label>
            {fFilePath ? (
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <FileText className="h-4 w-4 text-violet-400" />
                <span className="flex-1 truncate text-sm text-white/70">{fFilePath.split('/').pop()}</span>
                <button onClick={removeFile} className="text-red-400 hover:text-red-300"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <input type="file" accept=".txt,.zip,.pdf,.rar,.docx" onChange={(e) => setFFile(e.target.files?.[0] || null)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 file:mr-3 file:rounded file:border-0 file:bg-violet-600 file:px-3 file:py-1 file:text-white" />
            )}
            {fFile && <p className="mt-1 text-xs text-white/40">{fFile.name} ({(fFile.size / 1024).toFixed(0)} KB)</p>}
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} disabled={saving} className="flex-1 rounded-lg bg-violet-600 py-2.5 font-semibold text-white hover:bg-violet-500 disabled:opacity-50">{saving ? t('loading') : t('save')}</button>
            <button onClick={() => setModalOpen(false)} className="rounded-lg border border-white/10 px-5 py-2.5 font-semibold text-white/70 hover:bg-white/10">{t('cancel')}</button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title={t('deleteProduct')}>
        <p className="mb-5 text-white/70">{t('confirmDelete')}</p>
        <div className="flex gap-3">
          <button onClick={handleDelete} className="flex-1 rounded-lg bg-red-600 py-2.5 font-semibold text-white hover:bg-red-500">{t('delete')}</button>
          <button onClick={() => setDeleteConfirm(null)} className="rounded-lg border border-white/10 px-5 py-2.5 font-semibold text-white/70 hover:bg-white/10">{t('cancel')}</button>
        </div>
      </Modal>

      {/* Add stock modal */}
      <Modal open={stockModalOpen} onClose={() => setStockModalOpen(false)} title={t('addStock')}>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-white/70">{t('selectProduct')}</label>
            <select value={stockProduct} onChange={(e) => setStockProduct(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-violet-500 focus:outline-none">
              <option value="" className="bg-[#0d0d18]">—</option>
              {products.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#0d0d18]">{p.name_en}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-white/70">{t('stockPayloads')}</label>
            <textarea value={stockPayloads} onChange={(e) => setStockPayloads(e.target.value)} rows={8} placeholder="email:password&#10;email:password" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-white focus:border-violet-500 focus:outline-none" />
          </div>
          <button onClick={handleAddStock} className="w-full rounded-lg bg-violet-600 py-2.5 font-semibold text-white hover:bg-violet-500">{t('addStockBtn')}</button>
        </div>
      </Modal>

      {/* Balance adjust modal */}
      <Modal open={!!balanceModalUser} onClose={() => setBalanceModalUser(null)} title={t('adjustBalance')}>
        {balanceModalUser && (
          <div className="space-y-4">
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-white/50">{t('userUid')}: <span className="font-mono text-cyan-400">{balanceModalUser.public_uid}</span></p>
              <p className="text-sm text-white/50">{t('userNickname')}: <span className="text-white">{balanceModalUser.nickname || '—'}</span></p>
              <p className="text-sm text-white/50">{t('userBalance')}: <span className="font-semibold text-lime-400">{formatCurrency(balanceModalUser.balance, lang)}</span></p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setBalanceMode('add')}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${balanceMode === 'add' ? 'bg-lime-600 text-white' : 'border border-white/10 text-white/60 hover:bg-white/5'}`}
              >
                {t('balanceAdd')}
              </button>
              <button
                onClick={() => setBalanceMode('subtract')}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${balanceMode === 'subtract' ? 'bg-red-600 text-white' : 'border border-white/10 text-white/60 hover:bg-white/5'}`}
              >
                {t('balanceSubtract')}
              </button>
            </div>
            <div>
              <label className="mb-1 block text-sm text-white/70">{t('balanceAmount')}</label>
              <input
                type="number"
                value={balanceAmount}
                onChange={(e) => setBalanceAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-violet-500 focus:outline-none"
              />
            </div>
            <button onClick={handleAdjustBalance} className="w-full rounded-lg bg-violet-600 py-2.5 font-semibold text-white hover:bg-violet-500">{t('save')}</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
