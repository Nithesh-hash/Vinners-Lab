import { useState, useEffect } from 'react';
import type { Transaction } from '@/types';
import { generateLoanQR } from '@/utils/qr';
import { X, Maximize2, Minimize2, Copy, Check, QrCode, AlertCircle, ShieldCheck } from 'lucide-react';

interface ReturnQRModalProps {
  transaction: Transaction | null;
  onClose: () => void;
}

export default function ReturnQRModal({ transaction, onClose }: ReturnQRModalProps) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!transaction) return;
    let isMounted = true;
    setLoading(true);

    generateLoanQR(transaction.id)
      .then((dataUrl) => {
        if (isMounted) {
          setQrUrl(dataUrl);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to generate return QR:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [transaction]);

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

  if (!transaction) return null;

  const returned = transaction.returnedQuantity || 0;
  const outstanding = Math.max(0, transaction.quantity - returned);

  const copyLoanId = async () => {
    try {
      await navigator.clipboard.writeText(transaction.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      {isFullscreen ? (
        /* Fullscreen QR Presentation Mode for Fast Scanning */
        <div className="fixed inset-0 z-60 bg-white flex flex-col items-center justify-between p-6 sm:p-10 text-slate-900 select-none">
          <div className="w-full flex items-center justify-between max-w-md">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">LabSlot Return Pass</span>
              <h2 className="text-xl font-extrabold text-slate-900 line-clamp-1">{transaction.componentName}</h2>
            </div>
            <button
              onClick={() => setIsFullscreen(false)}
              className="p-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              title="Exit Fullscreen"
            >
              <Minimize2 className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-col items-center justify-center my-auto">
            <div className="p-4 bg-white rounded-3xl border-4 border-slate-900 shadow-2xl flex items-center justify-center">
              {qrUrl ? (
                <img
                  src={qrUrl}
                  alt="Loan Return QR"
                  className="w-72 h-72 sm:w-88 sm:h-88 object-contain"
                />
              ) : (
                <div className="w-72 h-72 flex items-center justify-center">
                  <div className="w-8 h-8 border-3 border-slate-900 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <div className="mt-6 text-center">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Outstanding Units</p>
              <p className="text-3xl font-black text-slate-900">{outstanding} of {transaction.quantity}</p>
              <p className="text-xs font-mono text-slate-400 mt-1">ID: {transaction.id}</p>
            </div>
          </div>

          <div className="w-full max-w-md text-center">
            <p className="text-xs text-slate-500 font-medium">
              Hold device steady for the Lab Admin scanner
            </p>
            <button
              onClick={() => setIsFullscreen(false)}
              className="mt-3 w-full py-2.5 rounded-xl bg-slate-900 text-white font-semibold text-xs transition-colors hover:bg-slate-800"
            >
              Close Fullscreen
            </button>
          </div>
        </div>
      ) : (
        /* Regular Modal Presentation */
        <div className="relative w-full max-w-md bg-white rounded-3xl border border-slate-200/90 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="p-5 sm:p-6 pb-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base leading-tight">Return Hardware QR</h3>
                <p className="text-xs text-slate-500 font-medium">Present to Lab Admin for return verification</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsFullscreen(true)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                title="Fullscreen for easier scanning"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* QR Code Presentation Area */}
          <div className="p-6 flex flex-col items-center bg-slate-50/50">
            <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-md relative group">
              {loading || !qrUrl ? (
                <div className="w-60 h-60 flex items-center justify-center">
                  <div className="w-8 h-8 border-3 border-slate-900 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <img
                  src={qrUrl}
                  alt={`Return QR for ${transaction.componentName}`}
                  className="w-60 h-60 object-contain block select-none"
                />
              )}
            </div>

            <button
              onClick={() => setIsFullscreen(true)}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Tap for Fullscreen Bright Mode
            </button>
          </div>

          {/* Loan Metadata Beneath QR */}
          <div className="p-5 sm:p-6 pt-4 space-y-3.5 text-xs">
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/70 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Component</span>
                  <span className="text-sm font-extrabold text-slate-900 line-clamp-1">{transaction.componentName}</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-200 bg-emerald-50 text-emerald-700">
                  {transaction.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60">
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Outstanding</span>
                  <p className="text-base font-extrabold text-slate-900">
                    {outstanding} <span className="text-xs text-slate-400 font-normal">/ {transaction.quantity} issued</span>
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Component ID</span>
                  <p className="font-mono text-slate-700 font-bold truncate">{transaction.componentId}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1 text-slate-500 font-mono truncate max-w-[240px]">
                  <span>ID:</span>
                  <span className="truncate">{transaction.id}</span>
                </div>
                <button
                  onClick={copyLoanId}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 px-2 py-0.5 rounded-md hover:bg-white transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-slate-100/70 p-2.5 rounded-xl border border-slate-200/60">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Contains secure, permanent loan transaction reference. No passwords or tokens embedded.</span>
            </div>

            {outstanding === 0 && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>This loan has already been fully returned.</span>
              </div>
            )}
          </div>

          {/* Footer Action */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors shadow-xs"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
