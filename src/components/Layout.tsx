import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut, User, LayoutDashboard, History, Settings, X, Menu, QrCode } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export default function Layout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const isAdmin = profile?.role === 'admin';
  const dashboardPath = isAdmin ? "/admin" : "/dashboard";

  return (
    <div className="min-h-screen bg-dot-grid flex flex-col md:flex-row text-slate-900 font-sans">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white/90 backdrop-blur-md border-r border-slate-200/80 sticky top-0 h-screen p-5 shadow-xs z-20">
        <div className="flex items-center gap-2.5 px-2 py-3 mb-6">
          <img src="/logo.png" alt="Vinner Lab Logo" className="w-8 h-8 rounded-xl shadow-xs border border-slate-200/80 object-cover" />
          <div className="flex flex-col">
            <span className="text-base font-bold text-slate-900 tracking-tight leading-none">Vinner Lab</span>
            <span className="text-[10px] text-slate-400 font-medium tracking-wide uppercase mt-1">Telemetry Portal</span>
          </div>
        </div>
        
        <nav className="flex-1 space-y-1.5">
          <Link to={dashboardPath} className={cn("flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all", (location.pathname === dashboardPath && !location.search.includes('tab=')) ? "bg-slate-900 text-white shadow-xs font-semibold" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900")}>
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
          <Link to={`${dashboardPath}?tab=history`} className={cn("flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all", location.search.includes('tab=history') ? "bg-slate-900 text-white shadow-xs font-semibold" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900")}>
            <History className="w-4 h-4" />
            History Log
          </Link>
          {isAdmin && (
            <>
              <Link to="/admin/scan" className={cn("flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all", location.pathname === '/admin/scan' ? "bg-slate-900 text-white shadow-xs font-semibold" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900")}>
                <QrCode className="w-4 h-4" />
                Scan Return QR
              </Link>
              <Link to={`${dashboardPath}?tab=inventory`} className={cn("flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all", location.search.includes('tab=inventory') ? "bg-slate-900 text-white shadow-xs font-semibold" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900")}>
                <Settings className="w-4 h-4" />
                Manage Inventory
              </Link>
            </>
          )}
        </nav>
        
        <div className="mt-auto pt-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-3 py-2.5 mb-2 bg-slate-50 rounded-xl border border-slate-200/60">
            <div className="w-9 h-9 rounded-full bg-slate-900 flex items-center justify-center text-white font-bold text-xs shadow-xs">
              {profile?.name ? profile.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
              {profile?.regNumber && (
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">
                  {profile.regNumber}
                </p>
              )}
              <p className="text-xs font-bold text-slate-900 truncate">{profile?.name || 'User'}</p>
              <p className="text-[10px] text-slate-500 truncate capitalize font-medium">{profile?.role || 'Guest'}</p>
            </div>
          </div>
          <button 
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-xl transition-colors font-medium text-xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen max-w-full overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Vinner Lab Logo" className="w-7 h-7 rounded-lg shadow-xs border border-slate-200" />
            <span className="text-base font-bold text-slate-900 tracking-tight">Vinner Lab</span>
          </div>
          <button 
            className="p-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <Menu className="w-4 h-4" />
          </button>
        </header>
        
        <div className="flex-1 p-4 md:p-8 overflow-auto">
          <div className="max-w-6xl mx-auto w-full">
            <Outlet />
          </div>
        </div>
      </main>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-end transition-opacity">
          <div className="w-72 h-full bg-white shadow-2xl p-4 flex flex-col transform transition-transform animate-in slide-in-from-right duration-200">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3 px-2">
                <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold">
                  {profile?.name ? profile.name.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
                </div>
                <div>
                  {profile?.regNumber && (
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      {profile.regNumber}
                    </p>
                  )}
                  <p className="text-sm font-medium text-slate-900">{profile?.name}</p>
                  <p className="text-xs text-slate-500 capitalize">{profile?.role}</p>
                </div>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="space-y-1.5 flex-1">
              <Link to={dashboardPath} onClick={() => setIsMobileMenuOpen(false)} className={cn("flex items-center gap-3 p-3 rounded-xl font-medium text-sm transition-all", (location.pathname === dashboardPath && !location.search.includes('tab=')) ? "bg-slate-900 text-white font-semibold" : "text-slate-600 hover:bg-slate-100")}>
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>
              <Link to={`${dashboardPath}?tab=history`} onClick={() => setIsMobileMenuOpen(false)} className={cn("flex items-center gap-3 p-3 rounded-xl font-medium text-sm transition-all", location.search.includes('tab=history') ? "bg-slate-900 text-white font-semibold" : "text-slate-600 hover:bg-slate-100")}>
                <History className="w-4 h-4" />
                History Log
              </Link>
              {isAdmin && (
                <>
                  <Link to="/admin/scan" onClick={() => setIsMobileMenuOpen(false)} className={cn("flex items-center gap-3 p-3 rounded-xl font-medium text-sm transition-all", location.pathname === '/admin/scan' ? "bg-slate-900 text-white font-semibold" : "text-slate-600 hover:bg-slate-100")}>
                    <QrCode className="w-4 h-4" />
                    Scan Return QR
                  </Link>
                  <Link to={`${dashboardPath}?tab=inventory`} onClick={() => setIsMobileMenuOpen(false)} className={cn("flex items-center gap-3 p-3 rounded-xl font-medium text-sm transition-all", location.search.includes('tab=inventory') ? "bg-slate-900 text-white font-semibold" : "text-slate-600 hover:bg-slate-100")}>
                    <Settings className="w-4 h-4" />
                    Manage Inventory
                  </Link>
                </>
              )}
            </nav>
            <div className="mt-auto pt-4 border-t border-slate-100">
              <button 
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 p-2.5 text-rose-600 hover:bg-rose-50 rounded-xl font-medium text-xs transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
