import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from '@/store/AppContext';
import { isSupabaseConfigured } from '@/lib/supabase';
import Header from '@/components/Header';
import ToastContainer from '@/components/ToastContainer';
import Home from '@/pages/Home';
import Purchases from '@/pages/Purchases';
import Admin from '@/pages/Admin';
import NotFound from '@/pages/NotFound';
import { AlertTriangle } from 'lucide-react';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useApp();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><p className="text-white/40">Loading...</p></div>;
  if (!session) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { session, isAdmin, loading } = useApp();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><p className="text-white/40">Loading...</p></div>;
  if (!session || !isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppContent() {
  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#07070d] p-8 text-center">
        <AlertTriangle className="mb-4 h-12 w-12 text-yellow-400" />
        <h1 className="mb-2 text-xl font-bold text-white">Supabase is not configured</h1>
        <p className="max-w-md text-white/50">Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file. See .env.example for reference.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07070d] text-white">
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/purchases" element={<ProtectedRoute><Purchases /></ProtectedRoute>} />
        <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppContent />
        <ToastContainer />
      </BrowserRouter>
    </AppProvider>
  );
}
