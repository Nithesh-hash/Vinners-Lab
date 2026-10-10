import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut, User, LayoutDashboard, History, Settings, X, Menu } from 'lucide-react';
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
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 glass border-r border-slate-200/60 sticky top-0 h-screen p-4 shadow-sm z-20">
        <div className="flex items-center gap-2 px-2 py-4 mb-6">
          <img src="/logo.png" alt="Vinner Lab Logo" className="w-8 h-8 rounded-lg shadow-sm border border-slate-200" />
          <span className="text-xl font-bold text-slate-800 tracking-tight">Vinner Lab</span>
        </div>
        
        <nav className="flex-1 space-y-2">
          <Link to={dashboardPath} className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors", (location.pathname === dashboardPath && !location.search.includes('tab=')) ? "bg-brand-50 text-brand-700 shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900")}>
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </Link>
          <Link to={`${dashboardPath}?tab=history`} className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors", location.search.includes('tab=history') ? "bg-brand-50 text-brand-700 shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900")}>
            <History className="w-5 h-5" />
            History
          </Link>
          {isAdmin && (
            <Link to={`${dashboardPath}?tab=inventory`} className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors", location.search.includes('tab=inventory') ? "bg-brand-50 text-brand-700 shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900")}>
              <Settings className="w-5 h-5" />
              Manage Inventory
            </Link>
          )}
        </nav>
        
        <div className="mt-auto pt-4 border-t border-slate-200/60">
          <div className="flex items-center gap-3 px-3 py-3 mb-2 bg-white/50 rounded-lg border border-slate-100">
            <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold border border-brand-200">
              {profile?.name ? profile.name.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{profile?.name}</p>
              <p className="text-xs text-slate-500 truncate capitalize">{profile?.role}</p>
            </div>
          </div>
          <button 
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg transition-colors font-medium text-sm"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen max-w-full overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 glass border-b border-slate-200/60 sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Vinner Lab Logo" className="w-6 h-6 rounded-md shadow-sm border border-slate-200" />
            <span className="text-lg font-bold text-slate-800 tracking-tight">Vinner Lab</span>
          </div>
          <button 
            className="p-2 text-slate-600 bg-white/80 hover:bg-white rounded-md border border-slate-200 shadow-sm transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <Menu className="w-5 h-5" />
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
                  <p className="text-sm font-medium text-slate-900">{profile?.name}</p>
                  <p className="text-xs text-slate-500 capitalize">{profile?.role}</p>
                </div>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="space-y-2 flex-1">
              <Link to={dashboardPath} onClick={() => setIsMobileMenuOpen(false)} className={cn("flex items-center gap-3 p-3 rounded-lg font-medium", (location.pathname === dashboardPath && !location.search.includes('tab=')) ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50")}>
                <LayoutDashboard className="w-5 h-5" />
                Dashboard
              </Link>
              <Link to={`${dashboardPath}?tab=history`} onClick={() => setIsMobileMenuOpen(false)} className={cn("flex items-center gap-3 p-3 rounded-lg font-medium", location.search.includes('tab=history') ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50")}>
                <History className="w-5 h-5" />
                History
              </Link>
              {isAdmin && (
                <Link to={`${dashboardPath}?tab=inventory`} onClick={() => setIsMobileMenuOpen(false)} className={cn("flex items-center gap-3 p-3 rounded-lg font-medium", location.search.includes('tab=inventory') ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50")}>
                  <Settings className="w-5 h-5" />
                  Manage Inventory
                </Link>
              )}
            </nav>
            <div className="mt-auto pt-4 border-t border-slate-200">
              <button 
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 p-3 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
