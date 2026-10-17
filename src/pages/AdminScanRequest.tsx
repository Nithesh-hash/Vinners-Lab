import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { parseRequestId } from '@/utils/qr';
import type { IssueRequest } from '@/types';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Camera,
  CameraOff,
  Search,
  AlertCircle,
  CheckCircle2,
  QrCode,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

export default function AdminScanRequest() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'warning' | 'info'; text: string } | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStoppingRef = useRef(false);

  // Stop scanner when leaving page
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(() => {});
          }
        } catch {
          // Ignore cleanup errors on unmount
        }
      }
    };
  }, []);

  const stopScanner = async () => {
    if (scannerRef.current && isScanning && !isStoppingRef.current) {
      isStoppingRef.current = true;
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.warn('Scanner stop warning:', err);
      } finally {
        setIsScanning(false);
        isStoppingRef.current = false;
      }
    } else {
      setIsScanning(false);
    }
  };

  const startScanner = async () => {
    setStatusMessage(null);
    setScannerError(null);

    // Confirm admin role
    if (profile?.role !== 'admin') {
      setStatusMessage({ type: 'error', text: 'Unauthorized: Only lab administrators can scan and process issue requests.' });
      return;
    }

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode('qr-request-reader-viewport');
      }

      await scannerRef.current.start(
        { facingMode: 'environment' }, // Prefer rear camera on mobile / barcode scanner
        {
          fps: 12,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const qrEdge = Math.max(160, Math.floor(minEdge * 0.72));
            return { width: qrEdge, height: qrEdge };
          },
          aspectRatio: 1.0
        },
        async (decodedText) => {
          // Successful QR scan detected
          await handleScannedCode(decodedText);
        },
        () => {
          // Frame parse error - ignore standard noise between frames
        }
      );

      setIsScanning(true);
    } catch (err: any) {
      console.error('Camera initialization failed:', err);
      setIsScanning(false);
      
      const errString = String(err).toLowerCase();
      if (errString.includes('notallowederror') || errString.includes('permission denied')) {
        setScannerError('Camera access was blocked by browser. Please grant camera permission in your site settings or use manual lookup.');
      } else if (errString.includes('notfounderror') || errString.includes('no camera')) {
        setScannerError('No camera detected on this device. You can use the manual Request ID lookup below.');
      } else {
        setScannerError(`Camera error: ${err?.message || 'Unable to start camera stream'}. Try manual lookup.`);
      }
    }
  };

  const handleScannedCode = async (rawCode: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    // Stop scanner camera stream
    await stopScanner();

    await processRequestLookup(rawCode);
    setIsProcessing(false);
  };

  const processRequestLookup = async (input: string) => {
    setStatusMessage(null);

    const parsedId = parseRequestId(input);
    if (!parsedId) {
      setStatusMessage({
        type: 'error',
        text: 'Invalid or unrecognized request QR code. The scanned QR does not contain a valid Lab Issue Request reference.'
      });
      return;
    }

    try {
      // 1. Try finding by document ID
      let reqSnap = await getDoc(doc(db, 'issue_requests', parsedId));
      let reqId = parsedId;

      // 2. If not found, try searching by requestCode (e.g. REQ2026-27-0001)
      if (!reqSnap.exists()) {
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const qCode = query(collection(db, 'issue_requests'), where('requestCode', '==', parsedId.toUpperCase()));
        const snapCode = await getDocs(qCode);
        if (!snapCode.empty) {
          reqSnap = snapCode.docs[0];
          reqId = reqSnap.id;
        }
      }

      if (!reqSnap.exists()) {
        setStatusMessage({
          type: 'error',
          text: `Issue Request "${parsedId}" was not found in the database. Please verify the code with the student.`
        });
        return;
      }

      const reqData = { id: reqSnap.id, ...reqSnap.data() } as IssueRequest;

      if (reqData.status === 'completed') {
        setStatusMessage({
          type: 'warning',
          text: `Request ${reqData.requestCode} has already been completely fulfilled. All approved units were previously checked out.`
        });
        // Still allow admin to view details if they choose
      }

      if (reqData.status === 'rejected') {
        setStatusMessage({
          type: 'error',
          text: `Request ${reqData.requestCode} was declined previously: "${reqData.rejectionReason || 'Declined by admin'}".`
        });
        return;
      }

      // Valid request -> navigate to Handover & Checkout Console
      navigate(`/admin/process-request?id=${encodeURIComponent(reqId)}`);
    } catch (err: any) {
      console.error('Error validating issue request:', err);
      setStatusMessage({
        type: 'error',
        text: `Error validating request: ${err?.message || 'Database error occurred'}.`
      });
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    setIsProcessing(true);
    await processRequestLookup(manualInput.trim());
    setIsProcessing(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-4xl mx-auto pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80 mb-2">
            <QrCode className="w-3.5 h-3.5 text-indigo-600" />
            <span>Dedicated Hardware Request Scanner</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Scan Student Issue Request QR
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Point camera at the student or teacher's Request QR pass to open the component checkout console.
          </p>
        </div>
      </div>

      {/* Status Messages */}
      {statusMessage && (
        <div
          className={`p-4 rounded-2xl border text-xs sm:text-sm flex items-start gap-3 animate-in slide-in-from-top-2 duration-200 ${
            statusMessage.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : statusMessage.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {statusMessage.type === 'error' ? (
            <ShieldAlert className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
          ) : statusMessage.type === 'warning' ? (
            <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
          )}
          <div className="flex-1">
            <span className="font-semibold block">{statusMessage.text}</span>
          </div>
        </div>
      )}

      {/* Scanner Error */}
      {scannerError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
          <div>
            <strong className="block font-bold">Camera Initialization Notice</strong>
            <span>{scannerError}</span>
          </div>
        </div>
      )}

      {/* Main Scanner Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden p-6 sm:p-8">
        <div className="max-w-md mx-auto space-y-6 text-center">
          
          {/* Camera Viewport Area */}
          <div className="relative rounded-3xl overflow-hidden bg-slate-950 aspect-square flex flex-col items-center justify-center border-4 border-slate-900 shadow-inner">
            <div id="qr-request-reader-viewport" className="w-full h-full" />

            {!isScanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-white text-center bg-slate-950/90 backdrop-blur-xs space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-400/30 shadow-lg">
                  <Camera className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold">Camera Scanner Idle</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                    Click Start Camera to read the student's Pickup QR code in real-time.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={startScanner}
                  disabled={isProcessing}
                  className="px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/30 transition-all cursor-pointer flex items-center gap-2 active:scale-95"
                >
                  <Camera className="w-4 h-4" />
                  <span>Start Camera Scanner</span>
                </button>
              </div>
            )}

            {isScanning && (
              <div className="absolute bottom-4 left-4 right-4 flex justify-center pointer-events-auto">
                <button
                  type="button"
                  onClick={stopScanner}
                  className="px-4 py-2 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-semibold backdrop-blur-md border border-white/20 transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <CameraOff className="w-3.5 h-3.5" />
                  <span>Stop Camera</span>
                </button>
              </div>
            )}
          </div>

          {/* Separation Callout */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Looking for Hardware Returns?</span>
            <button
              type="button"
              onClick={() => navigate('/admin/scan')}
              className="text-indigo-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Switch to Return Scanner</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-slate-400 font-bold tracking-wider">
                OR ENTER REQUEST CODE MANUALLY
              </span>
            </div>
          </div>

          {/* Manual Input Form */}
          <form onSubmit={handleManualSubmit} className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="e.g. REQ2026-27-0001 or ID"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                disabled={isProcessing}
                className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 text-sm font-mono transition-all outline-hidden bg-slate-50/50"
              />
            </div>
            <button
              type="submit"
              disabled={isProcessing || !manualInput.trim()}
              className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-black text-white font-bold text-xs uppercase tracking-wider shadow-xs transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              <Search className="w-4 h-4" />
              <span>{isProcessing ? 'Verifying Request...' : 'Lookup & Checkout'}</span>
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
