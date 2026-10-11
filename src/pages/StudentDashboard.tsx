import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Transaction, Component } from '@/types';
import { Search, AlertCircle, Package2, CheckCircle2, QrCode } from 'lucide-react';
import ReturnQRModal from '@/components/ReturnQRModal';

export default function StudentDashboard() {
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';
  
  const { profile, user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [inventory, setInventory] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTxForQR, setSelectedTxForQR] = useState<Transaction | null>(null);

  useEffect(() => {
    if (!user || !profile?.regNumber) return;
    
    setLoading(true);

    const txQuery = query(collection(db, 'transactions'), where('studentRegNumber', '==', profile.regNumber));
    const unsubscribeTx = onSnapshot(txQuery, (snapshot) => {
      const txData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      txData.sort((a, b) => (b.issueDate?.seconds || 0) - (a.issueDate?.seconds || 0));
      setTransactions(txData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching transactions:", error);
      setErrorMsg(error.message);
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
  }, [user, profile]);

  const activeTransactions = transactions.filter(t => {
    const outstanding = t.quantity - (t.returnedQuantity || 0);
    return t.status !== 'Returned' && outstanding > 0;
  });

  const totalCheckedOut = activeTransactions.reduce((acc, curr) => {
    return acc + (curr.quantity - (curr.returnedQuantity || 0));
  }, 0);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const isOverdue = (date: any) => {
    if (!date) return false;
    const returnDate = date.toDate ? date.toDate() : new Date(date.seconds * 1000);
    return new Date() > returnDate;
  };

  const filteredInventory = inventory.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="p-8 text-center text-red-600 bg-red-50 rounded-xl m-6 border border-red-200">
        Error: {errorMsg}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        {profile?.regNumber && (
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            {profile.regNumber}
          </p>
        )}
        <h1 className="text-2xl font-bold text-slate-900">Welcome back, {profile?.name || 'Student'}</h1>
        <p className="text-slate-500 mt-1">{activeTab === 'history' ? 'Your hardware checkout history.' : 'Here\'s your hardware checkout summary.'}</p>
      </div>

      {activeTab === 'overview' && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="glass-card p-4 sm:p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-brand-100 text-brand-600 rounded-lg">
                  <Package2 className="w-5 h-5" />
                </div>
                <h3 className="font-medium text-slate-700 text-sm">Currently Issued</h3>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900">{totalCheckedOut}</p>
              <p className="text-xs text-slate-500 mt-1">Total components in possession</p>
            </div>
            
            <div className="glass-card p-4 sm:p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h3 className="font-medium text-slate-700 text-sm">Active Checkouts</h3>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900">{activeTransactions.length}</p>
              <p className="text-xs text-slate-500 mt-1">Ongoing transaction records</p>
            </div>

            <div className="glass-card p-4 sm:p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <h3 className="font-medium text-slate-700 text-sm">Overdue Items</h3>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-amber-600">
                {activeTransactions.filter(t => t.status === 'Overdue' || isOverdue(t.expectedReturnDate)).length}
              </p>
              <p className="text-xs text-slate-500 mt-1">Requires immediate return</p>
            </div>
          </div>

          {/* Active Transactions & My Loans */}
          <div className="glass-card overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200/60 bg-white/40 flex justify-between items-center">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-800">Your Issued Components (My Loans)</h2>
                <p className="text-xs text-slate-500 mt-0.5">Click "Show Return QR" to generate instant verification for the Lab Admin</p>
              </div>
            </div>
            <div className="p-0">
              {activeTransactions.length === 0 ? (
                <div className="p-8 text-center text-slate-500 flex flex-col items-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-3" />
                  <p>You have no pending hardware returns. Great job!</p>
                  <p className="text-xs text-slate-300 mt-4">Vinner Lab v2.1 Sync</p>
                </div>
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-50/50 text-slate-600">
                        <tr>
                          <th className="px-6 py-3 font-medium">Component</th>
                          <th className="px-6 py-3 font-medium">Originally Issued</th>
                          <th className="px-6 py-3 font-medium">Still Outstanding</th>
                          <th className="px-6 py-3 font-medium">Issue Date</th>
                          <th className="px-6 py-3 font-medium">Expected Return</th>
                          <th className="px-6 py-3 font-medium">Status</th>
                          <th className="px-6 py-3 font-medium text-right">Return Pass</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activeTransactions.map((tx) => {
                          const overdue = tx.status === 'Overdue' || isOverdue(tx.expectedReturnDate);
                          const outstanding = tx.quantity - (tx.returnedQuantity || 0);
                          const isPartiallyReturned = (tx.returnedQuantity || 0) > 0 && outstanding > 0;
                          return (
                            <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4 font-bold text-slate-900">{tx.componentName}</td>
                              <td className="px-6 py-4 text-slate-600">{tx.quantity}</td>
                              <td className="px-6 py-4 font-extrabold text-slate-900">
                                {outstanding}
                                {isPartiallyReturned && (
                                  <span className="text-[10px] text-slate-400 font-normal ml-1">({tx.returnedQuantity} returned)</span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-slate-600">{formatDate(tx.issueDate)}</td>
                              <td className={`px-6 py-4 font-medium ${overdue ? 'text-red-600 font-bold' : 'text-slate-600'}`}>
                                {formatDate(tx.expectedReturnDate)}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                  overdue ? 'bg-red-100 text-red-800 border border-red-200' : 
                                  isPartiallyReturned ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                                  'bg-amber-100 text-amber-800 border border-amber-200'
                                }`}>
                                  {overdue ? 'Overdue' : isPartiallyReturned ? 'Partially Returned' : 'Checked Out'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button
                                  onClick={() => setSelectedTxForQR(tx)}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                                >
                                  <QrCode className="w-3.5 h-3.5" />
                                  Show Return QR
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="md:hidden divide-y divide-slate-100">
                    {activeTransactions.map((tx) => {
                      const overdue = tx.status === 'Overdue' || isOverdue(tx.expectedReturnDate);
                      const outstanding = tx.quantity - (tx.returnedQuantity || 0);
                      const isPartiallyReturned = (tx.returnedQuantity || 0) > 0 && outstanding > 0;
                      return (
                        <div key={tx.id} className="p-3.5 sm:p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base break-words">{tx.componentName}</h3>
                            </div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                              overdue ? 'bg-red-100 text-red-800 border border-red-200' : 
                              isPartiallyReturned ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                              'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}>
                              {overdue ? 'Overdue' : isPartiallyReturned ? 'Partially Returned' : 'Checked Out'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                            <div>
                              <span className="text-[10px] text-slate-400 uppercase font-semibold">Issued / Outstanding</span>
                              <p className="font-extrabold text-slate-900 text-sm">{outstanding} of {tx.quantity}</p>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 uppercase font-semibold">Expected Return</span>
                              <p className={`font-semibold ${overdue ? 'text-red-600' : 'text-slate-700'}`}>
                                {formatDate(tx.expectedReturnDate)}
                              </p>
                            </div>
                            <div className="col-span-2 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                              Issued Date: {formatDate(tx.issueDate)}
                            </div>
                          </div>

                          <button
                            onClick={() => setSelectedTxForQR(tx)}
                            className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                          >
                            <QrCode className="w-4 h-4" />
                            Show Return QR
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Available Inventory */}
          <div className="glass-card overflow-hidden mt-8">
            <div className="p-5 border-b border-slate-200/60 bg-white/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-slate-800">Lab Inventory Explorer</h2>
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search components..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="glass-input pl-9 text-sm py-1.5"
                />
              </div>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredInventory.length === 0 ? (
                <div className="col-span-full py-8 text-center text-slate-500">
                  No components found matching your search.
                </div>
              ) : (
                filteredInventory.map(item => (
                  <div key={item.id} className="border border-slate-200/60 rounded-xl p-4 bg-white/40 hover:bg-white/60 transition-colors flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-slate-800 line-clamp-1">{item.name}</h3>
                      <span className={`text-xs font-medium px-2 py-1 rounded-md border ${
                        item.availableQuantity > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {item.availableQuantity > 0 ? 'In Stock' : 'Out of Stock'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mb-4 flex-1 line-clamp-2">{item.description || item.category}</p>
                    <div className="mt-auto flex items-center justify-between text-sm bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                      <span className="text-slate-600">Available</span>
                      <span className="font-bold text-slate-900">{item.availableQuantity} <span className="text-slate-400 font-normal">/ {item.totalQuantity}</span></span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* History Tab Content */}
      {activeTab === 'history' && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200/60 bg-white/40">
            <h2 className="text-base sm:text-lg font-bold text-slate-800">Past Hardware Returns</h2>
          </div>
          <div className="p-0">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50/50 text-slate-600">
                  <tr>
                    <th className="px-6 py-3 font-medium">Component</th>
                    <th className="px-6 py-3 font-medium">Qty</th>
                    <th className="px-6 py-3 font-medium">Issued Date</th>
                    <th className="px-6 py-3 font-medium">Returned Date</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.filter(t => t.status === 'Returned').length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No returned items yet.</td></tr>
                  ) : transactions.filter(t => t.status === 'Returned').map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors opacity-75">
                      <td className="px-6 py-4 font-medium text-slate-900">{tx.componentName}</td>
                      <td className="px-6 py-4 text-slate-600">{tx.quantity}</td>
                      <td className="px-6 py-4 text-slate-600">{formatDate(tx.issueDate)}</td>
                      <td className="px-6 py-4 text-slate-600">{formatDate(tx.returnDate)}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Returned
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-slate-100">
              {transactions.filter(t => t.status === 'Returned').length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs">No returned items yet.</div>
              ) : (
                transactions.filter(t => t.status === 'Returned').map((tx) => (
                  <div key={tx.id} className="p-3.5 sm:p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-slate-900 text-sm break-words">{tx.componentName}</h3>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                        Returned
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Units Returned</span>
                        <span className="font-bold text-slate-800">{tx.quantity}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Returned Date</span>
                        <span className="font-medium text-slate-700">{formatDate(tx.returnDate)}</span>
                      </div>
                      <div className="col-span-2 text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                        Issued on {formatDate(tx.issueDate)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Return QR Modal */}
      <ReturnQRModal
        transaction={selectedTxForQR}
        onClose={() => setSelectedTxForQR(null)}
      />
    </div>
  );
}
