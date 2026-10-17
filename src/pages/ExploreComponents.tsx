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

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Selected component modal for high-res preview
  const [previewComponent, setPreviewComponent] = useState<Component | null>(null);

  // Last update timestamp for live indicator
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Inactivity timeout (resets search after 3 mins of idle)
  const idleTimerRef = useRef<any>(null);

  const resetIdleTimer = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      // Auto-reset filters for the next visitor
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

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
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
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans selection:bg-brand-500 selection:text-white">
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

              {/* Fullscreen toggle */}
              <button
                onClick={toggleFullscreen}
                className="p-2 sm:px-3 sm:py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen Mode'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
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
            <div className="space-y-4">
              {filteredComponents.map((component) => {
                const isOutOfStock = component.availableQuantity <= 0;
                const isLowStock = !isOutOfStock && component.availableQuantity <= component.lowStockThreshold;
                const isInStock = component.availableQuantity > component.lowStockThreshold;

                return (
                  <article
                    key={component.id}
                    className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all p-4 sm:p-5 flex flex-col md:flex-row gap-5 lg:gap-7 items-stretch group"
                  >
                    {/* LEFT COLUMN: COMPONENT PHOTO (AMAZON STYLE) */}
                    <div 
                      onClick={() => setPreviewComponent(component)}
                      className="w-full md:w-56 lg:w-64 h-52 sm:h-60 md:h-52 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/70 rounded-2xl overflow-hidden shrink-0 relative flex items-center justify-center p-3 cursor-pointer group/img transition-all"
                    >
                      {component.imageUrl ? (
                        <img
                          src={component.imageUrl}
                          alt={component.name}
                          className="w-full h-full object-contain group-hover/img:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            // Fallback to placeholder if broken link
                            (e.target as HTMLImageElement).src = '/logo.png';
                          }}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-center p-4">
                          <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center shadow-xs text-slate-600 mb-2 group-hover/img:scale-105 transition-transform">
                            {getCategoryIcon(component.category)}
                          </div>
                          <span className="text-xs font-bold text-slate-700">{component.category}</span>
                          <span className="text-[10px] text-slate-400 mt-0.5">Vinner Lab Component</span>
                        </div>
                      )}

                      {/* Floating Category Pill on Image */}
                      <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-white/90 backdrop-blur-xs text-[11px] font-bold text-slate-700 border border-slate-200/80 shadow-2xs">
                        {component.category}
                      </span>

                      {/* Touch / Click to Zoom badge */}
                      <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-slate-900/70 text-white text-[10px] font-semibold opacity-0 group-hover/img:opacity-100 transition-opacity">
                        Tap to enlarge
                      </span>
                    </div>

                    {/* RIGHT COLUMN: DETAILS & AVAILABILITY (AMAZON STYLE) */}
                    <div className="flex-1 flex flex-col justify-between min-w-0">
                      <div>
                        {/* 1. COMPONENT NAME & CODE */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 
                              onClick={() => setPreviewComponent(component)}
                              className="text-xl sm:text-2xl font-extrabold text-slate-900 group-hover:text-brand-600 transition-colors cursor-pointer leading-tight"
                            >
                              {component.name}
                            </h3>
                            {component.code && (
                              <span className="font-mono text-xs sm:text-sm font-bold px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200/90 shadow-2xs">
                                {component.code}
                              </span>
                            )}
                          </div>

                          {/* Stock status pill header */}
                          <div className="shrink-0">
                            {isInStock && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                In Stock
                              </span>
                            )}
                            {isLowStock && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <AlertCircle className="w-3.5 h-3.5" />
                                Low Stock
                              </span>
                            )}
                            {isOutOfStock && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <XCircle className="w-3.5 h-3.5" />
                                Unavailable
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Category & Location info */}
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-400 font-medium">
                          <span>Category: <strong className="text-slate-600 font-semibold">{component.category}</strong></span>
                          {component.storageLocation && (
                            <>
                              <span>•</span>
                              <span>Location: <strong className="text-slate-700">{component.storageLocation}</strong></span>
                            </>
                          )}
                        </div>

                        {/* 2. DESCRIPTION OF THE COMPONENT (DOWN TO THE NAME) */}
                        <div className="mt-3">
                          <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
                            {component.description || 'Standard laboratory hardware module registered in the Vinner Lab inventory management system.'}
                          </p>
                        </div>
                      </div>

                      {/* 3. AVAILABILITY SECTION (BELOW DESCRIPTION) */}
                      <div className="mt-5 pt-4 border-t border-slate-100 space-y-3">
                        {/* Amazon Style Stock Declaration */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            {isInStock && (
                              <div className="space-y-0.5">
                                <p className="text-base sm:text-lg font-extrabold text-emerald-700 flex items-center gap-2">
                                  <span>In Stock ({component.availableQuantity} units available)</span>
                                </p>
                                <p className="text-xs text-slate-500">
                                  {component.availableQuantity} of {component.totalQuantity} units ready for immediate checkout to authorized student teams.
                                </p>
                              </div>
                            )}

                            {isLowStock && (
                              <div className="space-y-0.5">
                                <p className="text-base sm:text-lg font-extrabold text-amber-700 flex items-center gap-2">
                                  <span>Only {component.availableQuantity} units left in stock!</span>
                                </p>
                                <p className="text-xs text-slate-500">
                                  High demand hardware item. Low threshold set at {component.lowStockThreshold} units.
                                </p>
                              </div>
                            )}

                            {isOutOfStock && (
                              <div className="space-y-0.5">
                                <p className="text-base sm:text-lg font-extrabold text-rose-700 flex items-center gap-2">
                                  <span>Currently Out of Stock / All {component.totalQuantity} Units Issued</span>
                                </p>
                                <p className="text-xs text-slate-500">
                                  All units currently deployed in student projects. Availability updates automatically upon return.
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
                            <button
                              onClick={() => setPreviewComponent(component)}
                              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                            >
                              View Specs
                            </button>
                            <Link
                              to="/login?type=student"
                              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer ${
                                isOutOfStock
                                  ? 'bg-slate-200 text-slate-500 pointer-events-none'
                                  : 'bg-brand-600 hover:bg-brand-700 text-white'
                              }`}
                            >
                              <span>Checkout via Student Login</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </div>

                        {/* Availability Details without progress bar */}
                        <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-500 font-medium pt-1">
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
                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900">{previewComponent.name}</h3>
                    {previewComponent.code && (
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {previewComponent.code}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">Category: {previewComponent.category}</p>
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
