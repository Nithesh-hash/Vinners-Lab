import { Link, Navigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DeveloperBadge from '@/components/DeveloperBadge';
import { useSEO } from '@/hooks/useSEO';

export default function Landing() {
  const { user, profile, loading } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  // Dynamic Technical SEO
  useSEO({
    title: 'Nithesh Kumar T | Vinner Lab — VIT Innovation & Startup Lab (IIC VIT)',
    description: 'Vinner Lab is an advanced hardware inventory & component tracking ecosystem for the VIT Innovation and Startup Lab (IIC VIT), architected & developed by Nithesh Kumar T (Nithesh VIT).',
    canonical: 'https://vinner-lab-iic.web.app/'
  });

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
    <div className="min-h-screen bg-slate-50 relative overflow-hidden flex flex-col font-sans">
      {/* Decorative Background */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-200/50 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-300/40 rounded-full blur-3xl pointer-events-none"></div>
      
      {/* Global Header */}
      <header className="p-4 sm:p-6 md:p-8 flex items-center justify-between z-10 max-w-7xl w-full mx-auto">
        <div className="flex items-center gap-3">
          <img 
            src="/logo.png" 
            alt="Vinner Lab Logo - VIT Innovation and Startup Lab by Nithesh Kumar T" 
            className="w-10 h-10 rounded-xl shadow-xs border border-slate-200/80 object-cover" 
          />
          <div className="flex flex-col text-left">
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Vinner Lab</span>
            <span className="text-[10px] font-semibold text-slate-500 hidden sm:block">VIT Innovation &amp; Startup Lab</span>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <DeveloperBadge />
          <Link to="/explore" className="px-3 sm:px-4 py-2 text-slate-700 font-medium hover:text-brand-600 transition-colors text-sm sm:text-base">Explore</Link>
          <Link to="/login" className="px-3 sm:px-4 py-2 text-slate-700 font-medium hover:text-brand-600 transition-colors text-sm sm:text-base">Log In</Link>
          <Link to="/register" className="hidden sm:inline-flex items-center px-5 py-2 rounded-full bg-white/70 hover:bg-white text-slate-800 font-medium text-sm border border-slate-300/70 shadow-xs backdrop-blur-md transition-all">Register</Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 text-center z-10">
        <div className="max-w-xl w-full space-y-6 sm:space-y-8 py-8 sm:py-12">
          <div className="flex flex-col items-center justify-center space-y-4 sm:space-y-5">
            <img 
              src="/logo.png" 
              alt="Vinner Lab - VIT Innovation and Startup Lab Icon by Nithesh Kumar T" 
              className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl shadow-xl border-4 border-white bg-white object-cover" 
            />
            <div className="space-y-1.5 sm:space-y-2">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">
                Vinner Lab
              </h1>
              <p className="text-sm sm:text-base font-bold text-slate-700 tracking-tight">
                VIT Innovation &amp; Startup Lab (IIC VIT)
              </p>
            </div>
          </div>

          {/* Frosted Glass Pill Capsule Buttons Stacked Vertically */}
          <div className="flex flex-col items-center justify-center gap-3 sm:gap-3.5 w-full">
            <Link 
              to="/explore" 
              className="group relative w-full max-w-[280px] sm:max-w-[320px] py-3.5 px-6 sm:px-8 rounded-full bg-white/60 hover:bg-white/85 active:bg-white/95 backdrop-blur-xl border border-slate-300/70 ring-1 ring-white/70 shadow-[0_4px_20px_rgba(0,0,0,0.04),inset_0_1px_2px_rgba(255,255,255,0.9),inset_0_-1px_1px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_25px_rgba(0,0,0,0.07),inset_0_1px_2px_rgba(255,255,255,0.95)] flex items-center justify-center transition-all duration-200 cursor-pointer active:scale-[0.98]"
            >
              <span className="text-base sm:text-lg font-medium text-slate-700 group-hover:text-slate-900 tracking-tight transition-colors text-center">
                Explore Components
              </span>
            </Link>

            <Link 
              to="/login?type=student" 
              className="group relative w-full max-w-[280px] sm:max-w-[320px] py-3.5 px-6 sm:px-8 rounded-full bg-white/60 hover:bg-white/85 active:bg-white/95 backdrop-blur-xl border border-slate-300/70 ring-1 ring-white/70 shadow-[0_4px_20px_rgba(0,0,0,0.04),inset_0_1px_2px_rgba(255,255,255,0.9),inset_0_-1px_1px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_25px_rgba(0,0,0,0.07),inset_0_1px_2px_rgba(255,255,255,0.95)] flex items-center justify-center transition-all duration-200 cursor-pointer active:scale-[0.98]"
            >
              <span className="text-base sm:text-lg font-medium text-slate-700 group-hover:text-slate-900 tracking-tight transition-colors text-center">
                Student Login
              </span>
            </Link>

            <Link 
              to="/login?type=admin" 
              className="group relative w-full max-w-[280px] sm:max-w-[320px] py-3.5 px-6 sm:px-8 rounded-full bg-white/60 hover:bg-white/85 active:bg-white/95 backdrop-blur-xl border border-slate-300/70 ring-1 ring-white/70 shadow-[0_4px_20px_rgba(0,0,0,0.04),inset_0_1px_2px_rgba(255,255,255,0.9),inset_0_-1px_1px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_25px_rgba(0,0,0,0.07),inset_0_1px_2px_rgba(255,255,255,0.95)] flex items-center justify-center transition-all duration-200 cursor-pointer active:scale-[0.98]"
            >
              <span className="text-base sm:text-lg font-medium text-slate-700 group-hover:text-slate-900 tracking-tight transition-colors text-center">
                Admin Login
              </span>
            </Link>
          </div>
        </div>
      </main>

      {/* Semantic Footer */}
      <footer className="mt-auto border-t border-slate-200/80 bg-white/70 backdrop-blur-md py-4 px-4 sm:px-8 text-xs text-slate-500 z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <span className="font-bold text-slate-800">Vinner Lab</span>
          <span>© 2026 Institution&apos;s Innovation Council • Vellore Institute of Technology</span>
        </div>
      </footer>

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
