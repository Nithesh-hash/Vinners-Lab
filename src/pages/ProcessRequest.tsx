import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { doc, onSnapshot, collection, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { IssueRequest, Component } from '@/types';
import { checkoutIssueRequestAtCounter } from '@/lib/issueRequestService';
import {
  CheckCircle2,
  AlertCircle,
  QrCode,
  ArrowLeft,
  Package,
  AlertTriangle,
  ShieldCheck,
  Info,
  FileText,
  Printer
} from 'lucide-react';
import IssueInvoiceModal from '@/components/IssueInvoiceModal';

function getDefaultTwoMonthDueDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 2);
  return d.toISOString().split('T')[0];
}

interface ItemIssueState {
  componentId: string;
  quantityToIssue: number;
  isSelected: boolean;
}

export default function ProcessRequest() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const requestId = searchParams.get('id') || '';

  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<IssueRequest | null>(null);
  const [inventoryMap, setInventoryMap] = useState<Map<string, Component>>(new Map());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [itemsToIssue, setItemsToIssue] = useState<Record<string, ItemIssueState>>({});
  const [dueDateStr, setDueDateStr] = useState<string>(getDefaultTwoMonthDueDate());
  const [handoverNotes, setHandoverNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState<{
    allCompleted: boolean;
    totalUnitsIssuedNow: number;
    remainingUnits: number;
  } | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  // Real-time listener for the issue request
  useEffect(() => {
    if (!requestId) {
      setErrorMsg('No Issue Request ID was provided.');
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubReq = onSnapshot(doc(db, 'issue_requests', requestId), (snap) => {
      if (!snap.exists()) {
        setErrorMsg(`Issue Request "${requestId}" was not found in the database.`);
        setLoading(false);
        return;
      }

      const data = { id: snap.id, ...snap.data() } as IssueRequest;
      setRequest(data);
      setLoading(false);

      // Initialize items state
      setItemsToIssue(prev => {
        const next: Record<string, ItemIssueState> = {};
        data.items.forEach(it => {
          const approved = it.approvedQuantity ?? it.requestedQuantity;
          const issued = it.issuedQuantity || 0;
          const outstanding = Math.max(0, approved - issued);

          // If already in prev, keep previous edit, otherwise default to outstanding
          if (prev[it.componentId]) {
            next[it.componentId] = prev[it.componentId];
          } else {
            next[it.componentId] = {
              componentId: it.componentId,
              quantityToIssue: outstanding,
              isSelected: outstanding > 0
            };
          }
        });
        return next;
      });
    }, (err) => {
      console.error("Error fetching request:", err);
      setErrorMsg(err.message || 'Failed to load request.');
      setLoading(false);
    });

    // Real-time listener for inventory items to show live stock
    const unsubInv = onSnapshot(query(collection(db, 'inventory')), (snap) => {
      const map = new Map<string, Component>();
      snap.docs.forEach(d => {
        map.set(d.id, { id: d.id, ...d.data() } as Component);
      });
      setInventoryMap(map);
    });

    return () => {
      unsubReq();
      unsubInv();
    };
  }, [requestId]);

  const updateItemQty = (componentId: string, val: number) => {
    setItemsToIssue(prev => {
      const cur = prev[componentId];
      if (!cur) return prev;
      const safeVal = Math.max(0, val);
      return {
        ...prev,
        [componentId]: {
          ...cur,
          quantityToIssue: safeVal,
          isSelected: safeVal > 0
        }
      };
    });
  };

  const toggleItemSelection = (componentId: string) => {
    setItemsToIssue(prev => {
      const cur = prev[componentId];
      if (!cur) return prev;
      const newSelected = !cur.isSelected;
      return {
        ...prev,
        [componentId]: {
          ...cur,
          isSelected: newSelected,
          quantityToIssue: newSelected && cur.quantityToIssue === 0 ? 1 : cur.quantityToIssue
        }
      };
    });
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!request) return;

    // Build payload of selected items with qty > 0
    const listToIssue = Object.values(itemsToIssue)
      .filter(it => it.isSelected && it.quantityToIssue > 0)
      .map(it => ({
        componentId: it.componentId,
        quantityToIssue: it.quantityToIssue
      }));

    if (listToIssue.length === 0) {
      alert('Please select at least one component with a quantity greater than 0 to issue.');
      return;
    }

    // Verify stock
    for (const it of listToIssue) {
      const comp = inventoryMap.get(it.componentId);
      if (comp && comp.availableQuantity < it.quantityToIssue) {
        alert(`Insufficient stock for "${comp.name}". Only ${comp.availableQuantity} unit(s) available in inventory.`);
        return;
      }
    }

    if (!dueDateStr) {
      alert('Please specify an expected return due date.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await checkoutIssueRequestAtCounter({
        request,
        itemsToIssueNow: listToIssue,
        dueDate: new Date(`${dueDateStr}T23:59:59`),
        adminId: profile?.uid || 'admin',
        adminName: profile?.name || 'Administrator',
        handoverNotes
      });

      setSuccessResult({
        allCompleted: res.allCompleted,
        totalUnitsIssuedNow: res.totalUnitsIssuedNow,
        remainingUnits: res.remainingUnits
      });
    } catch (err: any) {
      console.error("Handover checkout failed:", err);
      setErrorMsg(err.message || 'Failed to complete checkout.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-10 h-10 border-4 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-slate-500 font-medium">Loading issue request details...</p>
      </div>
    );
  }

  if (errorMsg && !request) {
    return (
      <div className="max-w-xl mx-auto my-12 p-6 bg-white rounded-3xl border border-rose-200 shadow-xl text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Unable to Open Request</h2>
        <p className="text-xs text-rose-700 bg-rose-50 p-3 rounded-xl border border-rose-100">{errorMsg}</p>
        <button
          onClick={() => navigate('/admin/scan-request')}
          className="px-5 py-2.5 rounded-full bg-slate-900 text-white text-xs font-bold hover:bg-black transition-all cursor-pointer inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Request Scanner</span>
        </button>
      </div>
    );
  }

  if (!request) return null;

  // Render Success Screen after checkout
  if (successResult) {
    return (
      <div className="max-w-2xl mx-auto my-8 p-6 sm:p-8 bg-white rounded-3xl border border-emerald-200 shadow-2xl animate-in zoom-in-95 duration-200 font-sans space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
          </div>
          <span className="font-mono text-xs font-bold text-slate-400 uppercase tracking-widest block">
            {request.requestCode}
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900">
            {successResult.allCompleted ? 'Hardware Checkout Complete!' : 'Partial Hardware Handover Recorded!'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
            {successResult.allCompleted
              ? `All requested hardware units (${successResult.totalUnitsIssuedNow} units) have been officially issued and deducted from inventory.`
              : `Handed over ${successResult.totalUnitsIssuedNow} unit(s). ${successResult.remainingUnits} unit(s) remain pending. The student can scan this same QR pass next time to receive the rest!`}
          </p>
        </div>

        {/* Breakdown Card */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs space-y-2.5">
          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-semibold">Recipient</span>
            <span className="font-bold text-slate-900">
              {request.recipientName || request.requesterName} ({request.recipientRegNumber || request.requesterRegNumber})
            </span>
          </div>
          {request.projectCode && (
            <div className="flex justify-between items-center font-mono">
              <span className="text-slate-500 font-sans font-semibold">Project Code</span>
              <span className="text-indigo-700 font-bold">{request.projectCode}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-semibold">Return Deadline</span>
            <span className="font-bold text-slate-900">{new Date(dueDateStr).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={() => setShowInvoiceModal(true)}
            className="flex-1 py-3 px-5 rounded-2xl bg-slate-900 hover:bg-black text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>Print Invoice Slip / PDF</span>
          </button>
          <button
            onClick={() => navigate('/admin/scan-request')}
            className="flex-1 py-3 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
            <span>Scan Next Request</span>
          </button>
          <button
            onClick={() => navigate('/admin?tab=requests')}
            className="py-3 px-5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
          >
            <span>All Requests</span>
          </button>
        </div>

        {/* Handover Invoice Slip & PDF Modal */}
        {showInvoiceModal && (
          <IssueInvoiceModal
            request={request}
            onClose={() => setShowInvoiceModal(false)}
          />
        )}
      </div>
    );
  }

  const isTeacherRecipient = request.recipientType === 'faculty' || request.requesterRole === 'faculty';
  const totalApproved = request.items.reduce((acc, it) => acc + (it.approvedQuantity ?? it.requestedQuantity), 0);
  const totalAlreadyIssued = request.items.reduce((acc, it) => acc + (it.issuedQuantity || 0), 0);
  const totalOutstanding = Math.max(0, totalApproved - totalAlreadyIssued);

  const unitsSelectedNow = Object.values(itemsToIssue).reduce((acc, it) => it.isSelected ? acc + it.quantityToIssue : acc, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-4xl mx-auto pb-12 font-sans">
      
      {/* Top Breadcrumb & Nav */}
      <div className="flex items-center justify-between">
        <Link
          to="/admin/scan-request"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Request Scanner</span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowInvoiceModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
            title="View or Print Invoice PDF"
          >
            <FileText className="w-3.5 h-3.5 text-indigo-600" />
            <span>Invoice PDF</span>
          </button>
          <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            Pass: {request.requestCode}
          </span>
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden p-6 sm:p-8 space-y-6">
        
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${
                request.status === 'completed'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : request.status === 'partially_issued'
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-emerald-100 text-emerald-800 border-emerald-300'
              }`}>
                {request.status === 'completed' 
                  ? 'Completed' 
                  : request.status === 'partially_issued' 
                  ? 'Partially Issued' 
                  : 'Approved Request'}
              </span>
              <span className="text-xs font-mono text-slate-400">
                Created: {request.createdAt?.toDate ? request.createdAt.toDate().toLocaleDateString() : 'Recent'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Hardware Handover Console
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Verify hardware components, adjust quantities for current physical availability, and authorize checkout.
            </p>
          </div>

          <div className="text-left sm:text-right bg-slate-50 p-3 sm:p-0 rounded-2xl sm:bg-transparent">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              {isTeacherRecipient ? 'Faculty Advisor / Teacher' : 'Student Recipient'}
            </span>
            <p className="font-extrabold text-slate-900 text-sm">
              {request.recipientName || request.requesterName}
            </p>
            <p className="text-xs font-mono text-slate-500">
              {request.recipientRegNumber || request.requesterRegNumber}
              {request.requesterMobile ? ` • 📞 ${request.requesterMobile}` : ''}
            </p>
            {request.projectCode && (
              <span className="inline-block mt-1 font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                Code: {request.projectCode}
              </span>
            )}
          </div>
        </div>

        {/* Purpose / Requester Notes */}
        {request.purposeNotes && (
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-700 flex items-start gap-2">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-[11px] font-bold text-slate-800">Project / Request Purpose:</strong>
              <span>{request.purposeNotes}</span>
            </div>
          </div>
        )}

        {/* Error Notice */}
        {errorMsg && (
          <div className="p-3.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-2xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Component Checklist & Editable Quantities */}
        <form onSubmit={handleCheckout} className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Package className="w-4 h-4 text-indigo-600" />
                  <span>Approved Components to Issue</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Adjust the "Issue Now" quantity based on what is physically available in the lab today.
                </p>
              </div>
              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                {unitsSelectedNow} of {totalOutstanding} units selected
              </span>
            </div>

            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/90 overflow-hidden bg-white shadow-2xs">
              {request.items.map((it) => {
                const comp = inventoryMap.get(it.componentId);
                const approvedQty = it.approvedQuantity ?? it.requestedQuantity;
                const previouslyIssued = it.issuedQuantity || 0;
                const outstandingQty = Math.max(0, approvedQty - previouslyIssued);
                const itemState = itemsToIssue[it.componentId] || {
                  componentId: it.componentId,
                  quantityToIssue: outstandingQty,
                  isSelected: outstandingQty > 0
                };
                const availableInStock = comp ? comp.availableQuantity : 0;
                const isOutOfStock = availableInStock <= 0;

                return (
                  <div
                    key={it.componentId}
                    className={`p-4 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      itemState.isSelected ? 'bg-indigo-50/20' : 'bg-white opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={itemState.isSelected}
                        onChange={() => toggleItemSelection(it.componentId)}
                        disabled={outstandingQty === 0}
                        className="w-4 h-4 mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-extrabold text-slate-900 text-sm">{it.componentName}</h4>
                          {it.componentCode && (
                            <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">
                              {it.componentCode}
                            </span>
                          )}
                          <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.2 rounded">
                            {it.category || 'Component'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                          <span>Approved: <strong className="text-slate-800">{approvedQty}</strong></span>
                          <span>•</span>
                          <span>Prev Issued: <strong className="text-slate-800">{previouslyIssued}</strong></span>
                          <span>•</span>
                          <span>Outstanding: <strong className="text-indigo-700 font-bold">{outstandingQty}</strong></span>
                          <span>•</span>
                          <span className={`font-semibold ${isOutOfStock ? 'text-rose-600' : 'text-emerald-600'}`}>
                            Live Shelf Stock: {availableInStock}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quantity To Issue Stepper */}
                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <div className="text-right">
                        <label className="text-[10px] uppercase font-bold text-slate-400 block">
                          Issue Now
                        </label>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <button
                            type="button"
                            onClick={() => updateItemQty(it.componentId, itemState.quantityToIssue - 1)}
                            disabled={!itemState.isSelected || itemState.quantityToIssue <= 0}
                            className="w-7 h-7 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center font-bold text-xs disabled:opacity-40 cursor-pointer"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0"
                            max={outstandingQty}
                            value={itemState.quantityToIssue}
                            onChange={(e) => updateItemQty(it.componentId, parseInt(e.target.value, 10) || 0)}
                            disabled={!itemState.isSelected}
                            className="w-14 text-center py-1 rounded-lg border border-slate-300 font-mono text-sm font-bold disabled:bg-slate-100 disabled:opacity-50"
                          />
                          <button
                            type="button"
                            onClick={() => updateItemQty(it.componentId, itemState.quantityToIssue + 1)}
                            disabled={!itemState.isSelected || itemState.quantityToIssue >= outstandingQty}
                            className="w-7 h-7 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center font-bold text-xs disabled:opacity-40 cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Schedule & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Return Due Date *
              </label>
              <input
                type="date"
                value={dueDateStr}
                onChange={(e) => setDueDateStr(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono text-slate-800 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-hidden bg-white"
              />
              <p className="text-[10px] text-slate-400 mt-1">Default is 2 months from today (editable)</p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Admin Handover Remarks (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Serial numbers, partial handover note"
                value={handoverNotes}
                onChange={(e) => setHandoverNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-800 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-hidden bg-white"
              />
            </div>
          </div>

          {/* Handover Forecast Alert */}
          <div className={`p-4 rounded-2xl border text-xs leading-relaxed ${
            unitsSelectedNow === totalOutstanding
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}>
            <div className="flex items-start gap-2.5">
              {unitsSelectedNow === totalOutstanding ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div>
                <strong className="block font-bold">
                  {unitsSelectedNow === totalOutstanding 
                    ? 'Full Handover Prepared' 
                    : `Partial Handover Prepared (${totalOutstanding - unitsSelectedNow} units remaining)`}
                </strong>
                <span>
                  {unitsSelectedNow === totalOutstanding 
                    ? 'All outstanding approved components will be checked out to the recipient right now. The request will be marked as Completed.' 
                    : 'Some components will remain unissued. The request status will become "Partially Issued", and the student can present their Request QR again next time to collect the remaining items.'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting || unitsSelectedNow === 0}
              className="flex-1 py-3.5 px-6 rounded-2xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs uppercase tracking-wider shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{isSubmitting ? 'Processing Checkout...' : `Confirm & Issue ${unitsSelectedNow} Component Unit(s)`}</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/scan-request')}
              className="py-3 px-5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all cursor-pointer"
            >
              Cancel
            </button>
          </div>

        </form>

      </div>

      {/* Handover Invoice Slip & PDF Modal */}
      {showInvoiceModal && (
        <IssueInvoiceModal
          request={request}
          onClose={() => setShowInvoiceModal(false)}
        />
      )}
    </div>
  );
}
