import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/store/AppContext';
import Modal from './Modal';
import { formatCurrency } from '@/lib/i18n';
import { Mail, Lock, AlertCircle } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  mode: 'login' | 'register';
  setMode: (m: 'login' | 'register') => void;
};

export default function AuthModal({ open, onClose, mode, setMode }: Props) {
  const { t, lang, toast, refreshProfile } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t('invalidEmail'));
      return;
    }
    if (password.length < 6) {
      setError(t('shortPassword'));
      return;
    }
    if (mode === 'register' && password !== confirm) {
      setError(t('passwordMismatch'));
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast(t('loginSuccess'), 'success');
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast(t('registerSuccess'), 'success');
      }
      await refreshProfile();
      onClose();
      setEmail('');
      setPassword('');
      setConfirm('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('authError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={mode === 'login' ? t('loginTitle') : t('registerTitle')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm text-white/70">{t('email')}</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-white placeholder-white/30 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              placeholder="you@example.com"
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-white/70">{t('password')}</label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-white placeholder-white/30 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              placeholder="••••••"
            />
          </div>
        </div>
        {mode === 'register' && (
          <div>
            <label className="mb-1.5 block text-sm text-white/70">{t('confirmPassword')}</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-white placeholder-white/30 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                placeholder="••••••"
              />
            </div>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 py-2.5 font-semibold text-white transition hover:from-violet-500 hover:to-violet-400 disabled:opacity-50"
        >
          {loading ? t('loading') : mode === 'login' ? t('loginBtn') : t('registerBtn')}
        </button>
        <p className="text-center text-sm text-white/50">
          {mode === 'login' ? t('noAccount') : t('haveAccount')}{' '}
          <button
            type="button"
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
            className="font-semibold text-violet-400 hover:text-violet-300"
          >
            {mode === 'login' ? t('register') : t('login')}
          </button>
        </p>
      </form>
    </Modal>
  );
}
