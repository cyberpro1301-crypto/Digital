import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { getInitialLang, Lang, t as translate, TranslationKey } from '@/lib/i18n';
import type { Session } from '@supabase/supabase-js';
import type { Profile, CartItem } from '@/lib/supabase';

type Toast = { id: number; message: string; type: 'success' | 'error' | 'info' };

type AppState = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (productId: string) => void;
  updateQty: (productId: string, qty: number) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;
  toasts: Toast[];
  toast: (message: string, type?: Toast['type']) => void;
  dismissToast: (id: number) => void;
};

const Ctx = createContext<AppState | null>(null);

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getInitialLang());
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => translate(lang, key, params),
    [lang],
  );

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem('dv-lang', l);
  }, []);

  const toast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();
    if (error) {
      toast(error.message, 'error');
      return;
    }
    setProfile(data as Profile | null);
  }, [session, toast]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (session?.user) {
      (async () => {
        await refreshProfile();
      })();
    } else {
      setProfile(null);
    }
  }, [session, refreshProfile]);

  const addToCart = useCallback((item: CartItem) => {
    setCart((prev) => {
      const existing = prev.find((x) => x.product_id === item.product_id);
      if (existing) {
        const maxQty = item.is_unlimited ? 99 : item.stock;
        const newQty = Math.min(existing.qty + 1, maxQty);
        return prev.map((x) =>
          x.product_id === item.product_id ? { ...x, qty: newQty } : x,
        );
      }
      return [...prev, { ...item, qty: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((x) => x.product_id !== productId));
  }, []);

  const updateQty = useCallback((productId: string, qty: number) => {
    setCart((prev) =>
      prev.map((x) =>
        x.product_id === productId ? { ...x, qty: Math.max(1, qty) } : x,
      ),
    );
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const cartTotal = cart.reduce((sum, x) => sum + x.price * x.qty, 0);
  const cartCount = cart.reduce((sum, x) => sum + x.qty, 0);

  return (
    <Ctx.Provider
      value={{
        lang, setLang, t,
        session, profile, loading, isAdmin: profile?.role === 'admin',
        refreshProfile,
        cart, addToCart, removeFromCart, updateQty, clearCart, cartTotal, cartCount,
        toasts, toast, dismissToast,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
