import { useApp } from '@/store/AppContext';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

export default function ToastContainer() {
  const { toasts, dismissToast } = useApp();

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="flex items-start gap-3 rounded-xl border border-white/10 bg-[#0d0d18] px-4 py-3 shadow-2xl backdrop-blur-xl animate-slide-in"
        >
          {toast.type === 'success' && <CheckCircle className="h-5 w-5 shrink-0 text-lime-400" />}
          {toast.type === 'error' && <XCircle className="h-5 w-5 shrink-0 text-red-400" />}
          {toast.type === 'info' && <Info className="h-5 w-5 shrink-0 text-cyan-400" />}
          <p className="flex-1 text-sm text-white/90">{toast.message}</p>
          <button onClick={() => dismissToast(toast.id)} className="text-white/40 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
