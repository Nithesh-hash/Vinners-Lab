import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, getDocs, doc, writeBatch, where, Timestamp, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Transaction, Component } from '@/types';
import { 
  Plus, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  Cpu, 
  Radio, 
  Layers, 
  Package, 
  X, 
  Boxes,
  ArrowRightLeft,
  QrCode
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'inventory';
  
  const setActiveTab = (tab: string) => {
    if (tab === 'inventory') {
      setSearchParams({});
    } else {
      setSearchParams({ tab });
    }
  };

  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [inventory, setInventory] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editComponent, setEditComponent] = useState<Component | null>(null);
  const [newComponent, setNewComponent] = useState({ name: '', category: 'Microcontrollers', description: '', quantity: 1, threshold: 2 });
  const [isSeeding, setIsSeeding] = useState(false);

  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutData, setCheckoutData] = useState({ component: null as Component | null, regNumber: '', quantity: 1, days: 7 });

  useEffect(() => {
    setLoading(true);

    const txQuery = query(collection(db, 'transactions'));
    const unsubscribeTx = onSnapshot(txQuery, (snapshot) => {
      const txData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      txData.sort((a, b) => (b.issueDate?.seconds || 0) - (a.issueDate?.seconds || 0));
      setTransactions(txData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching transactions:", error);
      setLoading(false);
    });

    const invQuery = query(collection(db, 'inventory'), where('isArchived', '==', false));
    const unsubscribeInv = onSnapshot(invQuery, (snapshot) => {
      const invData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Component));
      setInventory(invData);
    });

    return () => {
      unsubscribeTx();
      unsubscribeInv();
    };
  }, []);

  const handleSeedInventory = async () => {
    if (inventory.length > 0) return alert("Inventory already has items.");
    setIsSeeding(true);
    try {
      const batch = writeBatch(db);
      const items = [
        { name: 'ESP32 Development Board', category: 'Microcontrollers', description: 'Wi-Fi & Bluetooth MCU with integrated antenna', qty: 15 },
        { name: 'Arduino Uno R3', category: 'Microcontrollers', description: 'ATmega328P based microcontroller board', qty: 20 },
        { name: 'Raspberry Pi 4 Model B', category: 'SBC', description: '4GB RAM quad-core 64-bit microcomputer', qty: 5 },
        { name: 'DHT22 Digital Sensor', category: 'Sensors', description: 'Calibrated temperature & humidity sensor module', qty: 30 },
        { name: 'Ultrasonic Distance Sensor', category: 'Sensors', description: 'HC-SR04 sonar precision distance sensor', qty: 25 },
        { name: 'Motor Driver Shield', category: 'Modules', description: 'L298N dual H-bridge high power driver', qty: 10 },
      ];

      items.forEach(item => {
        const docRef = doc(collection(db, 'inventory'));
        batch.set(docRef, {
          id: docRef.id,
          name: item.name,
          category: item.category,
          description: item.description,
          totalQuantity: item.qty,
          availableQuantity: item.qty,
          issuedQuantity: 0,
          lowStockThreshold: 2,
          isArchived: false,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      });
      await batch.commit();
    } catch (e) {
      console.error(e);
      alert("Failed to seed inventory");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleAddComponent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const batch = writeBatch(db);
      const docRef = doc(collection(db, 'inventory'));
      batch.set(docRef, {
        id: docRef.id,
        name: newComponent.name,
        category: newComponent.category,
        description: newComponent.description,
        totalQuantity: Number(newComponent.quantity),
        availableQuantity: Number(newComponent.quantity),
        issuedQuantity: 0,
        lowStockThreshold: Number(newComponent.threshold),
        isArchived: false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      await batch.commit();
      setShowAddModal(false);
      setNewComponent({ name: '', category: 'Microcontrollers', description: '', quantity: 1, threshold: 2 });
    } catch {
      alert("Error adding component");
    }
  };

  const handleEditComponent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editComponent) return;
    try {
      const batch = writeBatch(db);
      const docRef = doc(db, 'inventory', editComponent.id);
      
      const qtyDiff = Number(editComponent.totalQuantity) - (inventory.find(i => i.id === editComponent.id)?.totalQuantity || 0);
      
      batch.update(docRef, {
        name: editComponent.name,
        category: editComponent.category,
        description: editComponent.description,
        totalQuantity: Number(editComponent.totalQuantity),
        availableQuantity: (inventory.find(i => i.id === editComponent.id)?.availableQuantity || 0) + qtyDiff,
        lowStockThreshold: Number(editComponent.lowStockThreshold),
        updatedAt: Timestamp.now()
      });
      await batch.commit();
      setShowEditModal(false);
      setEditComponent(null);
    } catch {
      alert("Error updating component");
    }
  };

  const isOverdue = (date: any) => {
    if (!date) return false;
    const returnDate = date.toDate ? date.toDate() : new Date(date.seconds * 1000);
    return new Date() > returnDate;
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutData.component) return;
    try {
      const q = query(collection(db, 'users'), where('regNumber', '==', checkoutData.regNumber.toUpperCase()));
      const snap = await getDocs(q);
      if (snap.empty) return alert("Student with specified Registration Number was not found!");
      const student = snap.docs[0].data();

      if (checkoutData.component.availableQuantity < checkoutData.quantity) return alert("Not enough available stock!");

      const batch = writeBatch(db);
      const txRef = doc(collection(db, 'transactions'));
      const expectedReturn = new Date();
      expectedReturn.setDate(expectedReturn.getDate() + checkoutData.days);
      
      batch.set(txRef, {
        id: txRef.id,
        componentId: checkoutData.component.id,
        componentName: checkoutData.component.name,
        studentId: student.uid,
        studentName: student.name,
        studentRegNumber: student.regNumber,
        quantity: checkoutData.quantity,
        status: 'Checked Out',
        issueDate: Timestamp.now(),
        expectedReturnDate: Timestamp.fromDate(expectedReturn)
      });

      const compRef = doc(db, 'inventory', checkoutData.component.id);
      batch.update(compRef, {
        availableQuantity: checkoutData.component.availableQuantity - checkoutData.quantity,
        issuedQuantity: checkoutData.component.issuedQuantity + checkoutData.quantity
      });

      await batch.commit();
      setShowCheckoutModal(false);
    } catch {
      alert("Error processing checkout");
    }
  };

  // Metrics
  const activeTransactions = transactions.filter(t => t.status !== 'Returned');
  const overdueCount = activeTransactions.filter(t => t.status === 'Overdue' || isOverdue(t.expectedReturnDate)).length;
  const availableUnits = inventory.reduce((a, b) => a + b.availableQuantity, 0);
  const issuedUnits = inventory.reduce((a, b) => a + b.issuedQuantity, 0);

  // Filtered inventory
  const categories = Array.from(new Set(inventory.map(i => i.category).filter(Boolean)));
  const filteredInventory = inventory.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (!matchesSearch) return false;
    if (categoryFilter === 'all') return true;
    if (categoryFilter === 'in_stock') return item.availableQuantity > 0;
    if (categoryFilter === 'low_stock') return item.availableQuantity <= item.lowStockThreshold;
    return item.category.toLowerCase() === categoryFilter.toLowerCase();
  });

  const getComponentIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'microcontrollers':
      case 'sbc':
        return <Cpu className="w-5 h-5 text-slate-700" />;
      case 'sensors':
        return <Radio className="w-5 h-5 text-slate-700" />;
      case 'modules':
        return <Layers className="w-5 h-5 text-slate-700" />;
      default:
        return <Boxes className="w-5 h-5 text-slate-700" />;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-80">
        <div className="w-9 h-9 border-3 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12 font-sans">
      {/* 1. TOP WELCOME CARD (Exact Reference UI Style for Vinner Lab) */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100/90 text-slate-700 border border-slate-200/80 mb-3.5">
            <Cpu className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-900 font-bold">Vinner Lab</span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-500 font-normal">Admin Management Console</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Welcome back, {profile?.name || 'Administrator'}
          </h1>

          <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
            Manage laboratory hardware inventory, issue components to students, monitor active checkouts, and process returns.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
          {inventory.length === 0 && (
            <button 
              onClick={handleSeedInventory} 
              disabled={isSeeding}
              className="px-4 py-2.5 rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-semibold text-xs transition-all shadow-2xs w-full sm:w-auto text-center"
            >
              {isSeeding ? 'Seeding...' : 'Seed Sample Catalog'}
            </button>
          )}

          <button 
            onClick={() => navigate('/admin/scan')}
            className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 rounded-full px-5 py-2.5 sm:py-3 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-2xs transition-all hover:scale-[1.01] active:scale-[0.99] whitespace-nowrap cursor-pointer w-full sm:w-auto"
          >
            <QrCode className="w-4 h-4 text-slate-700 shrink-0" />
            Scan Return QR
          </button>

          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-black hover:bg-neutral-800 text-white rounded-full px-5 py-2.5 sm:py-3 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] whitespace-nowrap cursor-pointer w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 stroke-[2.5] shrink-0" />
            Add Lab Component
          </button>
        </div>
      </div>

      {/* 2. STAT SUMMARY CARDS (Exact Reference UI Card Format) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: TOTAL COMPONENTS */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">TOTAL INVENTORY</p>
            <p className="text-3xl font-extrabold text-slate-900 mt-1">{inventory.length}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-600 border border-slate-200/60 flex items-center justify-center">
            <Package className="w-5 h-5 stroke-[1.75]" />
          </div>
        </div>

        {/* Card 2: AVAILABLE UNITS */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-emerald-600 tracking-wider uppercase">AVAILABLE UNITS</p>
            <p className="text-3xl font-extrabold text-emerald-600 mt-1">{availableUnits}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-500 border border-emerald-200/60 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 stroke-[1.75]" />
          </div>
        </div>

        {/* Card 3: CURRENTLY ISSUED */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-700 tracking-wider uppercase">CURRENTLY ISSUED</p>
            <p className="text-3xl font-extrabold text-slate-900 mt-1">{issuedUnits}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 border border-slate-200/60 flex items-center justify-center">
            <ArrowRightLeft className="w-5 h-5 stroke-[1.75]" />
          </div>
        </div>

        {/* Card 4: OVERDUE RETURNS */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-rose-600 tracking-wider uppercase">OVERDUE RETURNS</p>
            <p className={`text-3xl font-extrabold mt-1 ${overdueCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>{overdueCount}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 border border-slate-200/60 flex items-center justify-center">
            <AlertTriangle className={`w-5 h-5 stroke-[1.75] ${overdueCount > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
          </div>
        </div>
      </div>

      {/* NAVIGATION PILL TABS */}
      <div className="flex items-center gap-2 pt-2 border-b border-slate-200/80 pb-3 overflow-x-auto no-scrollbar -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
        <button 
          onClick={() => setActiveTab('inventory')} 
          className={cn(
            "px-4 py-2 rounded-full text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5", 
            activeTab === 'inventory' 
              ? "bg-slate-900 text-white shadow-xs" 
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          )}
        >
          <Cpu className="w-3.5 h-3.5" />
          Hardware Inventory ({inventory.length})
        </button>
        <button 
          onClick={() => setActiveTab('transactions')} 
          className={cn(
            "px-4 py-2 rounded-full text-xs font-semibold transition-all whitespace-nowrap", 
            activeTab === 'transactions' 
              ? "bg-slate-900 text-white shadow-xs" 
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          )}
        >
          Active Checkouts ({activeTransactions.length})
        </button>
        <button 
          onClick={() => setActiveTab('history')} 
          className={cn(
            "px-4 py-2 rounded-full text-xs font-semibold transition-all whitespace-nowrap", 
            activeTab === 'history' 
              ? "bg-slate-900 text-white shadow-xs" 
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          )}
        >
          Audit History
        </button>
      </div>

      {/* TAB 1: HARDWARE INVENTORY (Exact Reference UI 2-Column Cards Grid) */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1">
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Lab Hardware Inventory</h2>
              <p className="text-xs text-slate-500 mt-0.5">Manage component stock, threshold limits, and student issuances</p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search Bar matching Reference UI */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search components..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded-full bg-white border border-slate-200/90 pl-9 pr-4 py-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-black focus:border-black w-60 sm:w-64 shadow-2xs text-slate-800 placeholder:text-slate-400"
                />
              </div>

              {/* Filter Pills matching Reference UI */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-full border border-slate-200/80 shadow-2xs overflow-x-auto max-w-full">
                <button 
                  onClick={() => setCategoryFilter('all')}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${categoryFilter === 'all' ? 'bg-black text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  All Items
                </button>
                <button 
                  onClick={() => setCategoryFilter('in_stock')}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${categoryFilter === 'in_stock' ? 'bg-black text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  In Stock
                </button>
                <button 
                  onClick={() => setCategoryFilter('low_stock')}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${categoryFilter === 'low_stock' ? 'bg-black text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Low Stock
                </button>
                {categories.map(cat => (
                  <button 
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${categoryFilter.toLowerCase() === cat.toLowerCase() ? 'bg-black text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredInventory.length === 0 ? (
              <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-slate-200/80">
                <p className="text-slate-500 text-sm">No hardware components found matching your search query.</p>
              </div>
            ) : (
              filteredInventory.map(item => (
                <div key={item.id} className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200/60 flex items-center justify-center flex-shrink-0 text-slate-700">
                          {getComponentIcon(item.category)}
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-slate-900 leading-tight">{item.name}</h3>
                          <p className="text-[11px] text-slate-400 font-medium mt-0.5">SKU-{item.id.slice(0, 6).toUpperCase()} • Rack-{item.category.slice(0, 3).toUpperCase()}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                          item.availableQuantity > item.lowStockThreshold
                            ? 'border-emerald-300 bg-emerald-50/60 text-emerald-600'
                            : item.availableQuantity > 0
                            ? 'border-amber-300 bg-amber-50/60 text-amber-600'
                            : 'border-rose-300 bg-rose-50/60 text-rose-600'
                        }`}>
                          {item.availableQuantity > 0 ? `${item.availableQuantity} available` : 'Out of stock'}
                        </span>
                        <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full border border-slate-200/80 bg-slate-100 text-slate-600">
                          {item.category}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                      {item.description || 'Hardware resource registered in Vinner Lab inventory.'}
                    </p>

                    <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-medium flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span>Available: <strong className="font-bold text-slate-900">{item.availableQuantity}</strong></span>
                      <span className="text-slate-300">•</span>
                      <span>Issued: <strong className="font-semibold text-slate-700">{item.issuedQuantity}</strong></span>
                      <span className="text-slate-300">•</span>
                      <span>Total: <strong className="font-semibold text-slate-700">{item.totalQuantity}</strong></span>
                      <span className="text-slate-300">•</span>
                      <span>Threshold: <strong className="font-semibold text-slate-700">{item.lowStockThreshold}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
                    <button 
                      onClick={() => { setCheckoutData({ component: item, regNumber: '', quantity: 1, days: 7 }); setShowCheckoutModal(true); }}
                      className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                    >
                      Issue to Student
                    </button>
                    <button 
                      onClick={() => { setEditComponent(item); setShowEditModal(true); }}
                      className="py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ACTIVE CHECKOUTS */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Active Hardware Checkouts</h2>
            <p className="text-xs text-slate-500 mt-0.5">Real-time custody tracking for hardware loaned to students</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeTransactions.length === 0 ? (
              <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-slate-200/80">
                <p className="text-slate-500 text-sm">No active hardware checkouts currently logged.</p>
              </div>
            ) : (
              activeTransactions.map(tx => {
                const overdue = tx.status === 'Overdue' || isOverdue(tx.expectedReturnDate);
                return (
                  <div key={tx.id} className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-bold text-slate-900">{tx.componentName}</h3>
                          <p className="text-xs text-slate-500 mt-0.5 font-medium">
                            Student: <strong className="text-slate-800">{tx.studentName}</strong> ({tx.studentRegNumber})
                          </p>
                        </div>
                        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                          overdue 
                            ? 'border-rose-300 bg-rose-50 text-rose-700' 
                            : 'border-amber-300 bg-amber-50 text-amber-700'
                        }`}>
                          {overdue ? 'Overdue' : 'Checked Out'}
                        </span>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>Quantity: <strong className="text-slate-900">{tx.quantity} unit(s)</strong></span>
                        <span className="text-slate-300">•</span>
                        <span>Issued: {tx.issueDate ? new Date(tx.issueDate.seconds * 1000).toLocaleDateString() : 'N/A'}</span>
                        <span className="text-slate-300">•</span>
                        <span className={overdue ? 'text-rose-600 font-bold' : 'text-slate-700 font-semibold'}>
                          Due: {tx.expectedReturnDate ? new Date(tx.expectedReturnDate.seconds * 1000).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </div>

                    <button 
                      onClick={() => navigate(`/admin/return-loan?id=${tx.id}`)}
                      className="w-full mt-4 py-2 px-3 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold transition-colors flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Process Hardware Return
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight mb-1">Hardware Return History</h2>
          <p className="text-xs text-slate-500 mb-6">Historical record of completed checkouts and verified returns</p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200/80">
                <tr>
                  <th className="px-5 py-3 font-semibold uppercase tracking-wider">Student</th>
                  <th className="px-5 py-3 font-semibold uppercase tracking-wider">Component</th>
                  <th className="px-5 py-3 font-semibold uppercase tracking-wider">Qty</th>
                  <th className="px-5 py-3 font-semibold uppercase tracking-wider">Returned Date</th>
                  <th className="px-5 py-3 font-semibold uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.filter(t => t.status === 'Returned').length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">No return history records yet.</td></tr>
                ) : transactions.filter(t => t.status === 'Returned').map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-slate-900">{tx.studentName}</p>
                      <p className="text-[10px] text-slate-400">{tx.studentRegNumber}</p>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-800">{tx.componentName}</td>
                    <td className="px-5 py-3.5 text-slate-600 font-semibold">{tx.quantity}</td>
                    <td className="px-5 py-3.5 text-slate-500 font-mono">
                      {tx.returnDate ? new Date(tx.returnDate.seconds * 1000).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold border border-emerald-300 bg-emerald-50 text-emerald-700">
                        Returned
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD COMPONENT */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md max-h-[92dvh] flex flex-col overflow-hidden border border-slate-200/90 animate-in zoom-in-95 duration-150">
            <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900">Add Lab Component</h3>
              <button onClick={() => setShowAddModal(false)} className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddComponent} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Component Name</label>
                <input required type="text" placeholder="e.g. ESP32-S3 Dev Board" value={newComponent.name} onChange={e => setNewComponent({...newComponent, name: e.target.value})} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Category</label>
                  <input required type="text" placeholder="Microcontrollers, Sensors" value={newComponent.category} onChange={e => setNewComponent({...newComponent, category: e.target.value})} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Initial Units</label>
                  <input required type="number" min="1" value={newComponent.quantity} onChange={e => setNewComponent({...newComponent, quantity: Number(e.target.value)})} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Low Stock Threshold</label>
                <input required type="number" min="0" value={newComponent.threshold} onChange={e => setNewComponent({...newComponent, threshold: Number(e.target.value)})} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Description & Specifications</label>
                <textarea rows={2} value={newComponent.description} onChange={e => setNewComponent({...newComponent, description: e.target.value})} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black" />
              </div>
              <div className="pt-2 flex justify-end gap-2 shrink-0">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 sm:flex-initial px-4 py-2.5 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">Cancel</button>
                <button type="submit" className="flex-1 sm:flex-initial px-5 py-2.5 rounded-full bg-black text-white text-xs font-semibold hover:bg-neutral-800 shadow-sm cursor-pointer">Save Component</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT COMPONENT */}
      {showEditModal && editComponent && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md max-h-[92dvh] flex flex-col overflow-hidden border border-slate-200/90 animate-in zoom-in-95 duration-150">
            <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900">Edit Component</h3>
              <button onClick={() => setShowEditModal(false)} className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleEditComponent} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Name</label>
                <input required type="text" value={editComponent.name} onChange={e => setEditComponent({...editComponent, name: e.target.value})} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Category</label>
                  <input required type="text" value={editComponent.category} onChange={e => setEditComponent({...editComponent, category: e.target.value})} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Total Quantity</label>
                  <input required type="number" min="1" value={editComponent.totalQuantity} onChange={e => setEditComponent({...editComponent, totalQuantity: Number(e.target.value)})} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Low Stock Threshold</label>
                <input required type="number" min="0" value={editComponent.lowStockThreshold} onChange={e => setEditComponent({...editComponent, lowStockThreshold: Number(e.target.value)})} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Description</label>
                <textarea rows={2} value={editComponent.description} onChange={e => setEditComponent({...editComponent, description: e.target.value})} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black" />
              </div>
              <div className="pt-2 flex justify-end gap-2 shrink-0">
                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 sm:flex-initial px-4 py-2.5 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">Cancel</button>
                <button type="submit" className="flex-1 sm:flex-initial px-5 py-2.5 rounded-full bg-black text-white text-xs font-semibold hover:bg-neutral-800 shadow-sm cursor-pointer">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ISSUE / CHECKOUT TO STUDENT */}
      {showCheckoutModal && checkoutData.component && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md max-h-[92dvh] flex flex-col overflow-hidden border border-slate-200/90 animate-in zoom-in-95 duration-150">
            <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900">Issue Hardware</h3>
                <p className="text-xs text-slate-500">{checkoutData.component.name}</p>
              </div>
              <button onClick={() => setShowCheckoutModal(false)} className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCheckout} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Student Registration Number</label>
                <input required type="text" placeholder="e.g. 21BCE1042" value={checkoutData.regNumber} onChange={e => setCheckoutData({...checkoutData, regNumber: e.target.value})} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-900 uppercase focus:bg-white focus:outline-none focus:ring-1 focus:ring-black" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Quantity</label>
                  <input required type="number" min="1" max={checkoutData.component.availableQuantity} value={checkoutData.quantity} onChange={e => setCheckoutData({...checkoutData, quantity: Number(e.target.value)})} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Loan Duration (Days)</label>
                  <input required type="number" min="1" max="90" value={checkoutData.days} onChange={e => setCheckoutData({...checkoutData, days: Number(e.target.value)})} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black" />
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/60 text-xs text-slate-500">
                Available stock for loan: <strong className="text-slate-900">{checkoutData.component.availableQuantity} units</strong>
              </div>
              <div className="pt-2 flex justify-end gap-2 shrink-0">
                <button type="button" onClick={() => setShowCheckoutModal(false)} className="flex-1 sm:flex-initial px-4 py-2.5 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">Cancel</button>
                <button type="submit" className="flex-1 sm:flex-initial px-5 py-2.5 rounded-full bg-black text-white text-xs font-semibold hover:bg-neutral-800 shadow-sm cursor-pointer">Confirm Checkout</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
