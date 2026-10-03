import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/store/AppContext';
import Modal from './Modal';
import { Mail, Lock, AlertCircle, User, CheckCircle } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  mode: 'login' | 'register';
  setMode: (m: 'login' | 'register') => void;
};

export default function AuthModal({ open, onClose, mode, setMode }: Props) {
  const { t, toast, refreshProfile } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

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
    if (mode === 'register') {
      if (!nickname.trim()) {
        setError(t('nicknameRequired'));
        return;
      }
      if (password !== confirm) {
        setError(t('passwordMismatch'));
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast(t('loginSuccess'), 'success');
        await refreshProfile();
        onClose();
        setEmail('');
        setPassword('');
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { nickname: nickname.trim() } },
        });
        if (error) throw error;
        if (data.user && !data.session) {
          setEmailSent(true);
          toast(t('emailConfirmSent'), 'info');
        } else {
          toast(t('registerSuccess'), 'success');
          await refreshProfile();
          onClose();
        }
        setEmail('');
        setPassword('');
        setConfirm('');
        setNickname('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('authError'));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmailSent(false);
    setError('');
    onClose();
  };

  if (emailSent) {
    return (
      <Modal open={open} onClose={handleClose} title={t('registerTitle')}>
        <div className="text-center space-y-4 py-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-lime-500/10 animate-bounce-in">
            <CheckCircle className="h-8 w-8 text-lime-400" />
          </div>
          <p className="text-white/80 leading-relaxed">{t('emailConfirmSent')}</p>
          <p className="text-sm text-white/40">{t('emailConfirmNote')}</p>
          <button
            onClick={handleClose}
            className="w-full rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 py-2.5 font-semibold text-white transition hover:from-violet-500 hover:to-violet-400"
          >
            {t('close')}
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={handleClose} title={mode === 'login' ? t('loginTitle') : t('registerTitle')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'register' && (
          <div>
            <label className="mb-1.5 block text-sm text-white/70">{t('nickname')}</label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-white placeholder-white/30 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                placeholder={t('nicknamePlaceholder')}
              />
            </div>
          </div>
        )}
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
          <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400 animate-fade-in">
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
