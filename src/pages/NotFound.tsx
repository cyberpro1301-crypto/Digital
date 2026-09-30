import { Link } from 'react-router-dom';
import { useApp } from '@/store/AppContext';
import { Home as HomeIcon } from 'lucide-react';

export default function NotFound() {
  const { t } = useApp();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="mb-2 text-7xl font-black text-white/10">404</p>
      <h1 className="mb-4 text-2xl font-bold text-white">Page not found</h1>
      <Link
        to="/"
        className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 font-semibold text-white transition hover:bg-violet-500"
      >
        <HomeIcon className="h-4 w-4" /> {t('home')}
      </Link>
    </div>
  );
}
