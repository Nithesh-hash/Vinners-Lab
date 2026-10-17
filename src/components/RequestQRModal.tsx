import { useState, useEffect } from 'react';
import type { IssueRequest } from '@/types';
import { generateRequestQR } from '@/utils/qr';
import { downloadIssueInvoicePDF } from '@/utils/pdfInvoice';
import { 
  X, 
  Maximize2, 
  Minimize2, 
  Copy, 
  Check, 
  QrCode, 
  AlertCircle, 
  ShieldCheck, 
  Package, 
  CheckCircle2,
  FileText
} from 'lucide-react';

interface RequestQRModalProps {
  request: IssueRequest | null;
  onClose: () => void;
}

export default function RequestQRModal({ request, onClose }: RequestQRModalProps) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!request) return;
    let isMounted = true;
    setLoading(true);

    generateRequestQR(request.id)
      .then((dataUrl) => {
        if (isMounted) {
          setQrUrl(dataUrl);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to generate request QR:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [request]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, onClose]);

  if (!request) return null;

  const totalApproved = request.items.reduce((acc, it) => acc + (it.approvedQuantity ?? it.requestedQuantity), 0);
  const totalIssued = request.items.reduce((acc, it) => acc + (it.issuedQuantity || 0), 0);
  const remainingTotal = Math.max(0, totalApproved - totalIssued);

  const copyRequestId = async () => {
    try {
      await navigator.clipboard.writeText(request.requestCode || request.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
      {isFullscreen ? (
        /* Fullscreen Presentation Mode for fast counter camera scanning */
        <div className="fixed inset-0 z-60 bg-white flex flex-col items-center justify-between p-4 sm:p-8 text-slate-900 select-none overflow-y-auto">
          <div className="w-full flex items-center justify-between max-w-md">
            <div className="pr-2 min-w-0">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
                Vinner Lab • Issue Pickup Pass
              </span>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 truncate">
                {request.requestCode}
              </h2>
            </div>
            <button
              onClick={() => setIsFullscreen(false)}
              className="p-2 sm:p-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shrink-0 cursor-pointer"
              title="Exit Fullscreen"
            >
              <Minimize2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>

          <div className="flex flex-col items-center justify-center my-auto py-4">
            <div className="p-3 sm:p-4 bg-white rounded-3xl border-3 sm:border-4 border-slate-900 shadow-2xl flex items-center justify-center max-w-[85vw] max-h-[55vh]">
              {qrUrl ? (
                <img
                  src={qrUrl}
                  alt="Request Pickup QR"
                  className="w-56 h-56 sm:w-80 sm:h-80 max-w-[75vw] max-h-[50vh] object-contain"
                />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center">
                  <div className="w-8 h-8 border-3 border-slate-900 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <p className="font-mono text-xs sm:text-sm font-extrabold text-slate-900 mt-4 tracking-widest uppercase">
              {request.requestCode}
            </p>
            <p className="text-xs text-slate-500 font-medium mt-1">
              {request.recipientName || request.requesterName} ({request.recipientRegNumber || request.requesterRegNumber})
            </p>
          </div>

          <div className="w-full max-w-md text-center pt-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Present this QR to Lab Admin to collect hardware</span>
            </div>
          </div>
        </div>
      ) : (
        /* Standard Modal Mode */
        <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/90 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
                <QrCode className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                  Hardware Pickup Pass
                </h3>
                <p className="text-[11px] text-slate-500 font-mono">
                  {request.requestCode}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsFullscreen(true)}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 transition-all cursor-pointer"
                title="Fullscreen QR for Easy Scan"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white border border-transparent hover:border-slate-200 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-center">
            {/* Status Pill */}
            <div className="flex items-center justify-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold ${
                request.status === 'completed'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : request.status === 'partially_issued'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              }`}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>
                  {request.status === 'completed' 
                    ? 'Fully Issued' 
                    : request.status === 'partially_issued'
                    ? 'Partially Issued'
                    : 'Approved — Ready for Pickup'}
                </span>
              </span>
            </div>

            {/* QR Code Container */}
            <div className="flex flex-col items-center justify-center">
              <div className="p-3 bg-white rounded-2xl border-2 border-slate-900 shadow-md inline-block">
                {loading ? (
                  <div className="w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center">
                    <div className="w-8 h-8 border-3 border-slate-900 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : qrUrl ? (
                  <img
                    src={qrUrl}
                    alt="Pickup QR Pass"
                    className="w-48 h-48 sm:w-56 sm:h-56 object-contain"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-xs text-rose-500">
                    Failed to render QR
                  </div>
                )}
              </div>

              {/* Pass ID with copy button */}
              <div className="flex items-center gap-2 mt-3 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80">
                <span className="font-mono text-xs font-bold text-slate-800">
                  {request.requestCode}
                </span>
                <button
                  onClick={copyRequestId}
                  className="p-1 hover:text-slate-900 text-slate-400 transition-colors cursor-pointer"
                  title="Copy Code"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Requester & Recipient Info */}
            <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/70 text-left text-xs space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-semibold uppercase text-[10px]">Recipient</span>
                <span className="font-bold text-slate-900">
                  {request.recipientName || request.requesterName}
                </span>
              </div>
              <div className="flex justify-between items-center font-mono text-[11px]">
                <span className="text-slate-400 font-sans font-semibold uppercase text-[10px]">ID / Reg No</span>
                <span className="text-slate-700">
                  {request.recipientRegNumber || request.requesterRegNumber}
                </span>
              </div>
              {request.projectCode && (
                <div className="flex justify-between items-center font-mono text-[11px] pt-1 border-t border-slate-200/60">
                  <span className="text-slate-400 font-sans font-semibold uppercase text-[10px]">Project Code</span>
                  <span className="text-indigo-700 font-bold">{request.projectCode}</span>
                </div>
              )}
            </div>

            {/* Approved Items Summary */}
            <div className="text-left space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span className="flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-slate-500" />
                  Approved Hardware ({request.items.length})
                </span>
                <span className="text-[11px] text-slate-500">
                  {totalIssued} of {totalApproved} units collected ({remainingTotal} pending)
                </span>
              </div>

              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 overflow-hidden bg-white">
                {request.items.map((item, idx) => {
                  const approved = item.approvedQuantity ?? item.requestedQuantity;
                  const issued = item.issuedQuantity || 0;
                  const outstanding = Math.max(0, approved - issued);
                  return (
                    <div key={idx} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50/50">
                      <div>
                        <p className="font-bold text-slate-900 leading-tight">{item.componentName}</p>
                        {item.componentCode && (
                          <span className="font-mono text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded mt-0.5 inline-block">
                            {item.componentCode}
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-900">
                          {outstanding > 0 ? `${outstanding} to collect` : 'All Collected'}
                        </span>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {issued} / {approved} units
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Counter Instructions Callout */}
            <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200 text-left text-xs text-amber-900 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Contact Lab Administrator</p>
                <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                  Visit the laboratory checkout desk and present this QR pass. The administrator will verify and hand over your hardware. If any item is currently pending, you can scan this QR again next time!
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-wrap sm:flex-nowrap gap-2 shrink-0">
            <button
              type="button"
              onClick={() => downloadIssueInvoicePDF(request)}
              className="py-2.5 px-3.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
              title="Download official PDF invoice and handover slip"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              <span>Invoice PDF</span>
            </button>
            <button
              onClick={() => setIsFullscreen(true)}
              className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Fullscreen QR
            </button>
            <button
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
