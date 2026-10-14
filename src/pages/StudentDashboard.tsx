import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Transaction, Component, ProjectCode } from '@/types';
import { 
  Search, 
  AlertCircle, 
  Package2, 
  CheckCircle2, 
  QrCode, 
  Users, 
  GraduationCap, 
  Bell, 
  AlertTriangle, 
  Copy, 
  Check 
} from 'lucide-react';
import ReturnQRModal from '@/components/ReturnQRModal';
import NotificationsModal from '@/components/NotificationsModal';
import { getDueDateStatus, checkAndAutoSendDueDateNotifications, getNextStudentCode, getAcademicYear } from '@/lib/projectCodeService';

export default function StudentDashboard() {
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';
  
  const { profile, user } = useAuth();
  const [dbTransactions, setDbTransactions] = useState<Transaction[]>([]);
  const [projectCodes, setProjectCodes] = useState<ProjectCode[]>([]);
  const [inventory, setInventory] = useState<Component[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [selectedTxForQR, setSelectedTxForQR] = useState<Transaction | null>(null);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  const isFaculty = profile?.role === 'faculty';
  const userReg = (profile?.regNumber || (profile as any)?.employeeId || '').trim().toUpperCase();

  // Consolidated & synthesized transactions from both Firestore transaction listeners and projectCodes.issuedItems
  // This guarantees that any component issued under a team's code immediately reflects across ALL team members and faculty
  const transactions = useMemo(() => {
    const txMap = new Map<string, Transaction>();

    // 1. Add all direct transactions from database listeners
    dbTransactions.forEach(t => {
      txMap.set(t.id, t);
    });

    // 2. Synthesize/merge from projectCodes.issuedItems for immediate real-time reflection
    projectCodes.forEach(pc => {
      (pc.issuedItems || []).forEach(item => {
        const existing = txMap.get(item.transactionId);
        if (!existing) {
          txMap.set(item.transactionId, {
            id: item.transactionId,
            componentId: item.componentId,
            componentName: item.componentName,
            studentId: '',
            studentName: item.collectedByStudentName,
            studentRegNumber: item.collectedByStudentRegNumber,
            quantity: item.quantity,
            returnedQuantity: item.returnedQuantity || 0,
            expectedReturnDate: item.expectedReturnDate,
            issueDate: item.issueDate,
            status: item.status,
            issuedByAdminId: pc.createdByAdminId || 'admin',
            issuedByAdminName: pc.createdByName || 'Administrator',
            projectCode: pc.code,
            facultyEmployeeId: pc.facultyEmployeeId || pc.faculty?.employeeId,
            facultyName: pc.faculty?.name,
            facultyMobile: pc.faculty?.mobileNumber,
            teamStudentRegNumbers: pc.studentRegNumbers || pc.students?.map(s => s.regNumber),
            teamStudents: pc.students,
            collectedByStudentName: item.collectedByStudentName,
            collectedByStudentRegNumber: item.collectedByStudentRegNumber
          });
        } else {
          // Augment team / project code context if not present
          if (!existing.projectCode) existing.projectCode = pc.code;
          if (!existing.collectedByStudentName) existing.collectedByStudentName = item.collectedByStudentName;
          if (!existing.collectedByStudentRegNumber) existing.collectedByStudentRegNumber = item.collectedByStudentRegNumber;
          if (!existing.facultyName) existing.facultyName = pc.faculty?.name;
          if (!existing.teamStudents) existing.teamStudents = pc.students;
        }
      });
    });

    const list = Array.from(txMap.values());
    list.sort((a, b) => (b.issueDate?.seconds || 0) - (a.issueDate?.seconds || 0));
    return list;
  }, [dbTransactions, projectCodes]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    // Dynamic unsubscriptions for per-code transaction listeners
    let codeTxUnsubs: Array<() => void> = [];

    // Local transaction map for Firestore transaction listeners
    const txMap = new Map<string, Transaction>();

    const updateTxState = () => {
      const allTx = Array.from(txMap.values());
      allTx.sort((a, b) => (b.issueDate?.seconds || 0) - (a.issueDate?.seconds || 0));
      setDbTransactions(allTx);
      setLoading(false);
      checkAndAutoSendDueDateNotifications();
    };

    // 1. Fetch Project Codes
    let codeQuery;
    if (isFaculty) {
      codeQuery = query(collection(db, 'project_codes'), where('facultyEmployeeId', '==', userReg));
    } else {
      codeQuery = query(collection(db, 'project_codes'), where('studentRegNumbers', 'array-contains', userReg));
    }

    const unsubCodes = onSnapshot(codeQuery, (snap) => {
      const codeList = snap.docs.map(d => ({ id: d.id, ...d.data() } as ProjectCode));
      codeList.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setProjectCodes(codeList);
      setLoading(false);

      // Clean up previous per-code listeners
      codeTxUnsubs.forEach(u => u());
      codeTxUnsubs = [];

      // Set up real-time listener for every project code's transactions
      codeList.forEach(pc => {
        if (!pc.code) return;
        const qCodeTx = query(collection(db, 'transactions'), where('projectCode', '==', pc.code));
        const u = onSnapshot(qCodeTx, (txSnap) => {
          txSnap.docs.forEach(d => {
            txMap.set(d.id, { id: d.id, ...d.data() } as Transaction);
          });
          updateTxState();
        }, (err) => {
          console.warn(`Transactions listener note for code ${pc.code}:`, err);
        });
        codeTxUnsubs.push(u);
      });
    }, (err) => {
      console.warn("Error fetching project codes:", err);
      setErrorMsg(err.message);
      setLoading(false);
    });

    let unsubPersonalTx = () => {};
    let unsubTeamTx = () => {};
    let unsubFacultyTx = () => {};

    if (isFaculty) {
      if (userReg) {
        const qFaculty = query(collection(db, 'transactions'), where('facultyEmployeeId', '==', userReg));
        unsubFacultyTx = onSnapshot(qFaculty, (snap) => {
          snap.docs.forEach(d => txMap.set(d.id, { id: d.id, ...d.data() } as Transaction));
          updateTxState();
        }, (err) => {
          console.warn("Error fetching faculty transactions:", err);
          updateTxState();
        });
      }
    } else {
      if (userReg) {
        // Query personal checkouts
        const qPersonal = query(collection(db, 'transactions'), where('studentRegNumber', '==', userReg));
        unsubPersonalTx = onSnapshot(qPersonal, (snap) => {
          snap.docs.forEach(d => txMap.set(d.id, { id: d.id, ...d.data() } as Transaction));
          updateTxState();
        });

        // Query team checkouts
        const qTeam = query(collection(db, 'transactions'), where('teamStudentRegNumbers', 'array-contains', userReg));
        unsubTeamTx = onSnapshot(qTeam, (snap) => {
          snap.docs.forEach(d => txMap.set(d.id, { id: d.id, ...d.data() } as Transaction));
          updateTxState();
        }, (err) => {
          console.warn("Team transactions query note:", err);
          updateTxState();
        });
      }
    }

    // 3. Fetch Lab Inventory
    const invQuery = query(collection(db, 'inventory'), where('isArchived', '==', false));
    const unsubInv = onSnapshot(invQuery, (snapshot) => {
      const invData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Component));
      setInventory(invData);
    });

    // 4. Fetch Unread Notifications Count
    let unsubNotifs = () => {};
    if (userReg) {
      const notifQuery = query(
        collection(db, 'notifications'),
        where('targetRegNumber', '==', userReg),
        where('isRead', '==', false)
      );
      unsubNotifs = onSnapshot(notifQuery, (snap) => {
        setUnreadNotifCount(snap.size);
      });
    }

    return () => {
      unsubCodes();
      codeTxUnsubs.forEach(u => u());
      unsubPersonalTx();
      unsubTeamTx();
      unsubFacultyTx();
      unsubInv();
      unsubNotifs();
    };
  }, [user, profile, userReg, isFaculty]);

  // Auto-generate unique student code for existing students if not yet assigned
  useEffect(() => {
    if (user && profile && profile.role === 'student' && !profile.studentCode) {
      getNextStudentCode().then(async (newCode) => {
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            studentCode: newCode,
            academicYear: getAcademicYear()
          });
        } catch (e) {
          console.warn("Could not auto-backfill student code:", e);
        }
      });
    }
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

  // Urgent nearing due date alerts (<= 7 days or overdue)
  const urgentAlerts = activeTransactions.filter(t => {
    const st = getDueDateStatus(t.expectedReturnDate);
    return st.isNearing || st.isOverdue;
  });

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(code);
    setTimeout(() => setCopiedCodeId(null), 2000);
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
    <div className="space-y-6 animate-in fade-in duration-500 font-sans">
      
      {/* TOP HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            {profile?.regNumber && (
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">
                {profile.regNumber} • {isFaculty ? 'Faculty Advisor' : 'Student'}
              </span>
            )}
            {!isFaculty && profile?.studentCode && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/90 text-emerald-800 text-xs font-bold font-mono shadow-2xs">
                <span>Unique Student Code:</span>
                <span className="text-emerald-950 font-black tracking-wide">{profile.studentCode}</span>
                <button
                  type="button"
                  onClick={() => handleCopyCode(profile.studentCode!)}
                  className="hover:text-emerald-950 transition-colors cursor-pointer p-0.5"
                  title="Copy Unique Code"
                >
                  {copiedCodeId === profile.studentCode ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Welcome back, {profile?.name || (isFaculty ? 'Faculty' : 'Student')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {isFaculty 
              ? 'Supervising student team projects, hardware allocations & return statuses.' 
              : activeTab === 'history' 
              ? 'Your hardware checkout history.' 
              : 'Track your personal and team hardware checkouts & return deadlines.'}
          </p>
        </div>

        {/* Notifications Bell button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNotificationsModal(true)}
            className="px-4 py-2.5 rounded-full border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold shadow-2xs transition-all flex items-center gap-2 cursor-pointer relative"
          >
            <Bell className="w-4 h-4 text-slate-700" />
            <span>Alerts</span>
            {unreadNotifCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-[10px] font-extrabold flex items-center justify-center animate-pulse">
                {unreadNotifCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* URGENT NEARING DUE DATES BANNER */}
      {urgentAlerts.length > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 sm:p-5 shadow-xs space-y-3 animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2 text-rose-800 font-bold text-xs uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Hardware Return Alert ({urgentAlerts.length} item{urgentAlerts.length > 1 ? 's' : ''} require attention)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {urgentAlerts.map(t => {
              const dueStatus = getDueDateStatus(t.expectedReturnDate);
              const isCollector = (t.studentRegNumber || t.collectedByStudentRegNumber || '').trim().toUpperCase() === userReg;
              const collectorName = t.collectedByStudentName || t.studentName || 'Student';
              const collectorReg = t.collectedByStudentRegNumber || t.studentRegNumber || '';
              return (
                <div key={t.id} className="p-3 bg-white rounded-xl border border-rose-200/80 shadow-2xs text-xs flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-slate-900 text-sm">{t.componentName}</strong>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                        x{t.quantity - (t.returnedQuantity || 0)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {isFaculty 
                        ? `Issued to student: ${collectorName} (${collectorReg})` 
                        : isCollector 
                        ? 'Collected by You' 
                        : `Collected by teammate: ${collectorName} (${collectorReg})`}
                    </p>
                    {t.projectCode && (
                      <p className="font-mono text-[10px] font-bold text-slate-700 mt-1">
                        Code: {t.projectCode}
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      dueStatus.isOverdue ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'
                    }`}>
                      {dueStatus.isOverdue ? 'OVERDUE' : `Due in ${dueStatus.daysRemaining}d`}
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Return: {dueStatus.formattedDate}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
              <p className="text-xs text-slate-500 mt-1">Total components under team possession</p>
            </div>
            
            <div className="glass-card p-4 sm:p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h3 className="font-medium text-slate-700 text-sm">Active Checkouts</h3>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900">{activeTransactions.length}</p>
              <p className="text-xs text-slate-500 mt-1">Personal & team loan records</p>
            </div>

            <div className="glass-card p-4 sm:p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <h3 className="font-medium text-slate-700 text-sm">Overdue / Nearing Items</h3>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-amber-600">
                {urgentAlerts.length}
              </p>
              <p className="text-xs text-slate-500 mt-1">Requires prompt return to lab</p>
            </div>
          </div>

          {/* PROJECT CODES CARD (Supervised Team Codes) */}
          {projectCodes.length > 0 && (
            <div className="glass-card overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-200/60 bg-white/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">
                      {isFaculty ? 'Guided Project Authorization Codes' : 'My Project Team Codes'} ({projectCodes.length})
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Authorized by Lab Admin • Components issued under these codes reflect for all team members
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                {projectCodes.map((pc) => (
                  <div key={pc.id} className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3.5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-base font-extrabold text-slate-900 tracking-wider">
                            {pc.code}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono">
                            {pc.codeType || (pc.code.startsWith('FSV') ? 'FSV' : 'SSV')}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">AY {pc.academicYear}</p>
                      </div>

                      <button
                        onClick={() => handleCopyCode(pc.code)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Copy Code"
                      >
                        {copiedCodeId === pc.code ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedCodeId === pc.code ? 'Copied' : 'Copy'}
                      </button>
                    </div>

                    {/* Faculty Guide Info */}
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-indigo-600" />
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Faculty Guide</span>
                          <span className="font-bold text-slate-900">{pc.faculty.name}</span>
                        </div>
                      </div>
                      <div className="text-right text-[10px] font-mono text-slate-500">
                        <p>{pc.faculty.employeeId}</p>
                        <p>📞 {pc.faculty.mobileNumber}</p>
                      </div>
                    </div>

                    {/* Students Team List */}
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Team Students ({pc.students.length})
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {pc.students.map((s, sIdx) => {
                          const isCurrentUser = s.regNumber.toUpperCase() === userReg;
                          return (
                            <div 
                              key={sIdx} 
                              className={`p-2 rounded-lg border text-[11px] ${
                                isCurrentUser 
                                  ? 'bg-indigo-50/70 border-indigo-200 text-indigo-950 font-bold' 
                                  : 'bg-slate-50 border-slate-100 text-slate-700'
                              }`}
                            >
                              <p className="leading-tight truncate">
                                {s.name} {isCurrentUser && '(You)'}
                              </p>
                              <p className="font-mono text-[10px] opacity-75">{s.regNumber}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Issued Hardware summary under code */}
                    {pc.issuedItems && pc.issuedItems.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 text-xs">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Hardware Loans Under Code ({pc.issuedItems.length})
                        </span>
                        <div className="space-y-1">
                          {pc.issuedItems.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-[11px] bg-slate-50 p-1.5 rounded-md">
                              <span className="font-medium text-slate-800">
                                {item.componentName} (x{item.quantity})
                              </span>
                              <span className="text-[10px] text-slate-500">
                                by {item.collectedByStudentName}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ACTIVE TRANSACTIONS & MY LOANS */}
          <div className="glass-card overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200/60 bg-white/40 flex justify-between items-center">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-800">
                  {isFaculty ? 'All Hardware Checkouts Supervised' : 'Issued Components (Personal & Team Loans)'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Click "Show Return QR" to generate instant verification for the Lab Admin
                </p>
              </div>
            </div>

            <div className="p-0">
              {activeTransactions.length === 0 ? (
                <div className="p-8 text-center text-slate-500 flex flex-col items-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-3" />
                  <p>No active hardware returns pending.</p>
                  <p className="text-xs text-slate-300 mt-4">Vinner Lab Sync Active</p>
                </div>
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-50/50 text-slate-600">
                        <tr>
                          <th className="px-6 py-3 font-medium">Component</th>
                          <th className="px-6 py-3 font-medium">Custody / Collector</th>
                          <th className="px-6 py-3 font-medium">Qty</th>
                          <th className="px-6 py-3 font-medium">Issue Date</th>
                          <th className="px-6 py-3 font-medium">Expected Return</th>
                          <th className="px-6 py-3 font-medium">Status</th>
                          <th className="px-6 py-3 font-medium text-right">Return Pass</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activeTransactions.map((tx) => {
                          const dueStatus = getDueDateStatus(tx.expectedReturnDate);
                          const outstanding = tx.quantity - (tx.returnedQuantity || 0);
                          const isPartiallyReturned = (tx.returnedQuantity || 0) > 0 && outstanding > 0;
                          const isCollector = (tx.studentRegNumber || tx.collectedByStudentRegNumber || '').trim().toUpperCase() === userReg;
                          const collectorName = tx.collectedByStudentName || tx.studentName || 'Student';
                          const collectorReg = tx.collectedByStudentRegNumber || tx.studentRegNumber || '';

                          return (
                            <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4">
                                <p className="font-bold text-slate-900">{tx.componentName}</p>
                                {tx.projectCode ? (
                                  <span className="font-mono text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-md inline-flex items-center gap-1 mt-1">
                                    <span>Code:</span>
                                    <strong>{tx.projectCode}</strong>
                                  </span>
                                ) : (
                                  <span className="font-mono text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md inline-flex items-center gap-1 mt-1">
                                    Direct Student Issue
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                {isFaculty ? (
                                  <div>
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                      Student: {collectorName}
                                    </span>
                                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">Reg: {collectorReg}</p>
                                  </div>
                                ) : isCollector ? (
                                  <div>
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                      You (In Your Custody)
                                    </span>
                                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{collectorReg || userReg}</p>
                                  </div>
                                ) : (
                                  <div>
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                      Teammate: {collectorName}
                                    </span>
                                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">Reg: {collectorReg}</p>
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4 font-extrabold text-slate-900">
                                {outstanding} of {tx.quantity}
                                {isPartiallyReturned && (
                                  <span className="text-[10px] text-slate-400 font-normal ml-1">({tx.returnedQuantity} ret)</span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-slate-600">{formatDate(tx.issueDate)}</td>
                              <td className="px-6 py-4">
                                <p className={`font-semibold ${dueStatus.isOverdue ? 'text-red-600' : 'text-slate-700'}`}>
                                  {dueStatus.formattedDate}
                                </p>
                                <span className={`text-[10px] font-bold ${
                                  dueStatus.isOverdue 
                                    ? 'text-red-600' 
                                    : dueStatus.isNearing 
                                    ? 'text-amber-600' 
                                    : 'text-slate-400'
                                }`}>
                                  {dueStatus.isOverdue ? 'Overdue' : `${dueStatus.daysRemaining} days left`}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                  dueStatus.isOverdue ? 'bg-red-100 text-red-800 border border-red-200' : 
                                  isPartiallyReturned ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                                  'bg-amber-100 text-amber-800 border border-amber-200'
                                }`}>
                                  {dueStatus.isOverdue ? 'Overdue' : isPartiallyReturned ? 'Partially Returned' : 'Checked Out'}
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
                      const dueStatus = getDueDateStatus(tx.expectedReturnDate);
                      const outstanding = tx.quantity - (tx.returnedQuantity || 0);
                      const isPartiallyReturned = (tx.returnedQuantity || 0) > 0 && outstanding > 0;
                      const isCollector = (tx.studentRegNumber || tx.collectedByStudentRegNumber || '').trim().toUpperCase() === userReg;
                      const collectorName = tx.collectedByStudentName || tx.studentName || 'Student';
                      const collectorReg = tx.collectedByStudentRegNumber || tx.studentRegNumber || '';

                      return (
                        <div key={tx.id} className="p-3.5 sm:p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">{tx.componentName}</h3>
                              {tx.projectCode ? (
                                <span className="font-mono text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-1.5 py-0.5 rounded mt-1 inline-block">
                                  Code: {tx.projectCode}
                                </span>
                              ) : (
                                <span className="font-mono text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.5 rounded mt-1 inline-block">
                                  Direct Student Issue
                                </span>
                              )}
                            </div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                              dueStatus.isOverdue ? 'bg-red-100 text-red-800 border border-red-200' : 
                              isPartiallyReturned ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                              'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}>
                              {dueStatus.isOverdue ? 'Overdue' : 'Checked Out'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                            <div>
                              <span className="text-[10px] text-slate-400 uppercase font-semibold">Held By</span>
                              <p className="font-bold text-slate-900">
                                {isFaculty ? `Student: ${collectorName}` : isCollector ? 'You (In Your Custody)' : `Teammate: ${collectorName}`}
                              </p>
                              <p className="text-[10px] font-mono text-slate-500">Reg: {collectorReg}</p>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 uppercase font-semibold">Expected Return</span>
                              <p className={`font-semibold ${dueStatus.isOverdue ? 'text-red-600' : 'text-slate-700'}`}>
                                {dueStatus.formattedDate}
                              </p>
                              <span className="text-[10px] text-slate-400">
                                {dueStatus.isOverdue ? 'Past Due' : `${dueStatus.daysRemaining}d left`}
                              </span>
                            </div>
                            <div className="col-span-2 text-[11px] text-slate-500 pt-1 border-t border-slate-100 flex justify-between">
                              <span>Issued: {formatDate(tx.issueDate)}</span>
                              <span>Units: <strong>{outstanding} of {tx.quantity}</strong></span>
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

          {/* Available Inventory Explorer */}
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

      {/* HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200/60 bg-white/40">
            <h2 className="text-base sm:text-lg font-bold text-slate-800">Past Hardware Returns</h2>
          </div>
          <div className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50/50 text-slate-600">
                  <tr>
                    <th className="px-6 py-3 font-medium">Component</th>
                    <th className="px-6 py-3 font-medium">Collector</th>
                    <th className="px-6 py-3 font-medium">Qty</th>
                    <th className="px-6 py-3 font-medium">Issued Date</th>
                    <th className="px-6 py-3 font-medium">Returned Date</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.filter(t => t.status === 'Returned').length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">No returned items yet.</td></tr>
                  ) : transactions.filter(t => t.status === 'Returned').map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors opacity-75">
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {tx.componentName}
                        {tx.projectCode && <span className="ml-2 font-mono text-[10px] text-slate-400">{tx.projectCode}</span>}
                      </td>
                      <td className="px-6 py-4 text-slate-600">{tx.studentName}</td>
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

      {/* Return QR Modal */}
      <ReturnQRModal
        transaction={selectedTxForQR}
        onClose={() => setSelectedTxForQR(null)}
      />

      {/* Notifications Modal */}
      <NotificationsModal
        isOpen={showNotificationsModal}
        onClose={() => setShowNotificationsModal(false)}
      />

    </div>
  );
}
