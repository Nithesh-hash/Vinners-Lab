import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  collection, 
  query, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Component } from '@/types';
import { 
  Search, 
  ArrowLeft, 
  Maximize2, 
  Minimize2, 
  Cpu, 
  Radio, 
  Layers, 
  Package, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  Sparkles, 
  ExternalLink, 
  RotateCcw,
  X,
  Clock,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import DeveloperBadge from '@/components/DeveloperBadge';

export default function ExploreComponents() {
  const { user, profile } = useAuth();
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'available_desc' | 'low_stock'>('available_desc');

  // Selected component modal for high-res preview
  const [previewComponent, setPreviewComponent] = useState<Component | null>(null);

  // Last update timestamp for live indicator
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Inactivity timeout (resets search after 3 mins of idle)
  const idleTimerRef = useRef<any>(null);

  const resetIdleTimer = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      if (searchQuery || selectedCategory !== 'all' || availabilityFilter !== 'all') {
        setSearchQuery('');
        setSelectedCategory('all');
        setAvailabilityFilter('all');
        setPreviewComponent(null);
      }
    }, 180000); // 3 minutes
  };

  useEffect(() => {
    const handleActivity = () => resetIdleTimer();
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, [searchQuery, selectedCategory, availabilityFilter]);

  // Fullscreen state: supports both native fullscreen and CSS kiosk fallback
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCssFullscreen, setIsCssFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Helper to detect active fullscreen element across all browser engines
  const getFullscreenElement = () => {
    const doc = document as any;
    return (
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement ||
      null
    );
  };

  // Exit all fullscreen modes (native + CSS)
  const exitAllFullscreen = () => {
    setIsCssFullscreen(false);
    const doc = document as any;
    if (getFullscreenElement()) {
      const exitFn =
        doc.exitFullscreen ||
        doc.webkitExitFullscreen ||
        doc.mozCancelFullScreen ||
        doc.msExitFullscreen;
      if (typeof exitFn === 'function') {
        try {
          exitFn.call(doc).catch(() => {});
        } catch {
          // ignore
        }
      }
    }
    setIsFullscreen(false);
  };

  // Listen to native fullscreen changes across all vendor prefixes
  useEffect(() => {
    const handleFsChange = () => {
      const isNativeFs = Boolean(getFullscreenElement());
      setIsFullscreen(isNativeFs || isCssFullscreen);
    };

    const doc = document as any;
    doc.addEventListener('fullscreenchange', handleFsChange);
    doc.addEventListener('webkitfullscreenchange', handleFsChange);
    doc.addEventListener('mozfullscreenchange', handleFsChange);
    doc.addEventListener('MSFullscreenChange', handleFsChange);

    return () => {
      doc.removeEventListener('fullscreenchange', handleFsChange);
      doc.removeEventListener('webkitfullscreenchange', handleFsChange);
      doc.removeEventListener('mozfullscreenchange', handleFsChange);
      doc.removeEventListener('MSFullscreenChange', handleFsChange);
    };
  }, [isCssFullscreen]);

  // Keep isFullscreen synced with isCssFullscreen & handle Escape key
  useEffect(() => {
    if (isCssFullscreen) {
      setIsFullscreen(true);
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          exitAllFullscreen();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    } else {
      setIsFullscreen(Boolean(getFullscreenElement()));
    }
  }, [isCssFullscreen]);

  // Toggle fullscreen with cross-browser prefixes & automatic CSS Kiosk fallback
  const toggleFullscreen = async () => {
    // If currently in any fullscreen mode, exit
    if (isFullscreen || isCssFullscreen || Boolean(getFullscreenElement())) {
      exitAllFullscreen();
      return;
    }

    // Try native fullscreen first (supports container or documentElement)
    const targetEl = containerRef.current || document.documentElement;
    const reqFn =
      (targetEl as any).requestFullscreen ||
      (targetEl as any).webkitRequestFullscreen ||
      (targetEl as any).mozRequestFullScreen ||
      (targetEl as any).msRequestFullscreen;

    if (typeof reqFn === 'function') {
      try {
        await reqFn.call(targetEl);
        setIsFullscreen(true);
        return;
      } catch (err) {
        console.warn('Native fullscreen blocked or restricted by browser; activating CSS Kiosk mode fallback:', err);
      }
    }

    // Fallback: Activate CSS Kiosk Fullscreen (guaranteed to work in all browsers/iframes/mobile)
    setIsCssFullscreen(true);
    setIsFullscreen(true);
  };

  // Real-time Firestore Listener
  const fetchInventory = () => {
    setLoading(true);
    setError(null);
    const q = query(collection(db, 'inventory'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs
        .map(doc => {
          const data = doc.data() as Component;
          const total = Math.max(0, Number(data.totalQuantity) || 0);
          const safeAvailable = Math.max(0, Math.min(total, Number(data.availableQuantity) || 0));
          return {
            ...data,
            id: doc.id,
            totalQuantity: total,
            availableQuantity: safeAvailable
          } as Component;
        })
        .filter(doc => !doc.isArchived);

      // Sort default by available quantity desc
      items.sort((a, b) => b.availableQuantity - a.availableQuantity);
      setComponents(items);
      setLoading(false);
      setError(null);
      setLastUpdated(new Date());
    }, (err: any) => {
      console.error("Firestore inventory subscription error:", err);
      if (err.code === 'permission-denied') {
        setError("Missing Firestore Permissions: Guests & unauthenticated visitors cannot read the 'inventory' collection yet. Please publish the updated firestore.rules in Firebase Console.");
      } else {
        setError(err.message || "Unable to stream live inventory. Please check your network connection.");
      }
      setLoading(false);
    });

    return unsubscribe;
  };

  useEffect(() => {
    const unsubscribe = fetchInventory();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Dynamic Categories from available items
  const categories = useMemo(() => {
    const set = new Set<string>();
    components.forEach(c => {
      if (c.category && c.category.trim()) {
        set.add(c.category.trim());
      }
    });
    return Array.from(set).sort();
  }, [components]);

  // Filtered & Sorted Components
  const filteredComponents = useMemo(() => {
    let result = components.filter(item => {
      // Search query filter (matches name, description, category, ID)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesCode = (item.code || '').toLowerCase().includes(q);
        const matchesDesc = (item.description || '').toLowerCase().includes(q);
        const matchesCat = (item.category || '').toLowerCase().includes(q);
        const matchesId = item.id.toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesDesc && !matchesCat && !matchesId) {
          return false;
        }
      }

      // Category filter
      if (selectedCategory !== 'all') {
        if (item.category?.toLowerCase() !== selectedCategory.toLowerCase()) {
          return false;
        }
      }

      // Availability filter
      if (availabilityFilter === 'in_stock') {
        if (item.availableQuantity <= 0) return false;
      } else if (availabilityFilter === 'low_stock') {
        if (item.availableQuantity <= 0 || item.availableQuantity > item.lowStockThreshold) return false;
      } else if (availabilityFilter === 'out_of_stock') {
        if (item.availableQuantity > 0) return false;
      }

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'available_desc') {
        return b.availableQuantity - a.availableQuantity;
      }
      if (sortBy === 'low_stock') {
        return a.availableQuantity - b.availableQuantity;
      }
      return 0;
    });

    return result;
  }, [components, searchQuery, selectedCategory, availabilityFilter, sortBy]);

  // Statistics
  const stats = useMemo(() => {
    const totalComponents = components.length;
    const totalUnits = components.reduce((sum, c) => sum + (c.totalQuantity || 0), 0);
    const availableUnits = components.reduce((sum, c) => sum + (c.availableQuantity || 0), 0);
    const issuedUnits = totalUnits - availableUnits;
    const inStockCount = components.filter(c => c.availableQuantity > 0).length;
    const outOfStockCount = components.filter(c => c.availableQuantity <= 0).length;

    return {
      totalComponents,
      totalUnits,
      availableUnits,
      issuedUnits,
      inStockCount,
      outOfStockCount
    };
  }, [components]);

  const getCategoryIcon = (category: string) => {
    const cat = (category || '').toLowerCase();
    if (cat.includes('micro') || cat.includes('esp') || cat.includes('arduino') || cat.includes('board')) {
      return <Cpu className="w-5 h-5 text-indigo-500" />;
    }
    if (cat.includes('sensor') || cat.includes('dht') || cat.includes('ultrasonic')) {
      return <Radio className="w-5 h-5 text-emerald-500" />;
    }
    if (cat.includes('sbc') || cat.includes('pi') || cat.includes('computer')) {
      return <Zap className="w-5 h-5 text-rose-500" />;
    }
    if (cat.includes('module') || cat.includes('driver') || cat.includes('shield')) {
      return <Layers className="w-5 h-5 text-amber-500" />;
    }
    return <Package className="w-5 h-5 text-slate-500" />;
  };

  return (
    <div 
      ref={containerRef}
      className={`min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans selection:bg-brand-500 selection:text-white ${
        isCssFullscreen ? 'fixed inset-0 z-50 overflow-y-auto w-screen h-screen' : ''
      }`}
    >
      {/* Top Banner & Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            {/* Left: Back button & Lab Identity */}
            <div className="flex items-center gap-3 sm:gap-4">
              <Link 
                to={user && profile ? (profile.role === 'admin' ? '/admin' : '/dashboard') : '/'}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs sm:text-sm font-semibold transition-colors group cursor-pointer"
                title="Return to Home Screen"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                <span className="hidden sm:inline">Back</span>
              </Link>

              <div className="flex items-center gap-2.5">
                <img 
                  src="/logo.png" 
                  alt="Vinner Lab" 
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl shadow-xs border border-slate-200/80 bg-white p-0.5" 
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-base sm:text-xl font-extrabold text-slate-900 tracking-tight">
                      Vinner Lab
                    </h1>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-brand-50 text-brand-700 border border-brand-200">
                      <Sparkles className="w-3 h-3 text-brand-600" />
                      Hardware Catalog
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 hidden sm:block">
                    Real-time Hardware Inventory & Stock Status
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Realtime status, Fullscreen, Developer badge, and Auth actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              <DeveloperBadge />

              {/* Live sync pulse badge */}
              <div 
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold"
                title={`Last synced: ${lastUpdated.toLocaleTimeString()}`}
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Live Sync</span>
              </div>

              {/* Fullscreen toggle button */}
              <button
                onClick={toggleFullscreen}
                className={`p-2 sm:px-3 sm:py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer ${
                  isFullscreen
                    ? 'bg-brand-50 border-brand-300 text-brand-700 shadow-xs'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                }`}
                title={isFullscreen ? 'Exit Fullscreen Mode (Esc)' : 'Enter Fullscreen Mode'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4 text-brand-600" /> : <Maximize2 className="w-4 h-4" />}
                <span className="hidden lg:inline">{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
              </button>

              {/* Login / Dashboard link */}
              {user && profile ? (
                <Link
                  to={profile.role === 'admin' ? '/admin' : '/dashboard'}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  My Dashboard
                </Link>
              ) : (
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Link
                    to="/login?type=student"
                    className="px-3 sm:px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold shadow-xs transition-colors"
                  >
                    Student Login
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6">
        {/* STATS RIBBON */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Components</p>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">{stats.totalComponents}</span>
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">Catalog</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Unique hardware items in lab</p>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-emerald-100 bg-linear-to-br from-white to-emerald-50/30 shadow-2xs">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Available Units</p>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600">{stats.availableUnits}</span>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">Ready</span>
            </div>
            <p className="text-[11px] text-emerald-600/80 mt-1">In stock & ready to checkout</p>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Currently Issued</p>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">{stats.issuedUnits}</span>
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">On Loan</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Under active student loans</p>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Units Stocked</p>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">{stats.totalUnits}</span>
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">Capacity</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Across all hardware tiers</p>
          </div>
        </section>

        {/* SEARCH & FILTERS BAR */}
        <section className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-4">
          {/* Search Input Row */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search components by name, category, or specs (e.g. ESP32, Sensor, Pi, Driver)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-10 py-3 sm:py-3.5 bg-slate-50 hover:bg-slate-100/60 focus:bg-white text-slate-900 text-sm sm:text-base rounded-2xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider hidden md:inline">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="py-3 px-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 cursor-pointer"
              >
                <option value="available_desc">Availability (Highest first)</option>
                <option value="name">Name (A to Z)</option>
                <option value="low_stock">Low Stock (Needs Attention)</option>
              </select>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Categories
              </span>
              {(selectedCategory !== 'all' || availabilityFilter !== 'all' || searchQuery) && (
                <button
                  onClick={() => {
                    setSelectedCategory('all');
                    setAvailabilityFilter('all');
                    setSearchQuery('');
                  }}
                  className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset all filters
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200/70 text-slate-600'
                }`}
              >
                All Categories ({components.length})
              </button>
              {categories.map((cat) => {
                const count = components.filter(c => c.category?.toLowerCase() === cat.toLowerCase()).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      selectedCategory.toLowerCase() === cat.toLowerCase()
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200/70 text-slate-600'
                    }`}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Availability Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pt-1 border-t border-slate-100 scrollbar-none">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
              Availability:
            </span>
            <button
              onClick={() => setAvailabilityFilter('all')}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                availabilityFilter === 'all'
                  ? 'bg-slate-800 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All Items
            </button>
            <button
              onClick={() => setAvailabilityFilter('in_stock')}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                availabilityFilter === 'in_stock'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-emerald-700 bg-emerald-50/60 hover:bg-emerald-100/60 border border-emerald-200/60'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              In Stock Only ({stats.inStockCount})
            </button>
            <button
              onClick={() => setAvailabilityFilter('low_stock')}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                availabilityFilter === 'low_stock'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-amber-700 bg-amber-50/60 hover:bg-amber-100/60 border border-amber-200/60'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              Low Stock (&le; threshold)
            </button>
            <button
              onClick={() => setAvailabilityFilter('out_of_stock')}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                availabilityFilter === 'out_of_stock'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'text-rose-700 bg-rose-50/60 hover:bg-rose-100/60 border border-rose-200/60'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              Out of Stock ({stats.outOfStockCount})
            </button>
          </div>
        </section>

        {/* COMPONENT LISTINGS — DOWN BY DOWN (AMAZON STYLE) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              Showing {filteredComponents.length} {filteredComponents.length === 1 ? 'Component' : 'Components'}
            </h2>
            <span className="text-xs text-slate-500">
              Tap any photo or component for full details
            </span>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3">
              <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-semibold text-slate-500">Syncing live lab components...</p>
            </div>
          ) : error ? (
            <div className="p-8 bg-red-50 rounded-2xl border border-red-200 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
              <h3 className="font-bold text-red-800 text-base">Connection Notice</h3>
              <p className="text-xs text-red-600 max-w-lg mx-auto leading-relaxed">{error}</p>
              <div className="pt-2">
                <button
                  onClick={() => fetchInventory()}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  Retry Connection
                </button>
              </div>
            </div>
          ) : filteredComponents.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-6 space-y-3">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Package className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">No matching components found</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                No items matched "{searchQuery || selectedCategory}". Try adjusting your search query or filters.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                  setAvailabilityFilter('all');
                }}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-black transition-colors cursor-pointer"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="space-y-5 sm:space-y-6">
              {filteredComponents.map((component) => {
                const isOutOfStock = component.availableQuantity <= 0;
                const isLowStock = !isOutOfStock && component.availableQuantity <= component.lowStockThreshold;
                const isInStock = component.availableQuantity > component.lowStockThreshold;

                return (
                  <article
                    key={component.id}
                    className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.07)] hover:border-slate-300/90 transition-all duration-300 overflow-hidden flex flex-col md:flex-row items-stretch group"
                  >
                    {/* LEFT COLUMN: COMPONENT HARDWARE PHOTO SHOWCASE (EDITORIAL PEDESTAL) */}
                    <div 
                      onClick={() => setPreviewComponent(component)}
                      className="w-full md:w-72 lg:w-80 shrink-0 p-3.5 sm:p-5 flex flex-col justify-center bg-[#F9FAFB] md:border-r border-b md:border-b-0 border-slate-200/70 cursor-pointer"
                    >
                      <div className="relative w-full h-52 sm:h-60 md:h-56 rounded-2xl bg-white border border-slate-200/90 shadow-[0_4px_18px_rgba(0,0,0,0.05)] overflow-hidden flex items-center justify-center p-4 group/plate transition-all duration-300 group-hover:border-brand-300 group-hover:shadow-[0_8px_26px_rgba(80,117,193,0.15)]">
                        {component.imageUrl ? (
                          <img
                            src={component.imageUrl}
                            alt={component.name}
                            className="w-full h-full object-contain group-hover/plate:scale-105 transition-transform duration-500 ease-out"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/logo.png';
                            }}
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-center p-4 space-y-2">
                            <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center shadow-2xs text-slate-700 group-hover/plate:scale-110 transition-transform duration-300">
                              {getCategoryIcon(component.category)}
                            </div>
                            <div>
                              <span className="text-xs font-bold text-slate-800 block">{component.category || 'Hardware'}</span>
                              <span className="text-[10px] text-slate-400 font-medium">Vinner Lab Certified</span>
                            </div>
                          </div>
                        )}

                        {/* Top-Left Category Badge */}
                        <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-white/95 backdrop-blur-md text-[10px] sm:text-[11px] font-bold text-slate-700 border border-slate-200/80 shadow-2xs flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
                          <span>{component.category}</span>
                        </div>

                        {/* Bottom-Right Tap to Enlarge Badge */}
                        <div className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-semibold opacity-0 group-hover/plate:opacity-100 transition-opacity duration-200 shadow-sm flex items-center gap-1">
                          <Maximize2 className="w-3 h-3" />
                          <span>Inspect</span>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT COLUMN: EDITORIAL SHOWCASE (EXACT VISUAL HIERARCHY AS REFERENCE IMAGE) */}
                    <div className="flex-1 flex flex-col justify-between p-4 sm:p-6 lg:p-7 min-w-0">
                      <div>
                        {/* 1. TOP SUBTITLE WITH DOT BULLETS (LIKE • STARTER • VEG IN REFERENCE IMAGE) */}
                        <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                          <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
                            <span>•</span>
                            <span className="text-slate-500">VINNER LAB</span>
                            <span>•</span>
                            <span className="text-slate-700">{component.category}</span>
                            {component.storageLocation && (
                              <>
                                <span>•</span>
                                <span className="text-slate-500">{component.storageLocation}</span>
                              </>
                            )}
                          </div>

                          {/* Live Availability Tag */}
                          <div>
                            {isInStock && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                In Stock
                              </span>
                            )}
                            {isLowStock && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
                                <AlertCircle className="w-3 h-3" />
                                Low Stock
                              </span>
                            )}
                            {isOutOfStock && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
                                <XCircle className="w-3 h-3" />
                                Unavailable
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 2. THE DISTINCT WARM-TINTED BANNER BAND WITH BOLD SERIF TITLE (LIKE "MUSHROOM SALT & PEPPER") */}
                        <div className="-mx-4 sm:-mx-6 lg:-mx-7 px-4 sm:px-6 lg:px-7 py-3 sm:py-3.5 my-2.5 bg-[#EDE8DF]/75 border-y border-[#DDD7CD] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 
                              onClick={() => setPreviewComponent(component)}
                              className="font-serif text-2xl sm:text-3xl lg:text-[2.15rem] font-bold text-slate-900 group-hover:text-brand-800 transition-colors cursor-pointer tracking-tight leading-tight"
                            >
                              {component.name}
                            </h3>
                            {component.code && (
                              <span className="font-mono text-xs sm:text-sm font-bold px-2.5 py-0.5 rounded-lg bg-white/90 text-indigo-800 border border-indigo-200/90 shadow-2xs">
                                {component.code}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 3. COMPONENT DESCRIPTION */}
                        <div className="mt-2.5 text-slate-600 text-xs sm:text-sm leading-relaxed">
                          <p>
                            {component.description || 'Standard laboratory hardware module registered in the Vinner Lab inventory management system.'}
                          </p>
                        </div>
                      </div>

                      {/* 4. STOCK METRICS & ACTION STRIP */}
                      <div className="mt-5 pt-4 border-t border-slate-100 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          {/* Stock Status Details */}
                          <div>
                            {isInStock && (
                              <div>
                                <p className="text-sm sm:text-base font-extrabold text-emerald-700 flex items-center gap-1.5">
                                  <span>In Stock — {component.availableQuantity} units ready for issue</span>
                                </p>
                                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                                  Ready for immediate student checkout and project assignment.
                                </p>
                              </div>
                            )}

                            {isLowStock && (
                              <div>
                                <p className="text-sm sm:text-base font-extrabold text-amber-700 flex items-center gap-1.5">
                                  <span>Only {component.availableQuantity} units left in stock!</span>
                                </p>
                                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                                  High demand hardware item. Threshold set at {component.lowStockThreshold} units.
                                </p>
                              </div>
                            )}

                            {isOutOfStock && (
                              <div>
                                <p className="text-sm sm:text-base font-extrabold text-rose-700 flex items-center gap-1.5">
                                  <span>All {component.totalQuantity} units currently issued</span>
                                </p>
                                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                                  Currently on loan to student teams. Auto-updates when returned.
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => setPreviewComponent(component)}
                              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                            >
                              View Specs
                            </button>
                            <Link
                              to="/login?type=student"
                              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer ${
                                isOutOfStock
                                  ? 'bg-slate-200 text-slate-500 pointer-events-none'
                                  : 'bg-slate-900 hover:bg-black text-white'
                              }`}
                            >
                              <span>Sign in to Borrow</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </div>

                        {/* Stock Metric Pills */}
                        <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-500 font-medium pt-1.5 border-t border-slate-50">
                          <span>Available: <strong className="text-slate-900 font-bold">{component.availableQuantity}</strong> units</span>
                          <span>Issued: <strong className="text-slate-700 font-semibold">{component.totalQuantity - component.availableQuantity}</strong></span>
                          <span>Total Lab Stock: <strong className="text-slate-700 font-semibold">{component.totalQuantity}</strong> units</span>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* MODAL: FULL RESOLUTION PREVIEW & SPECS */}
      {previewComponent && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setPreviewComponent(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-2xl w-full max-h-[92dvh] overflow-hidden flex flex-col shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 shadow-2xs">
                  {getCategoryIcon(previewComponent.category)}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-serif text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">{previewComponent.name}</h3>
                    {previewComponent.code && (
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {previewComponent.code}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-medium tracking-wide">Category: {previewComponent.category}</p>
                </div>
              </div>
              <button
                onClick={() => setPreviewComponent(null)}
                className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
              {/* Photo Large Container */}
              <div className="w-full h-64 sm:h-80 bg-slate-50 border border-slate-200/80 rounded-2xl overflow-hidden flex items-center justify-center p-4 relative shadow-inner">
                {previewComponent.imageUrl ? (
                  <img
                    src={previewComponent.imageUrl}
                    alt={previewComponent.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 space-y-2">
                    <Package className="w-16 h-16 stroke-1" />
                    <span className="text-xs font-semibold">No high-res photo uploaded</span>
                  </div>
                )}
                <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-white/90 backdrop-blur-xs text-xs font-bold text-slate-800 shadow-xs border border-slate-200">
                  {previewComponent.availableQuantity > 0 
                    ? `🟢 ${previewComponent.availableQuantity} Units Available`
                    : '🔴 Out of Stock'}
                </div>
              </div>

              {/* Description & Technical Specs */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Description & Specifications
                </h4>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                  {previewComponent.description || 'Standard laboratory hardware module.'}
                </div>
              </div>

              {/* Availability Breakdown */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Current Lab Stock Status
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                    <p className="text-xs text-emerald-700 font-semibold">Available Stock</p>
                    <p className="text-2xl font-extrabold text-emerald-800 mt-1">{previewComponent.availableQuantity}</p>
                    <p className="text-[10px] text-emerald-600 mt-0.5">Units in lab</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-center">
                    <p className="text-xs text-amber-700 font-semibold">Currently Issued</p>
                    <p className="text-2xl font-extrabold text-amber-800 mt-1">{previewComponent.totalQuantity - previewComponent.availableQuantity}</p>
                    <p className="text-[10px] text-amber-600 mt-0.5">Units on loan</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                    <p className="text-xs text-slate-600 font-semibold">Total Inventory</p>
                    <p className="text-2xl font-extrabold text-slate-900 mt-1">{previewComponent.totalQuantity}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Lab capacity</p>
                  </div>
                </div>
              </div>

              {/* Issuance Instructions */}
              <div className="p-4 rounded-2xl bg-brand-50/60 border border-brand-200/80 text-xs text-brand-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-brand-600" />
                  How to borrow this component at Vinner Lab
                </p>
                <p className="text-brand-800/80 leading-relaxed">
                  Log in as a Student, request authorization under an SSV or FSV Project Code, or show your Registration Number at the lab administrator counter.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2 shrink-0">
              <button
                onClick={() => setPreviewComponent(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Close View
              </button>
              <Link
                to="/login?type=student"
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                Sign in to Checkout
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Floating Exit Fullscreen Button when in Fullscreen/Kiosk Mode */}
      {isFullscreen && (
        <div className="fixed bottom-5 right-5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <button
            onClick={exitAllFullscreen}
            className="px-4 py-2.5 rounded-full bg-slate-900/90 hover:bg-black text-white text-xs font-semibold shadow-xl backdrop-blur-md flex items-center gap-2 border border-white/20 transition-all cursor-pointer group hover:scale-105 active:scale-95"
            title="Exit Fullscreen Mode (Esc)"
          >
            <Minimize2 className="w-3.5 h-3.5 text-brand-400 group-hover:scale-110 transition-transform" />
            <span>Exit Fullscreen</span>
            <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono">ESC</span>
          </button>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200/80 bg-white py-4 px-4 sm:px-8 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Vinner Lab Hardware Management System • Hardware Catalog</span>
          <span className="flex items-center gap-1.5 text-slate-500">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            Live sync active • Auto-refreshes on checkout & return
          </span>
        </div>
      </footer>
    </div>
  );
}
