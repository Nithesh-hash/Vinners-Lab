import { Link, Navigate } from 'react-router-dom';
import { Download, Cpu, ShieldCheck, Layers, Sparkles } from 'lucide-react';
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
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">
                Vinner Lab
              </h1>
              <p className="text-sm sm:text-base font-bold text-slate-700 tracking-tight">
                VIT Innovation &amp; Startup Lab (IIC VIT)
              </p>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                Hardware inventory management, component tracking, and student loan accountability system. Engineered by{' '}
                <strong className="font-semibold text-slate-800">Nithesh Kumar T</strong> (
                <span className="text-indigo-600 font-semibold">Nithesh VIT</span>).
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

        {/* Section 1: Core System Capabilities */}
        <section className="w-full max-w-5xl mx-auto pt-10 sm:pt-14 pb-8 sm:pb-12 text-left">
          <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10 space-y-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              VIT Innovation &amp; Startup Lab Ecosystem
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Hardware Accountability &amp; Smart Tracking
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Built specifically for students, researchers, and project teams at Vellore Institute of Technology.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-white/80 backdrop-blur-md rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Live Hardware Catalog</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Explore real-time stock availability for microcontrollers, sensors, wireless IoT modules, development kits, and lab tools at VinnerLab VIT.
              </p>
            </div>

            <div className="bg-white/80 backdrop-blur-md rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">SSV &amp; FSV Project Codes</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Authorized project issuance workflow for hackathon teams, faculty-guided initiatives, and capstone researchers with verified student registration numbers.
              </p>
            </div>

            <div className="bg-white/80 backdrop-blur-md rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">QR Pickup &amp; Return Handover</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Contactless digital Pickup QR codes, automatic PDF invoice receipts, and administrative scan verification for complete lab equipment accountability.
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: About Nithesh Kumar T (Lead Developer Spotlight) */}
        <section className="w-full max-w-4xl mx-auto py-8 sm:py-10 text-left" id="about-developer">
          <div className="bg-white/90 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-md inline-block">
                  Developer &amp; Architect
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  About Nithesh Kumar T
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 font-medium">
                  Full-Stack Developer • Student at Vellore Institute of Technology (VIT Vellore)
                </p>
              </div>

              {/* Verified Professional Profile Badges */}
              <div className="flex items-center gap-2.5 shrink-0">
                <a
                  href="https://www.linkedin.com/in/nithesh-kumar-t-b4028130a/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0A66C2] hover:bg-[#004182] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
                  title="Connect with Nithesh Kumar T on LinkedIn"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451c.979 0 1.778-.773 1.778-1.729V1.73C24 .774 23.205 0 22.222 0h.003z"/>
                  </svg>
                  <span>LinkedIn</span>
                </a>
                <a
                  href="https://github.com/Nithesh-hash"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
                  title="Nithesh Kumar T on GitHub (Nithesh-hash)"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                  </svg>
                  <span>GitHub</span>
                </a>
              </div>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-slate-700 leading-relaxed">
              <p>
                <strong>Nithesh Kumar T</strong> (commonly known as <strong>Nithesh VIT</strong> or <strong>Nithesh Kumar VIT</strong>) is the software architect and lead full-stack engineer who conceptualized, designed, and deployed the <strong>Vinner Lab</strong> hardware management platform for the <strong>VIT Innovation and Startup Lab (VinnerLab IIC VIT)</strong> at Vellore Institute of Technology.
              </p>
              <p>
                Built to solve real-world lab component tracking challenges, Vinner Lab integrates real-time cloud inventory synchronization, QR-code based student issuance, project code validation (SSV / FSV), automated PDF invoice generation, and progressive web application (PWA) architecture.
              </p>
            </div>

            <div className="pt-2 flex flex-wrap gap-2 text-xs font-medium text-slate-600">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">React 19 &amp; TypeScript</span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">Firebase Firestore</span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">Tailwind CSS</span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">Progressive Web App (PWA)</span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">VIT Vellore</span>
            </div>
          </div>
        </section>

        {/* Section 3: About VinnerLab & IIC VIT */}
        <section className="w-full max-w-4xl mx-auto pb-10 text-left">
          <div className="bg-indigo-50/70 border border-indigo-100 rounded-3xl p-6 sm:p-8 space-y-3 text-xs sm:text-sm text-slate-700 leading-relaxed">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              About VIT Innovation and Startup Lab (IIC VIT)
            </h2>
            <p>
              The <strong>VIT Innovation and Startup Lab</strong>, under the aegis of the Institution&apos;s Innovation Council (IIC VIT) at <strong>Vellore Institute of Technology</strong>, provides cutting-edge hardware, electronic prototyping kits, and fabrication resources to empower young innovators, hackathon participants, and student-led deep-tech startups.
            </p>
            <p>
              The <strong>VinnerLab</strong> platform ensures transparency, instant availability lookups, and structured student accountability across all shared hardware equipment in the innovation laboratory.
            </p>
          </div>
        </section>
      </main>

      {/* Semantic Footer */}
      <footer className="mt-auto border-t border-slate-200/80 bg-white/90 backdrop-blur-md py-6 px-4 sm:px-8 text-xs text-slate-500 z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
            <span className="font-bold text-slate-800">Vinner Lab</span>
            <span className="hidden sm:inline text-slate-300">•</span>
            <span>VIT Innovation and Startup Lab (IIC VIT)</span>
            <span className="hidden sm:inline text-slate-300">•</span>
            <span>Vellore Institute of Technology</span>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
            <Link to="/explore" className="hover:text-indigo-600 transition-colors">Catalog</Link>
            <Link to="/login" className="hover:text-indigo-600 transition-colors">Sign In</Link>
            <a 
              href="https://www.linkedin.com/in/nithesh-kumar-t-b4028130a/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:text-indigo-600 transition-colors"
            >
              Nithesh Kumar T (LinkedIn)
            </a>
            <a 
              href="https://github.com/Nithesh-hash" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:text-indigo-600 transition-colors"
            >
              GitHub
            </a>
          </div>
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
