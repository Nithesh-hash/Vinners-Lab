import { useState, useEffect } from 'react';
import { 
  X, 
  Bell, 
  CheckCheck, 
  AlertTriangle, 
  QrCode, 
  Package, 
  Clock, 
  CheckCircle2, 
  Info
} from 'lucide-react';
import { collection, query, where, onSnapshot, doc, writeBatch, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import type { NotificationItem, Transaction } from '@/types';
import { getDueDateStatus } from '@/lib/projectCodeService';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationsModal({ isOpen, onClose }: NotificationsModalProps) {
  const { profile, user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeLoans, setActiveLoans] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !user) return;
    setLoading(true);

    const userReg = (profile?.regNumber || (profile as any)?.employeeId || '').trim().toUpperCase();

    // Query notifications directed to this user
    let notifQuery;
    if (profile?.role === 'admin') {
      notifQuery = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'));
    } else if (userReg) {
      notifQuery = query(
        collection(db, 'notifications'),
        where('targetRegNumber', '==', userReg)
      );
    } else {
      notifQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', user.uid)
      );
    }

    const unsubNotifs = onSnapshot(notifQuery, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as NotificationItem));
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setNotifications(data);
      setLoading(false);
    }, (err) => {
      console.warn("Notifications error:", err);
      setLoading(false);
    });

    // Also fetch active transactions to compute real-time nearing due dates
    const loansMap = new Map<string, Transaction>();
    const updateLoansState = () => {
      setActiveLoans(Array.from(loansMap.values()));
    };

    let unsubTx1 = () => {};
    let unsubTx2 = () => {};

    if (profile?.role === 'admin') {
      const q = query(collection(db, 'transactions'), where('status', '!=', 'Returned'));
      unsubTx1 = onSnapshot(q, (snap) => {
        snap.docs.forEach(d => loansMap.set(d.id, { id: d.id, ...d.data() } as Transaction));
        updateLoansState();
      });
    } else if (profile?.role === 'faculty' && userReg) {
      const q = query(collection(db, 'transactions'), where('facultyEmployeeId', '==', userReg));
      unsubTx1 = onSnapshot(q, (snap) => {
        snap.docs.forEach(d => loansMap.set(d.id, { id: d.id, ...d.data() } as Transaction));
        updateLoansState();
      });
    } else if (userReg) {
      const qPersonal = query(collection(db, 'transactions'), where('studentRegNumber', '==', userReg));
      unsubTx1 = onSnapshot(qPersonal, (snap) => {
        snap.docs.forEach(d => loansMap.set(d.id, { id: d.id, ...d.data() } as Transaction));
        updateLoansState();
      });

      const qTeam = query(collection(db, 'transactions'), where('teamStudentRegNumbers', 'array-contains', userReg));
      unsubTx2 = onSnapshot(qTeam, (snap) => {
        snap.docs.forEach(d => loansMap.set(d.id, { id: d.id, ...d.data() } as Transaction));
        updateLoansState();
      }, (e) => {
        console.warn("Notifications team tx query notice:", e);
      });
    }

    return () => {
      unsubNotifs();
      unsubTx1();
      unsubTx2();
    };
  }, [isOpen, user, profile]);

  const markAllAsRead = async () => {
    try {
      const batch = writeBatch(db);
      const unread = notifications.filter(n => !n.isRead);
      unread.forEach(n => {
        batch.update(doc(db, 'notifications', n.id), { isRead: true });
      });
      await batch.commit();
    } catch (e) {
      console.error(e);
    }
  };

  if (!isOpen) return null;

  // Filter urgent loans that are approaching due date (<= 7 days or overdue)
  const nearingDueLoans = activeLoans.filter(t => {
    if (t.status === 'Returned') return false;
    const st = getDueDateStatus(t.expectedReturnDate);
    return st.isNearing || st.isOverdue;
  });

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-sans">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[88dvh] flex flex-col overflow-hidden border border-slate-200/90 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Notifications & Alerts</h3>
              <p className="text-[11px] text-slate-500">Real-time due dates, team loans & code updates</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5">
            {notifications.some(n => !n.isRead) && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-slate-700 bg-slate-200/80 hover:bg-slate-300 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="w-3 h-3" />
                Mark all read
              </button>
            )}
            <button 
              onClick={onClose} 
              className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          
          {/* URGENT NEARING DUE DATES BANNER SECTION */}
          {nearingDueLoans.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Urgent Hardware Return Alerts ({nearingDueLoans.length})
              </span>
              <div className="space-y-2">
                {nearingDueLoans.map(t => {
                  const status = getDueDateStatus(t.expectedReturnDate);
                  return (
                    <div 
                      key={t.id}
                      className={`p-3 rounded-2xl border text-xs flex items-start gap-3 ${
                        status.isOverdue 
                          ? 'bg-rose-50 border-rose-200 text-rose-900' 
                          : 'bg-amber-50 border-amber-200 text-amber-900'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        status.isOverdue ? 'bg-rose-200 text-rose-800' : 'bg-amber-200 text-amber-800'
                      }`}>
                        <Clock className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-extrabold text-xs">{t.componentName}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            status.isOverdue ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'
                          }`}>
                            {status.isOverdue ? 'OVERDUE' : `Due in ${status.daysRemaining}d`}
                          </span>
                        </div>
                        <p className="text-[11px] mt-0.5 opacity-90">
                          {t.quantity} unit(s) • Collected by {t.studentName} ({t.studentRegNumber})
                        </p>
                        {t.projectCode && (
                          <p className="font-mono text-[10px] mt-1 font-semibold">
                            Project Code: {t.projectCode}
                          </p>
                        )}
                        <p className="text-[10px] font-semibold mt-1">
                          Expected Return Date: {status.formattedDate}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* HISTORICAL NOTIFICATIONS */}
          <div className="space-y-2 pt-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Notification Feed
            </span>

            {loading ? (
              <div className="py-8 flex justify-center">
                <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100">
                <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-500">No notifications yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">You will receive alerts here when codes or components are issued.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map(n => {
                  const getIcon = () => {
                    switch (n.type) {
                      case 'code_generated':
                        return <QrCode className="w-4 h-4 text-indigo-500" />;
                      case 'component_issued':
                        return <Package className="w-4 h-4 text-blue-500" />;
                      case 'due_date_warning':
                      case 'overdue_alert':
                        return <AlertTriangle className="w-4 h-4 text-rose-500" />;
                      default:
                        return <Info className="w-4 h-4 text-slate-500" />;
                    }
                  };

                  return (
                    <div 
                      key={n.id}
                      className={`p-3 rounded-2xl border transition-all text-xs flex items-start gap-3 ${
                        n.isRead 
                          ? 'bg-white border-slate-200/80 text-slate-700' 
                          : 'bg-slate-50 border-slate-300 text-slate-900 shadow-2xs'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs">
                        {getIcon()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-xs text-slate-900">{n.title}</p>
                          <span className="text-[10px] text-slate-400">
                            {n.createdAt ? new Date(n.createdAt.seconds * 1000).toLocaleDateString() : 'Today'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                          {n.message}
                        </p>
                        {n.projectCode && (
                          <span className="inline-block mt-1 font-mono text-[10px] font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                            {n.projectCode}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
