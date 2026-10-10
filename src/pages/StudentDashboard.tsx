import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Transaction, Component } from '@/types';
import { Search, AlertCircle, Package2, CheckCircle2 } from 'lucide-react';

export default function StudentDashboard() {
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';
  
  const { profile, user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [inventory, setInventory] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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

  const activeTransactions = transactions.filter(t => t.status !== 'Returned');
  const totalCheckedOut = activeTransactions.reduce((acc, curr) => acc + curr.quantity, 0);

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
    return <div className="flex justify-center items-center h-64"><div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (errorMsg) {
    return <div className="p-8 text-center text-red-600 bg-red-50 rounded-xl m-6 border border-red-200">Error: {errorMsg}</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome, {profile?.name}</h1>
        <p className="text-slate-500">{activeTab === 'history' ? 'Your hardware checkout history.' : 'Here\'s your hardware checkout summary.'}</p>
      </div>

      {activeTab === 'overview' && (
        <>
          {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-brand-100 text-brand-600 rounded-lg">
              <Package2 className="w-5 h-5" />
            </div>
            <h3 className="font-medium text-slate-700">Currently Issued</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900">{totalCheckedOut}</p>
          <p className="text-sm text-slate-500 mt-1">Total components in possession</p>
        </div>
        
        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="font-medium text-slate-700">Active Checkouts</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900">{activeTransactions.length}</p>
          <p className="text-sm text-slate-500 mt-1">Ongoing transaction records</p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
              <AlertCircle className="w-5 h-5" />
            </div>
            <h3 className="font-medium text-slate-700">Overdue Items</h3>
          </div>
          <p className="text-3xl font-bold text-amber-600">
            {activeTransactions.filter(t => t.status === 'Overdue' || isOverdue(t.expectedReturnDate)).length}
          </p>
          <p className="text-sm text-slate-500 mt-1">Requires immediate return</p>
        </div>
      </div>

      {/* Active Transactions */}
      <div className="glass-card overflow-hidden">
        <div className="p-5 border-b border-slate-200/60 bg-white/40 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-800">Your Issued Components</h2>
        </div>
        <div className="p-0">
          {activeTransactions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 flex flex-col items-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-3" />
              <p>You have no pending hardware returns. Great job!</p>
              <p className="text-xs text-slate-300 mt-4">Vinner Lab v2.1 Sync</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50/50 text-slate-600">
                  <tr>
                    <th className="px-6 py-3 font-medium">Component</th>
                    <th className="px-6 py-3 font-medium">Qty</th>
                    <th className="px-6 py-3 font-medium">Issued Date</th>
                    <th className="px-6 py-3 font-medium">Expected Return</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeTransactions.map((tx) => {
                    const overdue = tx.status === 'Overdue' || isOverdue(tx.expectedReturnDate);
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-900">{tx.componentName}</td>
                        <td className="px-6 py-4 text-slate-600">{tx.quantity}</td>
                        <td className="px-6 py-4 text-slate-600">{formatDate(tx.issueDate)}</td>
                        <td className={`px-6 py-4 font-medium ${overdue ? 'text-red-600' : 'text-slate-600'}`}>
                          {formatDate(tx.expectedReturnDate)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            overdue ? 'bg-red-100 text-red-800 border border-red-200' : 
                            'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            {overdue ? 'Overdue' : 'Checked Out'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

            )}
          </div>
        </div>
        </>
      )}

      {/* History Tab Content */}
      {activeTab === 'history' && (
        <div className="glass-card overflow-hidden">
          <div className="p-5 border-b border-slate-200/60 bg-white/40">
            <h2 className="text-lg font-bold text-slate-800">Past Hardware Returns</h2>
          </div>
          <div className="p-0">
            <div className="overflow-x-auto">
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
          </div>
        </div>
      )}
    </div>
  );
}
