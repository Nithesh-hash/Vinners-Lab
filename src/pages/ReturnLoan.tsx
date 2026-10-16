import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, runTransaction, serverTimestamp, Timestamp, query, collection, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Transaction, Component, ReturnLogEntry } from '@/types';
import { notifyAdminOnReturn } from '@/lib/emailService';
import {
  CheckCircle2,
  AlertCircle,
  QrCode,
  ArrowLeft,
  Package,
  User,
  Calendar,
  AlertTriangle,
  History
} from 'lucide-react';

export default function ReturnLoan() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const loanId = searchParams.get('id') || '';

  const [loading, setLoading] = useState(true);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [component, setComponent] = useState<Component | null>(null);
  const [studentEmail, setStudentEmail] = useState<string>('');
  const [studentMobile, setStudentMobile] = useState<string>('');
  const [studentCode, setStudentCode] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Return Form State
  const [returnQty, setReturnQty] = useState<number>(1);
  const [condition, setCondition] = useState<'Good' | 'Damaged' | 'Incomplete'>('Good');
  const [adminNotes, setAdminNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [returnSuccess, setReturnSuccess] = useState<boolean>(false);
  const [lastReturnedDetails, setLastReturnedDetails] = useState<{
    qty: number;
    condition: string;
    newStatus: string;
    availableStock: number;
  } | null>(null);

  useEffect(() => {
    if (!loanId) {
      setErrorMsg('No loan transaction ID was specified.');
      setLoading(false);
      return;
    }

    let isMounted = true;
    const fetchLoanData = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        // 1. Fetch transaction
        const txDocRef = doc(db, 'transactions', loanId);
        const txSnap = await getDoc(txDocRef);

        if (!txSnap.exists()) {
          if (isMounted) {
            setErrorMsg('Invalid or unrecognized loan QR. Transaction record was not found in the database.');
            setLoading(false);
          }
          return;
        }

        const txData = { id: txSnap.id, ...txSnap.data() } as Transaction;
        if (isMounted) setTransaction(txData);

        // Default return quantity to current outstanding quantity
        const returned = txData.returnedQuantity || 0;
        const outstanding = Math.max(1, txData.quantity - returned);
        if (isMounted) setReturnQty(outstanding > 0 ? outstanding : 1);

        // 2. Fetch associated component
        if (txData.componentId) {
          const compDocRef = doc(db, 'inventory', txData.componentId);
          const compSnap = await getDoc(compDocRef);
          if (compSnap.exists() && isMounted) {
            setComponent({ id: compSnap.id, ...compSnap.data() } as Component);
          }
        }

        // 3. Fetch supplementary student details if not fully present on transaction
        let sEmail = txData.studentEmail || '';
        let sMobile = txData.studentMobile || '';
        let sCode = txData.studentCode || '';

        if (!sEmail || !sMobile || !sCode) {
          try {
            if (txData.studentId) {
              const userDocRef = doc(db, 'users', txData.studentId);
              const userSnap = await getDoc(userDocRef);
              if (userSnap.exists()) {
                const u = userSnap.data();
                if (!sEmail) sEmail = u.email || '';
                if (!sMobile) sMobile = u.mobileNumber || '';
                if (!sCode) sCode = u.studentCode || '';
              }
            } else if (txData.studentRegNumber) {
              const qUser = query(collection(db, 'users'), where('regNumber', '==', txData.studentRegNumber.trim().toUpperCase()));
              const uSnap = await getDocs(qUser);
              if (!uSnap.empty) {
                const u = uSnap.docs[0].data();
                if (!sEmail) sEmail = u.email || '';
                if (!sMobile) sMobile = u.mobileNumber || '';
                if (!sCode) sCode = u.studentCode || '';
              }
            }
          } catch (e) {
            console.warn("Could not fetch supplementary student details:", e);
          }
        }

        if (isMounted) {
          setStudentEmail(sEmail || 'N/A');
          setStudentMobile(sMobile || '');
          setStudentCode(sCode || '');
        }

        if (isMounted) setLoading(false);
      } catch (err: any) {
        console.error('Failed to load return loan details:', err);
        if (isMounted) {
          setErrorMsg(err?.message || 'Failed to retrieve loan records.');
          setLoading(false);
        }
      }
    };

    fetchLoanData();

    return () => {
      isMounted = false;
    };
  }, [loanId]);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-80 space-y-3">
        <div className="w-9 h-9 border-3 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 font-medium">Validating loan record from Firestore...</p>
      </div>
    );
  }

  if (errorMsg || !transaction) {
    return (
      <div className="max-w-xl mx-auto my-8 p-6 bg-white rounded-3xl border border-slate-200/90 shadow-sm text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Loan Verification Failed</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">{errorMsg}</p>
        </div>
        <div className="pt-2 flex justify-center gap-3">
          <button
            onClick={() => navigate('/admin/scan')}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5"
          >
            <QrCode className="w-3.5 h-3.5" />
            Scan Another QR
          </button>
          <button
            onClick={() => navigate('/admin')}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const alreadyReturned = transaction.returnedQuantity || 0;
  const outstandingQuantity = Math.max(0, transaction.quantity - alreadyReturned);
  const isFullyReturned = transaction.status === 'Returned' || outstandingQuantity === 0;

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleExecuteReturn = async () => {
    // Basic client validation
    if (!profile || profile.role !== 'admin') {
      alert('Unauthorized: Only administrators can process returns.');
      return;
    }

    if (returnQty <= 0 || !Number.isInteger(returnQty)) {
      alert('Return quantity must be a positive whole number.');
      return;
    }

    if (returnQty > outstandingQuantity) {
      alert(`Return quantity cannot exceed outstanding balance of ${outstandingQuantity}.`);
      return;
    }

    try {
      setIsSubmitting(true);
      setShowConfirmModal(false);

      // Execute atomic Firestore transaction
      let newAvailableStock = 0;
      let finalStatus = '';

      await runTransaction(db, async (txn) => {
        const txRef = doc(db, 'transactions', transaction.id);
        const txDoc = await txn.get(txRef);

        if (!txDoc.exists()) {
          throw new Error('Transaction document no longer exists.');
        }

        const currentTx = txDoc.data() as Transaction;
        const currentReturned = currentTx.returnedQuantity || 0;
        const currentOutstanding = currentTx.quantity - currentReturned;

        if (currentOutstanding <= 0 || currentTx.status === 'Returned') {
          throw new Error('This loan has already been fully returned.');
        }

        if (returnQty > currentOutstanding) {
          throw new Error(`Cannot return ${returnQty} units. Only ${currentOutstanding} units remain outstanding.`);
        }

        // Check if real inventory component or custom / other item
        let isRealComp = false;
        let currentComp: Component | null = null;
        let compRef: any = null;

        if (currentTx.componentId && !currentTx.componentId.startsWith('other_')) {
          compRef = doc(db, 'inventory', currentTx.componentId);
          const compDoc = await txn.get(compRef);
          if (compDoc.exists()) {
            isRealComp = true;
            currentComp = compDoc.data() as Component;
          }
        }

        // Project Code read (must precede writes)
        let codeRef: any = null;
        let codeDoc: any = null;
        if (currentTx.projectCode) {
          codeRef = doc(db, 'project_codes', currentTx.projectCode);
          codeDoc = await txn.get(codeRef);
        }

        const newReturnedTotal = currentReturned + returnQty;
        finalStatus = newReturnedTotal >= currentTx.quantity ? 'Returned' : 'Partially Returned';

        // Inventory Stock Updates (only for real inventory items)
        if (isRealComp && currentComp && compRef) {
          const newIssuedQty = Math.max(0, currentComp.issuedQuantity - returnQty);
          let updatedDamaged = currentComp.damagedQuantity || 0;
          let updatedAvailable = currentComp.availableQuantity;

          if (condition === 'Good') {
            // Usable items re-enter available stock
            updatedAvailable = currentComp.availableQuantity + returnQty;
          } else {
            // Damaged or Incomplete items are segregated and NOT made available
            updatedDamaged = (currentComp.damagedQuantity || 0) + returnQty;
          }

          // Strict Invariant: Available stock can never exceed totalQuantity or total - issued - damaged
          const maxAllowedStock = Math.max(0, currentComp.totalQuantity - newIssuedQty - updatedDamaged);
          updatedAvailable = Math.max(0, Math.min(maxAllowedStock, Math.min(currentComp.totalQuantity, updatedAvailable)));

          newAvailableStock = updatedAvailable;

          // Atomically update inventory component
          txn.update(compRef, {
            availableQuantity: updatedAvailable,
            issuedQuantity: newIssuedQty,
            damagedQuantity: updatedDamaged,
            updatedAt: serverTimestamp()
          });
        }

        // Prepare return log record
        const cleanNotes = adminNotes.trim();
        const logEntry: ReturnLogEntry = {
          returnDate: Timestamp.now(),
          returnedQuantity: returnQty,
          condition,
          adminId: profile.uid,
          adminName: profile.name || 'Lab Admin'
        };
        if (cleanNotes) {
          logEntry.adminNotes = cleanNotes;
        }
        if (profile.email) {
          logEntry.adminEmail = profile.email;
        }

        const existingLogs = currentTx.returnsLog || [];
        const newLogs = [...existingLogs, logEntry];

        // Atomically update loan transaction
        const updateTxPayload: Record<string, any> = {
          returnedQuantity: newReturnedTotal,
          status: finalStatus,
          returnDate: Timestamp.now(),
          returnedByAdminId: profile.uid,
          returnedByAdminName: profile.name || 'Lab Admin',
          condition,
          returnsLog: newLogs
        };
        if (cleanNotes) {
          updateTxPayload.adminNotes = cleanNotes;
        }

        txn.update(txRef, updateTxPayload);

        // Atomically update project code record if loan was issued under a code
        if (codeRef && codeDoc && codeDoc.exists()) {
          const codeData = codeDoc.data();
          const existingIssued = codeData.issuedItems || [];
          const updatedIssued = existingIssued.map((item: any) => {
            if (item.transactionId === currentTx.id) {
              return {
                ...item,
                returnedQuantity: newReturnedTotal,
                status: finalStatus
              };
            }
            return item;
          });
          txn.update(codeRef, {
            issuedItems: updatedIssued,
            updatedAt: Timestamp.now()
          });
        }
      });

      // Update local view state
      setLastReturnedDetails({
        qty: returnQty,
        condition,
        newStatus: finalStatus,
        availableStock: newAvailableStock
      });

      setTransaction((prev) => {
        if (!prev) return null;
        const newReturned = (prev.returnedQuantity || 0) + returnQty;
        return {
          ...prev,
          returnedQuantity: newReturned,
          status: finalStatus as any
        };
      });

      if (component) {
        setComponent((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            availableQuantity: newAvailableStock,
            issuedQuantity: Math.max(0, prev.issuedQuantity - returnQty)
          };
        });
      }

      // Automated email notification to admin upon return verification with complete student details
      if (transaction) {
        notifyAdminOnReturn({
          studentName: transaction.studentName,
          studentRegNumber: transaction.studentRegNumber,
          studentEmail: studentEmail !== 'N/A' ? studentEmail : transaction.studentEmail,
          studentMobile: studentMobile || transaction.studentMobile,
          studentCode: studentCode || transaction.studentCode,
          projectCode: transaction.projectCode,
          facultyName: transaction.facultyName,
          componentCode: component?.code || transaction.componentCode,
          componentName: transaction.componentName,
          category: component?.category,
          returnedQuantity: returnQty,
          returnDate: new Date(),
          condition,
          adminNotes: adminNotes.trim() || undefined,
          adminName: profile?.name || 'Lab Admin',
          remainingQuantity: Math.max(0, transaction.quantity - ((transaction.returnedQuantity || 0) + returnQty)),
          transactionId: transaction.id
        }).catch(err => console.warn("Return email error:", err));
      }

      setReturnSuccess(true);
      setIsSubmitting(false);
    } catch (err: any) {
      console.error('Return processing error:', err);
      alert(`Error completing return: ${err?.message || 'Transaction failed'}`);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-4xl mx-auto pb-12">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/admin/scan"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Scanner
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-slate-400">Loan ID: {transaction.id}</span>
        </div>
      </div>

      {/* Success Notification Banner */}
      {returnSuccess && lastReturnedDetails && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-4 sm:p-6 text-emerald-950 animate-in zoom-in-95 duration-200 shadow-xs">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-extrabold text-emerald-900">Return Successfully Processed</h2>
              <p className="text-xs text-emerald-800 mt-1">
                Checked in <strong>{lastReturnedDetails.qty} unit(s)</strong> under condition{' '}
                <strong>{lastReturnedDetails.condition}</strong>. Transaction status updated to{' '}
                <span className="font-bold underline">{lastReturnedDetails.newStatus}</span>.
              </p>
              <div className="mt-3 pt-3 border-t border-emerald-200/80 flex flex-wrap items-center gap-4 text-xs font-medium text-emerald-900">
                <span>Refreshed Available Stock: <strong>{lastReturnedDetails.availableStock} units</strong></span>
                <span>•</span>
                <span>Processed by: <strong>{profile?.name}</strong></span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2.5">
                <button
                  onClick={() => navigate('/admin/scan')}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  Scan Next Return QR
                </button>
                <button
                  onClick={() => navigate('/admin')}
                  className="px-4 py-2 rounded-xl border border-emerald-300 bg-white hover:bg-emerald-100/50 text-emerald-900 font-semibold text-xs transition-colors"
                >
                  Return to Admin Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Loan Verification Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Student & Hardware Summary */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card 1: Student Information */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-slate-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Verified Student Identity
              </h3>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {transaction.studentRegNumber}
                </p>
                <h2 className="text-xl font-extrabold text-slate-900 mt-0.5">{transaction.studentName}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{studentEmail || 'Registered Student'}</p>
              </div>
              <div className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-mono font-bold">
                Student
              </div>
            </div>
          </div>

          {/* Card 2: Component & Checkout Status */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-slate-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Borrowed Hardware Component
                </h3>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                transaction.status === 'Returned' 
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : transaction.status === 'Partially Returned'
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                  : 'border-amber-300 bg-amber-50 text-amber-700'
              }`}>
                {transaction.status}
              </span>
            </div>

            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 break-words">{transaction.componentName}</h2>
              <div className="flex items-center flex-wrap gap-2 mt-1 text-xs text-slate-500">
                <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                  ID: {transaction.componentId}
                </span>
                {component?.category && (
                  <>
                    <span>•</span>
                    <span>{component.category}</span>
                  </>
                )}
                {component?.storageLocation && (
                  <>
                    <span>•</span>
                    <span>Bin: {component.storageLocation}</span>
                  </>
                )}
              </div>
            </div>

            {/* Inventory figures audit breakdown */}
            <div className="grid grid-cols-3 gap-2 sm:gap-2.5 pt-3 border-t border-slate-100 text-center sm:text-left">
              <div className="p-2 sm:p-3 bg-slate-50 rounded-2xl border border-slate-200/60 min-w-0">
                <span className="text-[9px] sm:text-[10px] font-semibold text-slate-400 uppercase tracking-wider block truncate">Originally Issued</span>
                <span className="text-base sm:text-xl font-extrabold text-slate-900">{transaction.quantity}</span>
              </div>
              <div className="p-2 sm:p-3 bg-slate-50 rounded-2xl border border-slate-200/60 min-w-0">
                <span className="text-[9px] sm:text-[10px] font-semibold text-slate-400 uppercase tracking-wider block truncate">Already Returned</span>
                <span className="text-base sm:text-xl font-extrabold text-emerald-600">{alreadyReturned}</span>
              </div>
              <div className="p-2 sm:p-3 bg-amber-50/70 rounded-2xl border border-amber-200/60 min-w-0">
                <span className="text-[9px] sm:text-[10px] font-semibold text-amber-700 uppercase tracking-wider block truncate">Outstanding</span>
                <span className="text-base sm:text-xl font-black text-amber-900">{outstandingQuantity}</span>
              </div>
            </div>

            {/* Timestamps */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">Issued: <strong>{formatDate(transaction.issueDate)}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">Due Date: <strong>{formatDate(transaction.expectedReturnDate)}</strong></span>
              </div>
            </div>
          </div>

          {/* Past Returns Log if partially or fully returned */}
          {transaction.returnsLog && transaction.returnsLog.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs">
              <div className="flex items-center gap-2 mb-3">
                <History className="w-4 h-4 text-slate-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Previous Return Logs for this Loan
                </h3>
              </div>
              <div className="space-y-2.5">
                {transaction.returnsLog.map((log, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-xs flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900">
                        {log.returnedQuantity} unit(s) returned · Condition: <span className="underline">{log.condition}</span>
                      </p>
                      {log.adminNotes && <p className="text-slate-500 mt-0.5 italic">"{log.adminNotes}"</p>}
                      <p className="text-[10px] text-slate-400 mt-1">Processed by {log.adminName || log.adminId}</p>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500">{formatDate(log.returnDate)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Return Processing Form */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-xs lg:sticky lg:top-6">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Process Hardware Return</h3>
            <p className="text-xs text-slate-500 mb-5">
              Verify the hardware units in hand before confirming return transaction.
            </p>

            {isFullyReturned ? (
              <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs space-y-3">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>This loan has already been fully returned.</span>
                </div>
                <p className="text-amber-700 leading-relaxed">
                  All originally issued hardware units have already been recorded as returned. No further units can be checked in for this transaction.
                </p>
                <button
                  onClick={() => navigate('/admin/scan')}
                  className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition-colors"
                >
                  Scan Another Loan QR
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setShowConfirmModal(true);
                }}
                className="space-y-4 text-xs"
              >
                {/* 1. Return Quantity */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-semibold text-slate-700">Quantity Being Returned</label>
                    <span className="text-slate-400 text-[11px]">Max: {outstandingQuantity}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={returnQty <= 1}
                      onClick={() => setReturnQty(Math.max(1, returnQty - 1))}
                      className="w-10 h-10 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 font-bold text-slate-700 flex items-center justify-center transition-colors disabled:opacity-40"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      required
                      min={1}
                      max={outstandingQuantity}
                      value={returnQty}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        setReturnQty(Math.min(outstandingQuantity, Math.max(1, val)));
                      }}
                      className="flex-1 text-center font-bold text-lg py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                    <button
                      type="button"
                      disabled={returnQty >= outstandingQuantity}
                      onClick={() => setReturnQty(Math.min(outstandingQuantity, returnQty + 1))}
                      className="w-10 h-10 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 font-bold text-slate-700 flex items-center justify-center transition-colors disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                  {returnQty < outstandingQuantity && (
                    <p className="text-[11px] text-indigo-600 font-medium mt-1">
                      Note: This will mark the loan as "Partially Returned" ({outstandingQuantity - returnQty} remaining).
                    </p>
                  )}
                </div>

                {/* 2. Hardware Condition */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1.5">Component Condition</label>
                  <div className="space-y-2">
                    <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                      condition === 'Good' 
                        ? 'border-slate-900 bg-slate-50/70 shadow-2xs' 
                        : 'border-slate-200 hover:bg-slate-50/50'
                    }`}>
                      <input
                        type="radio"
                        name="condition"
                        value="Good"
                        checked={condition === 'Good'}
                        onChange={() => setCondition('Good')}
                        className="mt-0.5 accent-slate-900"
                      />
                      <div>
                        <span className="font-bold text-slate-900 block">Good (Restock to Available)</span>
                        <span className="text-[11px] text-slate-500">Component is functional and ready for future student checkouts.</span>
                      </div>
                    </label>

                    <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                      condition === 'Damaged' 
                        ? 'border-rose-900 bg-rose-50/50 shadow-2xs' 
                        : 'border-slate-200 hover:bg-slate-50/50'
                    }`}>
                      <input
                        type="radio"
                        name="condition"
                        value="Damaged"
                        checked={condition === 'Damaged'}
                        onChange={() => setCondition('Damaged')}
                        className="mt-0.5 accent-rose-600"
                      />
                      <div>
                        <span className="font-bold text-rose-700 block">Damaged (Quarantine Stock)</span>
                        <span className="text-[11px] text-slate-500">Component requires repair/inspection; will NOT be added to available stock.</span>
                      </div>
                    </label>

                    <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                      condition === 'Incomplete' 
                        ? 'border-amber-900 bg-amber-50/50 shadow-2xs' 
                        : 'border-slate-200 hover:bg-slate-50/50'
                    }`}>
                      <input
                        type="radio"
                        name="condition"
                        value="Incomplete"
                        checked={condition === 'Incomplete'}
                        onChange={() => setCondition('Incomplete')}
                        className="mt-0.5 accent-amber-600"
                      />
                      <div>
                        <span className="font-bold text-amber-800 block">Incomplete (Missing Accessories)</span>
                        <span className="text-[11px] text-slate-500">Missing USB cables, jumper pins, or original accessories.</span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* 3. Optional Admin Notes */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Admin Notes (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Returned with original packaging; tested pin headers ok."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 resize-none"
                  />
                </div>

                {/* Action Buttons */}
                <div className="pt-2 space-y-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Confirm Hardware Return
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/admin/scan')}
                    className="w-full py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-semibold text-xs transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal to prevent accidental clicks */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full max-h-[92dvh] overflow-y-auto p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-900">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Confirm Return Submission</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                You are about to record the check-in of <strong>{returnQty} unit(s)</strong> of{' '}
                <strong>{transaction.componentName}</strong> from student{' '}
                <strong>{transaction.studentName}</strong> ({transaction.studentRegNumber}).
              </p>
              <div className="mt-3 p-3 bg-slate-50 rounded-xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Condition:</span>
                  <span className="font-bold text-slate-900">{condition}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Restock Available:</span>
                  <span className="font-bold text-slate-900">{condition === 'Good' ? `+${returnQty} units` : '0 (Quarantined)'}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                disabled={isSubmitting}
                onClick={handleExecuteReturn}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? 'Recording...' : 'Yes, Confirm Return'}
              </button>
              <button
                disabled={isSubmitting}
                onClick={() => setShowConfirmModal(false)}
                className="py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
