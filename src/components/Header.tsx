import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '@/store/AppContext';
import { formatCurrency, SUPPORT_TELEGRAM } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import AuthModal from './AuthModal';
import TopUpModal from './TopUpModal';
import CartDrawer from './CartDrawer';
import { ShoppingCart, ChevronDown, Wallet, Shield, LogOut, Package, Zap, Headphones, Send } from 'lucide-react';

export default function Header() {
  const { t, lang, setLang, session, profile, isAdmin, cartCount, toast } = useApp();
  const navigate = useNavigate();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setMenuOpen(false);
    navigate('/');
    toast(t('logout'), 'info');
  };

  return (
    <>
      <header className="sticky top-0 z-[100] border-b border-white/10 bg-[#07070d]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 transition hover:opacity-80">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 rotate-slow">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white">{t('heroTitle')}</span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-4">
            <a
              href={SUPPORT_TELEGRAM}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white sm:flex"
            >
              <Send className="h-4 w-4 text-[#229ED9]" />
              {t('support')}
            </a>

            <button
              onClick={() => setLang(lang === 'en' ? 'ru' : 'en')}
              className="rounded-lg border border-white/10 px-2.5 py-1.5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              {lang === 'en' ? 'RU' : 'EN'}
            </button>

            {session && profile ? (
              <>
                <div className="hidden items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 sm:flex">
                  <Wallet className="h-4 w-4 text-lime-400" />
                  <span className="text-sm font-semibold text-white">{formatCurrency(profile.balance, lang)}</span>
                </div>

                <button
                  onClick={() => setCartOpen(true)}
                  className="relative rounded-lg p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  <ShoppingCart className="h-5 w-5" />
                  {cartCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-violet-500 px-1 text-xs font-bold text-white animate-scale-in">
                      {cartCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setTopUpOpen(true)}
                  className="rounded-lg bg-gradient-to-r from-cyan-600 to-cyan-500 px-3 py-1.5 text-sm font-semibold text-white transition hover:from-cyan-500 hover:to-cyan-400"
                >
                  {t('topUp')}
                </button>

                <div ref={menuRef} className="relative">
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-white/70 transition hover:bg-white/10"
                  >
                    <span className="max-w-[80px] truncate font-medium text-white/80">{profile.nickname || profile.public_uid}</span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 mt-2 w-52 rounded-xl border border-white/10 bg-[#0d0d18] py-2 shadow-2xl animate-scale-in">
                      <div className="border-b border-white/5 px-4 py-2">
                        <p className="text-xs text-white/40">{t('profileUid')}</p>
                        <p className="font-mono text-sm text-cyan-400">{profile.public_uid}</p>
                        {profile.nickname && <p className="mt-0.5 text-sm text-white/70">{profile.nickname}</p>}
                      </div>
                      <Link
                        to="/purchases"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white"
                      >
                        <Package className="h-4 w-4" /> {t('purchases')}
                      </Link>
                      {isAdmin && (
                        <Link
                          to="/admin"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white"
                        >
                          <Shield className="h-4 w-4" /> {t('admin')}
                        </Link>
                      )}
                      <a
                        href={SUPPORT_TELEGRAM}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white"
                      >
                        <Headphones className="h-4 w-4" /> {t('support')}
                      </a>
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 border-t border-white/5 px-4 py-2 text-sm text-red-400 hover:bg-white/10"
                      >
                        <LogOut className="h-4 w-4" /> {t('logout')}
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={() => setCartOpen(true)}
                  className="relative rounded-lg p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  <ShoppingCart className="h-5 w-5" />
                  {cartCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-violet-500 px-1 text-xs font-bold text-white animate-scale-in">
                      {cartCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => { setAuthMode('login'); setAuthOpen(true); }}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-white/70 transition hover:text-white"
                >
                  {t('login')}
                </button>
                <button
                  onClick={() => { setAuthMode('register'); setAuthOpen(true); }}
                  className="rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 px-3 py-1.5 text-sm font-semibold text-white transition hover:from-violet-500 hover:to-violet-400"
                >
                  {t('register')}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} mode={authMode} setMode={setAuthMode} />
      <TopUpModal open={topUpOpen} onClose={() => setTopUpOpen(false)} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} onOpenTopUp={() => setTopUpOpen(true)} />
    </>
  );
}
