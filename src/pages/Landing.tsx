import { Link } from 'react-router-dom';
import { ArrowRight, Download } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

export default function Landing() {
  const { user, profile, loading } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (user && profile) {
    return <Navigate to={profile.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden flex flex-col">
      {/* Decorative Background */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-200/50 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-300/40 rounded-full blur-3xl pointer-events-none"></div>
      
      <header className="p-4 sm:p-6 md:p-8 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Vinner Lab Logo" className="w-10 h-10 rounded-lg shadow-sm" />
          <span className="text-2xl font-bold text-slate-900 tracking-tight">Vinner Lab</span>
        </div>
        <div className="flex gap-4">
          <Link to="/login" className="px-5 py-2 text-slate-700 font-medium hover:text-brand-600 transition-colors">Log In</Link>
          <Link to="/register" className="glass-button hidden sm:block">Register</Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 text-center z-10">
        <div className="max-w-xl w-full space-y-8 sm:space-y-10">
          <div className="flex flex-col items-center justify-center space-y-4 sm:space-y-6">
            <img src="/logo.png" alt="Vinner Lab Logo" className="w-28 h-28 sm:w-40 sm:h-40 rounded-3xl shadow-xl border-4 border-white bg-white" />
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">Vinner Lab</h1>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link to="/register" className="glass-button w-full sm:w-auto flex items-center justify-center gap-2 text-base sm:text-lg px-6 sm:px-8 py-3.5 sm:py-4">
              Student Registration
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link to="/login" className="glass-button-secondary w-full sm:w-auto flex items-center justify-center gap-2 text-base sm:text-lg px-6 sm:px-8 py-3.5 sm:py-4">
              Admin Login
            </Link>
          </div>
        </div>
      </main>

      {/* PWA Install Modal / Floating Card */}
      {isInstallable && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center space-y-4">
              <div className="mx-auto w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden shadow-md border border-slate-100 bg-white">
                <img src="/logo.png" alt="Vinner Lab Logo" className="w-full h-full object-cover" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Install Vinner Lab</h3>
                <p className="text-slate-500 mt-2 text-sm">Add Vinner Lab to your home screen for a fast, app-like experience without the browser bar.</p>
              </div>
              <div className="pt-4 flex gap-3">
                <button onClick={() => setIsInstallable(false)} className="glass-button-secondary flex-1 py-2.5">Not Now</button>
                <button onClick={handleInstallClick} className="glass-button flex-1 py-2.5 flex items-center justify-center gap-2">
                  <Download className="w-4 h-4" /> Install App
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
