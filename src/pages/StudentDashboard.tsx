import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Transaction, Component, ProjectCode, ProjectFaculty, IssueRequest } from '@/types';
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
  Check,
  Cpu,
  Radio,
  Layers,
  Boxes,
  Package,
  Plus,
  Trash2,
  ArrowRight,
  Clock,
  X,
  History,
  FileText
} from 'lucide-react';
import ReturnQRModal from '@/components/ReturnQRModal';
import RequestQRModal from '@/components/RequestQRModal';
import IssueInvoiceModal from '@/components/IssueInvoiceModal';
import NotificationsModal from '@/components/NotificationsModal';
import { getDueDateStatus, checkAndAutoSendDueDateNotifications, getNextStudentCode, getAcademicYear } from '@/lib/projectCodeService';
import { submitIssueRequest } from '@/lib/issueRequestService';

export default function StudentDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';
  
  const setActiveTab = (tab: string) => {
    if (tab === 'overview') {
      setSearchParams({});
    } else {
      setSearchParams({ tab });
    }
  };
  
  const { profile, user } = useAuth();
  const [dbTransactions, setDbTransactions] = useState<Transaction[]>([]);
  const [projectCodes, setProjectCodes] = useState<ProjectCode[]>([]);
  const [inventory, setInventory] = useState<Component[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  
  // Modals
  const [selectedTxForQR, setSelectedTxForQR] = useState<Transaction | null>(null);
  const [selectedReqForQR, setSelectedReqForQR] = useState<IssueRequest | null>(null);
  const [selectedReqForDetails, setSelectedReqForDetails] = useState<IssueRequest | null>(null);
  const [selectedReqForInvoice, setSelectedReqForInvoice] = useState<IssueRequest | null>(null);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // Issue Requests & Cart-like batch selection
  const [myRequests, setMyRequests] = useState<IssueRequest[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<Record<string, { component: Component; quantity: number }>>({});
  const [cardQtySelections, setCardQtySelections] = useState<Record<string, number>>({});
  const [showBatchReviewModal, setShowBatchReviewModal] = useState(false);

  // Form inside Review Modal
  const [selectedProjectCode, setSelectedProjectCode] = useState<string>(''); // '' = direct issue
  const [selectedRecipientType, setSelectedRecipientType] = useState<'student' | 'faculty'>('student');
  const [selectedRecipientMember, setSelectedRecipientMember] = useState<{ name: string; regNumber: string } | null>(null);
  const [requestPurposeNotes, setRequestPurposeNotes] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [requestSubmitSuccess, setRequestSubmitSuccess] = useState<string | null>(null);

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
    const codeMap = new Map<string, ProjectCode>();
    const unsubCodesList: (() => void)[] = [];

    const handleCodesSnapshot = (snap: any) => {
      snap.docs.forEach((d: any) => {
        codeMap.set(d.id, { id: d.id, ...d.data() } as ProjectCode);
      });
      const codeList = Array.from(codeMap.values());
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
    };

    if (isFaculty) {
      // Listen to both single facultyEmployeeId and array facultyEmployeeIds
      const qFac1 = query(collection(db, 'project_codes'), where('facultyEmployeeId', '==', userReg));
      const qFacAll = query(collection(db, 'project_codes'), where('facultyEmployeeIds', 'array-contains', userReg));
      unsubCodesList.push(onSnapshot(qFac1, handleCodesSnapshot, err => console.warn(err)));
      unsubCodesList.push(onSnapshot(qFacAll, handleCodesSnapshot, err => console.warn(err)));
    } else {
      const qStudent = query(collection(db, 'project_codes'), where('studentRegNumbers', 'array-contains', userReg));
      unsubCodesList.push(onSnapshot(qStudent, handleCodesSnapshot, (err) => {
        console.warn("Error fetching project codes:", err);
        setErrorMsg(err.message);
        setLoading(false);
      }));
    }

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

    // 5. Fetch Issue Requests for current user (student or faculty)
    let unsubRequests = () => {};
    if (userReg) {
      const reqQuery = query(
        collection(db, 'issue_requests'),
        where('requesterRegNumber', '==', userReg)
      );
      unsubRequests = onSnapshot(reqQuery, (snap) => {
        const reqData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as IssueRequest));
        reqData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setMyRequests(reqData);
      }, (err) => {
        console.warn("Error fetching student issue requests:", err);
      });
    }

    return () => {
      unsubCodesList.forEach(u => u());
      codeTxUnsubs.forEach(u => u());
      unsubPersonalTx();
      unsubTeamTx();
      unsubFacultyTx();
      unsubInv();
      unsubNotifs();
      unsubRequests();
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

  // Active Issue Request for persistent bottom tracker (Zomato-style)
  const activeRequest = useMemo(() => {
    return myRequests.find(r => r.status === 'pending' || r.status === 'approved' || r.status === 'partially_issued');
  }, [myRequests]);

  const batchItemCount = Object.keys(selectedBatch).length;
  const batchTotalUnits = Object.values(selectedBatch).reduce((acc, curr) => acc + curr.quantity, 0);

  const getComponentIcon = (category: string) => {
    switch ((category || '').toLowerCase()) {
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

  const handleAddToBatch = (component: Component) => {
    const qty = cardQtySelections[component.id] || (selectedBatch[component.id]?.quantity) || 1;
    setSelectedBatch(prev => ({
      ...prev,
      [component.id]: {
        component,
        quantity: Math.min(qty, component.availableQuantity)
      }
    }));
  };

  const handleRemoveFromBatch = (componentId: string) => {
    setSelectedBatch(prev => {
      const copy = { ...prev };
      delete copy[componentId];
      return copy;
    });
  };

  const handleUpdateBatchQty = (componentId: string, qty: number) => {
    setSelectedBatch(prev => {
      const cur = prev[componentId];
      if (!cur) return prev;
      if (qty <= 0) {
        const copy = { ...prev };
        delete copy[componentId];
        return copy;
      }
      return {
        ...prev,
        [componentId]: {
          ...cur,
          quantity: Math.min(qty, cur.component.availableQuantity)
        }
      };
    });
  };

  const handleConfirmSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (batchItemCount === 0 || !profile) return;

    setIsSubmittingRequest(true);
    setRequestSubmitSuccess(null);

    try {
      const itemsList = Object.values(selectedBatch).map(b => ({
        component: b.component,
        requestedQuantity: b.quantity
      }));

      // Find recipient details if under project code
      let recName = profile.name;
      let recReg = userReg;
      let recRole: 'student' | 'faculty' = isFaculty ? 'faculty' : 'student';

      if (selectedProjectCode) {
        const pCode = projectCodes.find(p => p.code === selectedProjectCode);
        if (pCode) {
          if (selectedRecipientMember) {
            recName = selectedRecipientMember.name;
            recReg = selectedRecipientMember.regNumber;
            recRole = selectedRecipientType;
          } else if (selectedRecipientType === 'faculty' && pCode.faculty) {
            recName = pCode.faculty.name;
            recReg = pCode.faculty.employeeId;
            recRole = 'faculty';
          } else if (pCode.students && pCode.students.length > 0) {
            recName = pCode.students[0].name;
            recReg = pCode.students[0].regNumber;
            recRole = 'student';
          }
        }
      }

      const newReq = await submitIssueRequest({
        requesterUid: user?.uid || '',
        requesterName: profile.name,
        requesterRegNumber: userReg,
        requesterEmail: profile.email,
        requesterMobile: profile.mobileNumber,
        requesterRole: isFaculty ? 'faculty' : 'student',
        studentCode: profile.studentCode,
        projectCode: selectedProjectCode || undefined,
        recipientType: recRole,
        recipientName: recName,
        recipientRegNumber: recReg,
        items: itemsList,
        purposeNotes: requestPurposeNotes
      });

      setSelectedBatch({});
      setRequestPurposeNotes('');
      setShowBatchReviewModal(false);
      setRequestSubmitSuccess(`Issue Request ${newReq.requestCode} submitted! Lab Admin has been notified.`);
      setTimeout(() => setRequestSubmitSuccess(null), 6000);
    } catch (err: any) {
      alert(err.message || 'Failed to submit issue request.');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const categories = useMemo(() => {
    return Array.from(new Set(inventory.map(i => i.category).filter(Boolean)));
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        item.name.toLowerCase().includes(q) ||
        (item.category || '').toLowerCase().includes(q) ||
        (item.code || '').toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (categoryFilter === 'all') return true;
      if (categoryFilter === 'in_stock') return item.availableQuantity > 0;
      if (categoryFilter === 'low_stock') return item.availableQuantity > 0 && item.availableQuantity <= (item.lowStockThreshold || 2);
      return (item.category || '').toLowerCase() === categoryFilter.toLowerCase();
    });
  }, [inventory, searchQuery, categoryFilter]);

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

      {/* NAVIGATION TABS */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200/80">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Active Loans & Catalog</span>
        </button>

        <button
          onClick={() => setActiveTab('requests')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
            activeTab === 'requests'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>My Issue Requests</span>
          {myRequests.length > 0 && (
            <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
              activeTab === 'requests' ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {myRequests.length}
            </span>
          )}
          {activeRequest && (activeRequest.status === 'approved' || activeRequest.status === 'pending') && (
            <span className={`w-2 h-2 rounded-full animate-ping ${
              activeRequest.status === 'approved' ? 'bg-emerald-400' : 'bg-amber-400'
            }`} />
          )}
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Return History</span>
        </button>
      </div>

      {/* REQUEST SUBMIT SUCCESS BANNER */}
      {requestSubmitSuccess && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-xs font-semibold text-emerald-900 flex items-center justify-between shadow-2xs animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{requestSubmitSuccess}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setRequestSubmitSuccess(null)}
            className="p-1 text-emerald-700 hover:text-emerald-900 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

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
                    <div className="space-y-1.5">
                      {([pc.faculty, pc.faculty2].filter(Boolean) as ProjectFaculty[]).map((fac, fIdx) => (
                        <div key={fIdx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <GraduationCap className="w-4 h-4 text-indigo-600" />
                            <div>
                              <span className="text-[10px] text-slate-400 uppercase font-bold block">
                                {pc.faculty2 ? `Faculty Guide #${fIdx + 1}` : 'Faculty Guide'}
                              </span>
                              <span className="font-bold text-slate-900">{fac.name}</span>
                            </div>
                          </div>
                          <div className="text-right text-[10px] font-mono text-slate-500">
                            <p>{fac.employeeId}</p>
                            <p>📞 {fac.mobileNumber}</p>
                          </div>
                        </div>
                      ))}
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
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="font-bold text-slate-900">{tx.componentName}</p>
                                  {tx.componentCode && (
                                    <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                                      {tx.componentCode}
                                    </span>
                                  )}
                                </div>
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

          {/* AVAILABLE LAB INVENTORY EXPLORER (Exact Admin-Style 2-Column Cards Grid) */}
          <div className="space-y-4 mt-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1">
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Lab Hardware Components</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select components and quantities needed for your lab experiments or project
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Search Bar matching Reference UI */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search components or codes..." 
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

            {/* Cards Grid matching Admin UI */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredInventory.length === 0 ? (
                <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-slate-200/80">
                  <p className="text-slate-500 text-sm">No hardware components found matching your search query.</p>
                </div>
              ) : (
                filteredInventory.map(item => {
                  const isSelected = !!selectedBatch[item.id];
                  const maxAvailable = item.availableQuantity;
                  const isAvailable = maxAvailable > 0;
                  const maxSelectable = Math.min(maxAvailable, 10);
                  const chosenQty = isSelected 
                    ? selectedBatch[item.id].quantity 
                    : (cardQtySelections[item.id] || 1);

                  return (
                    <div 
                      key={item.id} 
                      className={`bg-white rounded-2xl border p-5 shadow-xs transition-all flex flex-col justify-between ${
                        isSelected ? 'border-indigo-400 ring-2 ring-indigo-500/10' : 'border-slate-200/90 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200/60 overflow-hidden flex items-center justify-center flex-shrink-0 text-slate-700">
                              {item.imageUrl ? (
                                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                              ) : (
                                getComponentIcon(item.category)
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base font-bold text-slate-900 leading-tight">{item.name}</h3>
                                {item.code && (
                                  <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/90 shadow-2xs">
                                    {item.code}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                                Category: {item.category} • Rack-{item.category.slice(0, 3).toUpperCase()}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                              item.availableQuantity > (item.lowStockThreshold || 2)
                                ? 'border-emerald-300 bg-emerald-50/60 text-emerald-600'
                                : item.availableQuantity > 0
                                ? 'border-amber-300 bg-amber-50/60 text-amber-600'
                                : 'border-rose-300 bg-rose-50/60 text-rose-600'
                            }`}>
                              {item.availableQuantity > 0 ? `${item.availableQuantity} available` : 'Out of stock'}
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
                        </div>
                      </div>

                      {/* Request Issue Action Row with Quantity Selector */}
                      <div className="flex items-center gap-2.5 mt-4 pt-3 border-t border-slate-100">
                        {/* Quantity Dropdown */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <label htmlFor={`qty-select-${item.id}`} className="text-xs font-semibold text-slate-500">
                            Qty:
                          </label>
                          <select
                            id={`qty-select-${item.id}`}
                            disabled={!isAvailable}
                            value={chosenQty}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              setCardQtySelections(prev => ({ ...prev, [item.id]: val }));
                              if (isSelected) {
                                handleUpdateBatchQty(item.id, val);
                              }
                            }}
                            className="bg-slate-50 border border-slate-200/90 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-black disabled:opacity-40 cursor-pointer"
                          >
                            {Array.from({ length: Math.max(1, maxSelectable) }, (_, i) => i + 1).map(num => (
                              <option key={num} value={num} disabled={num > maxAvailable}>
                                {num} {num === maxAvailable ? '(Max)' : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Request Issue / Added Action Button */}
                        {isSelected ? (
                          <div className="flex items-center gap-1.5 flex-1">
                            <button
                              type="button"
                              onClick={() => {
                                const chosen = cardQtySelections[item.id] || selectedBatch[item.id].quantity;
                                handleUpdateBatchQty(item.id, chosen);
                              }}
                              className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Added (x{selectedBatch[item.id].quantity}) • Update</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveFromBatch(item.id)}
                              className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200/80 transition-colors cursor-pointer"
                              title="Remove from request"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={!isAvailable}
                            onClick={() => handleAddToBatch(item)}
                            className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-black disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{isAvailable ? 'Request Issue' : 'Out of Stock'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      {/* MY ISSUE REQUESTS TAB */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">My Hardware Issue Requests</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Track status of your issue requests, view admin approvals, and access your Pickup QR passes
              </p>
            </div>
            {batchItemCount > 0 && (
              <button
                onClick={() => setShowBatchReviewModal(true)}
                className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <span>Submit Current Batch ({batchItemCount})</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {myRequests.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 space-y-3">
              <Package className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-700">No Issue Requests Yet</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Explore available lab components on the Catalog tab, select quantities, and submit an issue request.
              </p>
              <button
                onClick={() => setActiveTab('overview')}
                className="py-2 px-4 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Boxes className="w-4 h-4" />
                <span>Browse Components</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {myRequests.map((req) => {
                const totalReq = req.items.reduce((a, b) => a + b.requestedQuantity, 0);
                const totalApp = req.items.reduce((a, b) => a + (b.approvedQuantity || 0), 0);
                const totalIssued = req.items.reduce((a, b) => a + (b.unitsIssuedSoFar || 0), 0);
                const hasReduced = req.items.some(i => (i.approvedQuantity || 0) < i.requestedQuantity && req.status !== 'pending');

                return (
                  <div key={req.id} className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-base font-extrabold text-slate-900 tracking-wider">
                            {req.requestCode}
                          </span>
                          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                            req.status === 'approved'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : req.status === 'partially_issued'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : req.status === 'completed'
                              ? 'bg-slate-100 text-slate-700 border-slate-200'
                              : req.status === 'rejected'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {req.status === 'approved' && 'Ready for Pickup'}
                            {req.status === 'partially_issued' && 'Partially Handed Over'}
                            {req.status === 'completed' && 'Completed'}
                            {req.status === 'rejected' && 'Declined'}
                            {req.status === 'pending' && 'Under Lab Admin Review'}
                          </span>
                          {req.projectCode && (
                            <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Code: {req.projectCode}
                            </span>
                          )}
                          {hasReduced && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                              Quantities Adjusted
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Requested: {formatDate(req.createdAt)} • {totalReq} units requested • Recipient: <strong className="text-slate-700">{req.recipientName} ({req.recipientRegNumber})</strong> ({req.recipientType === 'faculty' ? 'Faculty Guide' : 'Student'})
                        </p>
                      </div>

                      {/* Actions: Invoice Slip & Pickup Pass CTA */}
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {(req.status === 'approved' || req.status === 'partially_issued' || req.status === 'completed') && (
                          <button
                            type="button"
                            onClick={() => setSelectedReqForInvoice(req)}
                            className="py-2.5 px-3.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                            title="View, Print & Download official Handover Invoice PDF"
                          >
                            <FileText className="w-4 h-4 text-indigo-600" />
                            <span>Invoice Slip</span>
                          </button>
                        )}
                        {(req.status === 'approved' || req.status === 'partially_issued') && (
                          <button
                            onClick={() => setSelectedReqForQR(req)}
                            className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                          >
                            <QrCode className="w-4 h-4" />
                            <span>Show Pickup QR</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Notice Banner */}
                    {(req.status === 'approved' || req.status === 'partially_issued') && (
                      <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200/90 text-xs text-emerald-900 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            <strong>Contact lab admin to get the components.</strong> Show your Pickup QR at the lab counter.
                          </span>
                        </div>
                        <span className="font-mono text-[11px] font-bold text-emerald-800 shrink-0">
                          {totalIssued} of {totalApp} Units Collected
                        </span>
                      </div>
                    )}

                    {req.status === 'rejected' && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Declined by Lab Admin: {req.rejectionReason || 'No reason provided.'}</span>
                      </div>
                    )}

                    {/* Items Breakdown Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-100 font-semibold">
                          <tr>
                            <th className="py-2 px-3">Component</th>
                            <th className="py-2 px-3 text-center">Requested</th>
                            <th className="py-2 px-3 text-center">Approved</th>
                            <th className="py-2 px-3 text-center">Handed Over</th>
                            <th className="py-2 px-3 text-right">Item Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {req.items.map((it, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-slate-800">{it.componentName}</div>
                                {it.componentCode && (
                                  <span className="font-mono text-[10px] text-indigo-600">{it.componentCode}</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center font-medium text-slate-600">
                                {it.requestedQuantity}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {req.status === 'pending' ? (
                                  <span className="text-slate-400 italic">Pending</span>
                                ) : (
                                  <span className={`font-bold ${
                                    (it.approvedQuantity || 0) < it.requestedQuantity ? 'text-amber-600' : 'text-slate-900'
                                  }`}>
                                    {it.approvedQuantity || 0}
                                    {(it.approvedQuantity || 0) < it.requestedQuantity && (
                                      <span className="text-[10px] block text-amber-500 font-normal">Adjusted</span>
                                    )}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center font-semibold text-slate-800">
                                {it.unitsIssuedSoFar || 0}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  it.status === 'issued'
                                    ? 'bg-blue-100 text-blue-700'
                                    : it.status === 'approved'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : it.status === 'declined'
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}>
                                  {it.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {req.adminNotes && (
                      <p className="text-[11px] text-slate-500 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        Admin Note: "{req.adminNotes}"
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
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

      {/* BOTTOM PADDING BUFFER FOR FIXED DOCK */}
      <div className="h-28" />

      {/* ZOMATO-STYLE FLOATING BOTTOM DOCK */}
      <div className="fixed bottom-0 left-0 right-0 z-40 p-3 sm:p-4 bg-gradient-to-t from-slate-950/40 to-transparent pointer-events-none">
        <div className="max-w-4xl mx-auto pointer-events-auto">
          {batchItemCount > 0 ? (
            /* Selected Batch Ready to Request */
            <div className="bg-slate-900 text-white rounded-2xl p-3.5 sm:p-4 shadow-2xl border border-slate-800 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                  <Package className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-white">
                      {batchItemCount} component{batchItemCount > 1 ? 's' : ''} selected
                    </span>
                    <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-indigo-300 border border-slate-700">
                      {batchTotalUnits} units
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    Ready to submit issue request to Lab Administrator
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedBatch({})}
                  className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setShowBatchReviewModal(true)}
                  className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                >
                  <span>Request Issue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : activeRequest ? (
            /* Zomato Active Request Tracker (Preparing in the bottom) */
            <div className={`rounded-2xl p-3.5 sm:p-4 shadow-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in slide-in-from-bottom-4 duration-300 ${
              activeRequest.status === 'approved'
                ? 'bg-emerald-950/95 border-emerald-500/40 text-white backdrop-blur-md'
                : activeRequest.status === 'partially_issued'
                ? 'bg-blue-950/95 border-blue-500/40 text-white backdrop-blur-md'
                : 'bg-slate-900/95 border-amber-500/40 text-white backdrop-blur-md'
            }`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  activeRequest.status === 'approved'
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    : activeRequest.status === 'partially_issued'
                    ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                    : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                }`}>
                  {activeRequest.status === 'approved' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : activeRequest.status === 'partially_issued' ? (
                    <History className="w-5 h-5 text-blue-400" />
                  ) : (
                    <Clock className="w-5 h-5 text-amber-400 animate-spin" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-xs uppercase tracking-wider text-slate-300 font-mono">
                      {activeRequest.requestCode}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      activeRequest.status === 'approved'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                        : activeRequest.status === 'partially_issued'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-400/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                    }`}>
                      {activeRequest.status === 'approved'
                        ? 'Ready for Pickup'
                        : activeRequest.status === 'partially_issued'
                        ? 'Partially Collected'
                        : 'Preparing Approval (Under Review)'}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-white mt-0.5 truncate">
                    {activeRequest.status === 'approved'
                      ? 'Contact lab admin to get the components. Show your Pickup QR at the counter.'
                      : activeRequest.status === 'partially_issued'
                      ? 'Some components collected. Show your Pickup QR next time to collect leftover items.'
                      : 'Lab admin is reviewing your requested components. Quantities will be confirmed shortly.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSelectedReqForDetails(activeRequest)}
                  className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors cursor-pointer"
                >
                  Details
                </button>
                {(activeRequest.status === 'approved' || activeRequest.status === 'partially_issued') && (
                  <>
                    <button
                      type="button"
                      onClick={() => setSelectedReqForInvoice(activeRequest)}
                      className="py-2 px-3 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      title="View / Download Invoice PDF"
                    >
                      <FileText className="w-3.5 h-3.5 text-indigo-300" />
                      <span>Invoice</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedReqForQR(activeRequest)}
                      className="py-2 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
                    >
                      <QrCode className="w-4 h-4" />
                      <span>Pickup QR</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* REVIEW & SUBMIT ISSUE REQUEST MODAL */}
      {showBatchReviewModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">Review & Submit Issue Request</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Confirm component quantities and select personal or project code authorization
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBatchReviewModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleConfirmSubmitRequest} className="p-4 sm:p-6 overflow-y-auto space-y-4">
              {/* Selected Components List */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Requested Components ({batchItemCount})
                </label>
                <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden">
                  {Object.values(selectedBatch).map(({ component, quantity }) => (
                    <div key={component.id} className="p-3 bg-white flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 truncate">{component.name}</span>
                          {component.code && (
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700">
                              {component.code}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400">Available: {component.availableQuantity}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={quantity}
                          onChange={(e) => handleUpdateBatchQty(component.id, parseInt(e.target.value, 10))}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-800 text-xs"
                        >
                          {Array.from({ length: Math.min(component.availableQuantity, 10) }, (_, i) => i + 1).map(num => (
                            <option key={num} value={num}>{num} units</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleRemoveFromBatch(component.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Authorization Option: Personal vs Project Code */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Issue Authorization
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setSelectedProjectCode(''); setSelectedRecipientMember(null); }}
                    className={`p-3 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer ${
                      selectedProjectCode === ''
                        ? 'border-black bg-slate-900 text-white shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Personal Issue
                    <span className="block text-[10px] font-normal opacity-80 mt-0.5">Under your own account</span>
                  </button>
                  <button
                    type="button"
                    disabled={projectCodes.length === 0}
                    onClick={() => {
                      if (projectCodes.length > 0) {
                        const firstCode = projectCodes[0];
                        setSelectedProjectCode(firstCode.code);
                        if (selectedRecipientType === 'faculty' && firstCode.faculty) {
                          setSelectedRecipientMember({ name: firstCode.faculty.name, regNumber: firstCode.faculty.employeeId });
                        } else if (firstCode.students && firstCode.students.length > 0) {
                          setSelectedRecipientMember({ name: firstCode.students[0].name, regNumber: firstCode.students[0].regNumber });
                        }
                      }
                    }}
                    className={`p-3 rounded-xl border text-left text-xs font-bold transition-all disabled:opacity-40 cursor-pointer ${
                      selectedProjectCode !== ''
                        ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Project Code (FSV / SSV)
                    <span className="block text-[10px] font-normal opacity-80 mt-0.5">
                      {projectCodes.length > 0 ? `${projectCodes.length} codes available` : 'No team codes'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Project Code & Recipient Details */}
              {selectedProjectCode !== '' && (
                <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-200/80 space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Select Project Code</label>
                    <select
                      value={selectedProjectCode}
                      onChange={(e) => {
                        const code = e.target.value;
                        setSelectedProjectCode(code);
                        const cur = projectCodes.find(p => p.code === code);
                        if (cur) {
                          if (selectedRecipientType === 'faculty' && cur.faculty) {
                            setSelectedRecipientMember({ name: cur.faculty.name, regNumber: cur.faculty.employeeId });
                          } else if (cur.students && cur.students.length > 0) {
                            setSelectedRecipientMember({ name: cur.students[0].name, regNumber: cur.students[0].regNumber });
                          }
                        }
                      }}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-mono font-bold text-slate-900"
                    >
                      {projectCodes.map(pc => (
                        <option key={pc.id} value={pc.code}>
                          {pc.code} ({pc.codeType || 'SSV/FSV'}) - AY {pc.academicYear}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Recipient Type (Student vs Teacher/Faculty Guide) */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Component Recipient Category (Students & Teachers Eligible)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRecipientType('student');
                          const cur = projectCodes.find(p => p.code === selectedProjectCode);
                          if (cur && cur.students && cur.students.length > 0) {
                            setSelectedRecipientMember({ name: cur.students[0].name, regNumber: cur.students[0].regNumber });
                          }
                        }}
                        className={`p-2 rounded-lg text-xs font-bold border transition-colors ${
                          selectedRecipientType === 'student'
                            ? 'bg-slate-900 text-white border-black'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        Student Team Member
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRecipientType('faculty');
                          const cur = projectCodes.find(p => p.code === selectedProjectCode);
                          if (cur && cur.faculty) {
                            setSelectedRecipientMember({ name: cur.faculty.name, regNumber: cur.faculty.employeeId });
                          }
                        }}
                        className={`p-2 rounded-lg text-xs font-bold border transition-colors ${
                          selectedRecipientType === 'faculty'
                            ? 'bg-indigo-600 text-white border-indigo-700'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        Teacher / Faculty Advisor
                      </button>
                    </div>
                  </div>

                  {/* Specific Recipient Member Dropdown */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      {selectedRecipientType === 'faculty' ? 'Select Faculty Guide' : 'Select Team Student'}
                    </label>
                    {(() => {
                      const cur = projectCodes.find(p => p.code === selectedProjectCode);
                      if (!cur) return null;

                      if (selectedRecipientType === 'faculty') {
                        const faculties = [cur.faculty, cur.faculty2].filter(Boolean) as ProjectFaculty[];
                        return (
                          <select
                            value={selectedRecipientMember?.regNumber || cur.faculty?.employeeId || ''}
                            onChange={(e) => {
                              const found = faculties.find(f => f.employeeId === e.target.value);
                              if (found) setSelectedRecipientMember({ name: found.name, regNumber: found.employeeId });
                            }}
                            className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-900"
                          >
                            {faculties.map((f, i) => (
                              <option key={i} value={f.employeeId}>
                                Prof. {f.name} ({f.employeeId})
                              </option>
                            ))}
                          </select>
                        );
                      } else {
                        return (
                          <select
                            value={selectedRecipientMember?.regNumber || cur.students?.[0]?.regNumber || ''}
                            onChange={(e) => {
                              const found = cur.students.find(s => s.regNumber === e.target.value);
                              if (found) setSelectedRecipientMember({ name: found.name, regNumber: found.regNumber });
                            }}
                            className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-900"
                          >
                            {cur.students.map((s, i) => (
                              <option key={i} value={s.regNumber}>
                                {s.name} ({s.regNumber})
                              </option>
                            ))}
                          </select>
                        );
                      }
                    })()}
                  </div>
                </div>
              )}

              {/* Purpose / Remarks */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Project Purpose / Remarks (Optional)</label>
                <textarea
                  rows={2}
                  value={requestPurposeNotes}
                  onChange={(e) => setRequestPurposeNotes(e.target.value)}
                  placeholder="e.g. IoT Smart Agriculture sensor nodes assembly & testing..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>

              {/* Notice */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-500 leading-relaxed">
                ℹ️ <strong>Workflow:</strong> Once you submit, Lab Admin reviews and authorizes the items in the Admin Portal. Upon approval, you will receive your Pickup QR code to collect components at the lab counter.
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBatchReviewModal(false)}
                  className="py-2 px-4 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRequest || batchItemCount === 0}
                  className="py-2.5 px-5 rounded-xl bg-slate-900 hover:bg-black disabled:bg-slate-200 text-white font-bold text-xs flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  {isSubmittingRequest ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Issue Request</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REQUEST DETAILS MODAL */}
      {selectedReqForDetails && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Request Details • {selectedReqForDetails.requestCode}</h3>
                <p className="text-xs text-slate-500 mt-0.5">Status: <strong className="capitalize">{selectedReqForDetails.status.replace('_', ' ')}</strong></p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReqForDetails(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Recipient:</span>
                  <strong className="text-slate-900">{selectedReqForDetails.recipientName} ({selectedReqForDetails.recipientRegNumber})</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Recipient Role:</span>
                  <span className="font-semibold">{selectedReqForDetails.recipientType === 'faculty' ? 'Teacher / Faculty Guide' : 'Student'}</span>
                </div>
                {selectedReqForDetails.projectCode && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Project Code:</span>
                    <strong className="font-mono">{selectedReqForDetails.projectCode}</strong>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Date Submitted:</span>
                  <span>{formatDate(selectedReqForDetails.createdAt)}</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-1.5">
                <span className="font-bold text-slate-700 uppercase tracking-wider block text-[11px]">Requested Components</span>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {selectedReqForDetails.items.map((it, idx) => (
                    <div key={idx} className="p-3 bg-white flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-900">{it.componentName}</p>
                        {it.componentCode && <span className="font-mono text-[10px] text-indigo-600">{it.componentCode}</span>}
                      </div>
                      <div className="text-right">
                        <p className="font-medium">Requested: {it.requestedQuantity}</p>
                        <p className="font-bold text-indigo-600">Approved: {it.approvedQuantity || 0} • Issued: {it.unitsIssuedSoFar || 0}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedReqForDetails.adminNotes && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                  <strong>Admin Note:</strong> {selectedReqForDetails.adminNotes}
                </div>
              )}

              {(selectedReqForDetails.status === 'approved' || selectedReqForDetails.status === 'partially_issued' || selectedReqForDetails.status === 'completed') && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const req = selectedReqForDetails;
                      setSelectedReqForDetails(null);
                      setSelectedReqForInvoice(req);
                    }}
                    className="flex-1 py-2.5 px-3 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <span>Handover Invoice & PDF</span>
                  </button>
                  {(selectedReqForDetails.status === 'approved' || selectedReqForDetails.status === 'partially_issued') && (
                    <button
                      type="button"
                      onClick={() => {
                        const req = selectedReqForDetails;
                        setSelectedReqForDetails(null);
                        setSelectedReqForQR(req);
                      }}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                    >
                      <QrCode className="w-4 h-4" />
                      <span>Show Pickup QR</span>
                    </button>
                  )}
                </div>
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

      {/* Request Pickup Pass QR Modal */}
      <RequestQRModal
        request={selectedReqForQR}
        onClose={() => setSelectedReqForQR(null)}
      />

      {/* Official Handover Invoice & Slip Modal */}
      <IssueInvoiceModal
        request={selectedReqForInvoice}
        onClose={() => setSelectedReqForInvoice(null)}
      />

      {/* Notifications Modal */}
      <NotificationsModal
        isOpen={showNotificationsModal}
        onClose={() => setShowNotificationsModal(false)}
      />

    </div>
  );
}
