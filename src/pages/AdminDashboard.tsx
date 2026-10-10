import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import { collection, query, getDocs, doc, writeBatch, where, Timestamp, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Transaction, Component } from '@/types';
import { AlertCircle, Package2, CheckCircle2, Plus, ArrowRightLeft, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AdminDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';
  
  const setActiveTab = (tab: string) => {
    if (tab === 'overview') {
      setSearchParams({});
    } else {
      setSearchParams({ tab });
    }
  };
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [inventory, setInventory] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editComponent, setEditComponent] = useState<Component | null>(null);
  const [newComponent, setNewComponent] = useState({ name: '', category: '', description: '', quantity: 1, threshold: 0 });
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
        { name: 'ESP32 Development Board', category: 'Microcontrollers', description: 'Wi-Fi & Bluetooth MCU', qty: 15 },
        { name: 'Arduino Uno', category: 'Microcontrollers', description: 'ATmega328P based board', qty: 20 },
        { name: 'Raspberry Pi 4', category: 'SBC', description: '4GB RAM model', qty: 5 },
        { name: 'DHT22 Sensor', category: 'Sensors', description: 'Temp & Humidity', qty: 30 },
        { name: 'Ultrasonic Sensor', category: 'Sensors', description: 'HC-SR04', qty: 25 },
        { name: 'Motor Driver Module', category: 'Modules', description: 'L298N', qty: 10 },
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
      setNewComponent({ name: '', category: '', description: '', quantity: 1, threshold: 0 });
    } catch (e) {
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
    } catch (e) {
      alert("Error updating component");
    }
  };

  const handleDeleteComponent = async (id: string) => {
    if (!confirm("Are you sure you want to archive this component?")) return;
    try {
      const batch = writeBatch(db);
      const docRef = doc(db, 'inventory', id);
      batch.update(docRef, { isArchived: true, updatedAt: Timestamp.now() });
      await batch.commit();
    } catch (e) {
      alert("Error archiving component");
    }
  };

  const isOverdue = (date: any) => {
    if (!date) return false;
    const returnDate = date.toDate ? date.toDate() : new Date(date.seconds * 1000);
    return new Date() > returnDate;
  };

  const handleProcessReturn = async (tx: Transaction) => {
    try {
      const batch = writeBatch(db);
      const txRef = doc(db, 'transactions', tx.id);
      batch.update(txRef, {
        status: 'Returned',
        returnDate: Timestamp.now()
      });
      const compRef = doc(db, 'inventory', tx.componentId);
      const compDoc = await getDoc(compRef);
      if (compDoc.exists()) {
        const comp = compDoc.data();
        batch.update(compRef, {
          availableQuantity: comp.availableQuantity + tx.quantity,
          issuedQuantity: comp.issuedQuantity - tx.quantity
        });
      }
      await batch.commit();
    } catch (e) {
      alert("Error processing return");
    }
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutData.component) return;
    try {
      const q = query(collection(db, 'users'), where('regNumber', '==', checkoutData.regNumber.toUpperCase()));
      const snap = await getDocs(q);
      if (snap.empty) return alert("Student not found!");
      const student = snap.docs[0].data();

      if (checkoutData.component.availableQuantity < checkoutData.quantity) return alert("Not enough stock!");

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
    } catch (e) {
      alert("Error processing checkout");
    }
  };

  const activeTransactions = transactions.filter(t => t.status !== 'Returned');
  const overdueCount = activeTransactions.filter(t => t.status === 'Overdue' || isOverdue(t.expectedReturnDate)).length;
  const lowStockCount = inventory.filter(i => i.availableQuantity <= i.lowStockThreshold).length;

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-slate-500">Manage Vinner Lab hardware inventory and tracking.</p>
        </div>
        <div className="flex gap-2">
          {inventory.length === 0 && (
            <button onClick={handleSeedInventory} disabled={isSeeding} className="glass-button-secondary py-1.5">
              {isSeeding ? 'Seeding...' : 'Seed Sample Data'}
            </button>
          )}
          <button onClick={() => setShowAddModal(true)} className="glass-button flex items-center gap-2 py-1.5">
            <Plus className="w-4 h-4" /> Add Component
          </button>
        </div>
      </div>

      <div className="flex border-b border-slate-200">
        <button onClick={() => setActiveTab('overview')} className={cn("px-4 py-3 font-medium text-sm transition-colors border-b-2", activeTab === 'overview' ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300")}>Overview</button>
        <button onClick={() => setActiveTab('inventory')} className={cn("px-4 py-3 font-medium text-sm transition-colors border-b-2", activeTab === 'inventory' ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300")}>Manage Inventory</button>
        <button onClick={() => setActiveTab('transactions')} className={cn("px-4 py-3 font-medium text-sm transition-colors border-b-2", activeTab === 'transactions' ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300")}>Active Transactions</button>
        <button onClick={() => setActiveTab('history')} className={cn("px-4 py-3 font-medium text-sm transition-colors border-b-2", activeTab === 'history' ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300")}>History</button>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card p-5">
              <div className="flex items-center gap-3 mb-2 text-slate-700">
                <Package2 className="w-5 h-5 text-brand-600" />
                <h3 className="font-medium">Total Components</h3>
              </div>
              <p className="text-3xl font-bold text-slate-900">{inventory.length}</p>
            </div>
            <div className="glass-card p-5">
              <div className="flex items-center gap-3 mb-2 text-slate-700">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-medium">Available Units</h3>
              </div>
              <p className="text-3xl font-bold text-slate-900">{inventory.reduce((a, b) => a + b.availableQuantity, 0)}</p>
            </div>
            <div className="glass-card p-5">
              <div className="flex items-center gap-3 mb-2 text-slate-700">
                <ArrowRightLeft className="w-5 h-5 text-blue-600" />
                <h3 className="font-medium">Currently Issued</h3>
              </div>
              <p className="text-3xl font-bold text-slate-900">{inventory.reduce((a, b) => a + b.issuedQuantity, 0)}</p>
            </div>
            <div className="glass-card p-5">
              <div className="flex items-center gap-3 mb-2 text-slate-700">
                <AlertCircle className={`w-5 h-5 ${overdueCount > 0 ? 'text-red-600' : 'text-slate-400'}`} />
                <h3 className="font-medium">Overdue Returns</h3>
              </div>
              <p className={`text-3xl font-bold ${overdueCount > 0 ? 'text-red-600' : 'text-slate-900'}`}>{overdueCount}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-card p-5">
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" /> Low Stock Alerts
              </h2>
              {lowStockCount === 0 ? (
                <p className="text-slate-500 text-sm">All components are well stocked.</p>
              ) : (
                <div className="space-y-3">
                  {inventory.filter(i => i.availableQuantity <= i.lowStockThreshold).map(item => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-amber-50 rounded-lg border border-amber-100">
                      <div>
                        <p className="font-medium text-slate-800 text-sm">{item.name}</p>
                        <p className="text-xs text-slate-500">{item.category}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-amber-700 font-bold">{item.availableQuantity} left</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="glass-card p-5">
              <h2 className="text-lg font-bold text-slate-800 mb-4">Recent Activity</h2>
              <div className="space-y-4">
                {transactions.slice(0, 5).length === 0 ? (
                  <p className="text-slate-500 text-sm">No recent transactions.</p>
                ) : transactions.slice(0, 5).map(tx => (
                  <div key={tx.id} className="flex gap-3 text-sm border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-500">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-slate-800">
                        <span className="font-medium">{tx.studentName}</span> {tx.status === 'Returned' ? 'returned' : 'checked out'} <span className="font-medium">{tx.quantity}x {tx.componentName}</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {tx.status === 'Returned' ? new Date(tx.returnDate?.seconds * 1000).toLocaleString() : new Date(tx.issueDate?.seconds * 1000).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'inventory' && (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50/50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium">Category</th>
                  <th className="px-6 py-4 font-medium">Available</th>
                  <th className="px-6 py-4 font-medium">Issued</th>
                  <th className="px-6 py-4 font-medium">Total</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventory.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-medium text-slate-900">{item.name}</td>
                    <td className="px-6 py-4 text-slate-600">{item.category}</td>
                    <td className="px-6 py-4">
                      <span className={item.availableQuantity <= item.lowStockThreshold ? 'text-amber-600 font-bold' : 'text-emerald-600 font-medium'}>
                        {item.availableQuantity}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{item.issuedQuantity}</td>
                    <td className="px-6 py-4 text-slate-600">{item.totalQuantity}</td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                      <button onClick={() => { setCheckoutData({ component: item, regNumber: '', quantity: 1, days: 7 }); setShowCheckoutModal(true); }} className="text-brand-600 hover:text-brand-800 font-medium text-xs bg-brand-50 px-3 py-1.5 rounded-md border border-brand-200 transition-colors">Issue</button>
                      <button onClick={() => { setEditComponent(item); setShowEditModal(true); }} className="text-amber-600 hover:text-amber-800 font-medium text-xs bg-amber-50 px-3 py-1.5 rounded-md border border-amber-200 transition-colors">Edit</button>
                      <button onClick={() => handleDeleteComponent(item.id)} className="text-red-600 hover:text-red-800 font-medium text-xs bg-red-50 px-3 py-1.5 rounded-md border border-red-200 transition-colors">Archive</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50/50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-medium">Student</th>
                  <th className="px-6 py-4 font-medium">Component</th>
                  <th className="px-6 py-4 font-medium">Qty</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeTransactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900">{tx.studentName}</p>
                      <p className="text-xs text-slate-500">{tx.studentRegNumber}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-700">{tx.componentName}</td>
                    <td className="px-6 py-4 text-slate-600">{tx.quantity}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                        tx.status === 'Overdue' || isOverdue(tx.expectedReturnDate) ? 'bg-red-50 text-red-700 border-red-200' :
                        'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {tx.status === 'Checked Out' && isOverdue(tx.expectedReturnDate) ? 'Overdue' : tx.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleProcessReturn(tx)} className="text-emerald-600 hover:text-emerald-800 font-medium text-xs bg-emerald-50 px-3 py-1.5 rounded-md border border-emerald-200 transition-colors">Process Return</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50/50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-medium">Student</th>
                  <th className="px-6 py-4 font-medium">Component</th>
                  <th className="px-6 py-4 font-medium">Qty</th>
                  <th className="px-6 py-4 font-medium">Returned Date</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.filter(t => t.status === 'Returned').length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No returned items yet.</td></tr>
                ) : transactions.filter(t => t.status === 'Returned').map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900">{tx.studentName}</p>
                      <p className="text-xs text-slate-500">{tx.studentRegNumber}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-700">{tx.componentName}</td>
                    <td className="px-6 py-4 text-slate-600">{tx.quantity}</td>
                    <td className="px-6 py-4 text-slate-600">{tx.returnDate ? new Date(tx.returnDate.seconds * 1000).toLocaleDateString() : 'N/A'}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-md text-xs font-medium border bg-emerald-50 text-emerald-700 border-emerald-200">
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

      {/* Add Component Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="font-bold text-slate-800">Add New Component</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            <form onSubmit={handleAddComponent} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input required type="text" value={newComponent.name} onChange={e => setNewComponent({...newComponent, name: e.target.value})} className="glass-input bg-slate-50 border-slate-200 focus:bg-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <input required type="text" value={newComponent.category} onChange={e => setNewComponent({...newComponent, category: e.target.value})} className="glass-input bg-slate-50 border-slate-200 focus:bg-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <input type="text" value={newComponent.description} onChange={e => setNewComponent({...newComponent, description: e.target.value})} className="glass-input bg-slate-50 border-slate-200 focus:bg-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
                  <input required type="number" min="1" value={newComponent.quantity} onChange={e => setNewComponent({...newComponent, quantity: Number(e.target.value)})} className="glass-input bg-slate-50 border-slate-200 focus:bg-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Low Stock Alert At</label>
                  <input required type="number" min="0" value={newComponent.threshold} onChange={e => setNewComponent({...newComponent, threshold: Number(e.target.value)})} className="glass-input bg-slate-50 border-slate-200 focus:bg-white" />
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="glass-button-secondary flex-1 py-2">Cancel</button>
                <button type="submit" className="glass-button flex-1 py-2">Save Component</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Component Modal */}
      {showEditModal && editComponent && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="font-bold text-slate-800">Edit Component</h2>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            <form onSubmit={handleEditComponent} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input required type="text" value={editComponent.name} onChange={e => setEditComponent({...editComponent, name: e.target.value})} className="glass-input bg-slate-50 border-slate-200 focus:bg-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <input required type="text" value={editComponent.category} onChange={e => setEditComponent({...editComponent, category: e.target.value})} className="glass-input bg-slate-50 border-slate-200 focus:bg-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <input type="text" value={editComponent.description || ''} onChange={e => setEditComponent({...editComponent, description: e.target.value})} className="glass-input bg-slate-50 border-slate-200 focus:bg-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Total Quantity</label>
                  <input required type="number" min={inventory.find(i => i.id === editComponent.id)?.issuedQuantity || 0} value={editComponent.totalQuantity} onChange={e => setEditComponent({...editComponent, totalQuantity: Number(e.target.value)})} className="glass-input bg-slate-50 border-slate-200 focus:bg-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Low Stock Alert At</label>
                  <input required type="number" min="0" value={editComponent.lowStockThreshold} onChange={e => setEditComponent({...editComponent, lowStockThreshold: Number(e.target.value)})} className="glass-input bg-slate-50 border-slate-200 focus:bg-white" />
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowEditModal(false)} className="glass-button-secondary flex-1 py-2">Cancel</button>
                <button type="submit" className="glass-button flex-1 py-2">Update Component</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckoutModal && checkoutData.component && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="font-bold text-slate-800">Issue {checkoutData.component.name}</h2>
              <button onClick={() => setShowCheckoutModal(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            <form onSubmit={handleCheckout} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Student Reg Number</label>
                <input required type="text" placeholder="e.g. 21BCE0001" value={checkoutData.regNumber} onChange={e => setCheckoutData({...checkoutData, regNumber: e.target.value})} className="glass-input bg-slate-50 border-slate-200 focus:bg-white uppercase" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
                  <input required type="number" min="1" max={checkoutData.component.availableQuantity} value={checkoutData.quantity} onChange={e => setCheckoutData({...checkoutData, quantity: Number(e.target.value)})} className="glass-input bg-slate-50 border-slate-200 focus:bg-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Duration (Days)</label>
                  <input required type="number" min="1" value={checkoutData.days} onChange={e => setCheckoutData({...checkoutData, days: Number(e.target.value)})} className="glass-input bg-slate-50 border-slate-200 focus:bg-white" />
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowCheckoutModal(false)} className="glass-button-secondary flex-1 py-2">Cancel</button>
                <button type="submit" className="glass-button flex-1 py-2">Issue Component</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
