import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { parseLoanId } from '@/utils/qr';
import type { Transaction } from '@/types';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Camera,
  CameraOff,
  Search,
  AlertCircle,
  CheckCircle2,
  QrCode,
  ShieldAlert,
  HelpCircle,
  RotateCcw
} from 'lucide-react';

export default function AdminScanReturn() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [validatedLoan, setValidatedLoan] = useState<Transaction | null>(null);
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
    setValidatedLoan(null);

    // Confirm admin role
    if (profile?.role !== 'admin') {
      setStatusMessage({ type: 'error', text: 'Unauthorized: Only lab administrators can scan and process returns.' });
      return;
    }

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode('qr-reader-viewport');
      }

      await scannerRef.current.start(
        { facingMode: 'environment' }, // Prefer rear camera on mobile
        {
          fps: 12,
          qrbox: { width: 260, height: 260 },
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
        setScannerError('No camera detected on this device. You can use the manual loan ID lookup below.');
      } else {
        setScannerError(`Camera error: ${err?.message || 'Unable to start camera stream'}. Try manual lookup.`);
      }
    }
  };

  const handleScannedCode = async (rawCode: string) => {
    // Prevent duplicate triggers while processing
    if (isProcessing) return;
    setIsProcessing(true);

    // Stop scanner camera stream
    await stopScanner();

    await processLoanLookup(rawCode);
    setIsProcessing(false);
  };

  const processLoanLookup = async (input: string) => {
    setStatusMessage(null);
    setValidatedLoan(null);

    const loanId = parseLoanId(input);
    if (!loanId) {
      setStatusMessage({
        type: 'error',
        text: 'Invalid or unrecognized loan QR. The scanned code does not contain a valid LabSlot transaction reference.'
      });
      return;
    }

    try {
      // Fetch transaction from Firestore
      const txDocRef = doc(db, 'transactions', loanId);
      const txSnap = await getDoc(txDocRef);

      if (!txSnap.exists()) {
        setStatusMessage({
          type: 'error',
          text: `Loan "${loanId}" was not found in the database. Please verify the ID or check with the student.`
        });
        return;
      }

      const txData = { id: txSnap.id, ...txSnap.data() } as Transaction;
      const returned = txData.returnedQuantity || 0;
      const outstanding = txData.quantity - returned;

      if (txData.status === 'Returned' || outstanding <= 0) {
        setValidatedLoan(txData);
        setStatusMessage({
          type: 'warning',
          text: 'This loan has already been fully returned. All issued units were previously checked in.'
        });
        return;
      }

      // Valid loan with outstanding units: Navigate to Return Loan confirmation page
      navigate(`/admin/return-loan?id=${encodeURIComponent(loanId)}`);
    } catch (err: any) {
      console.error('Error looking up loan:', err);
      setStatusMessage({
        type: 'error',
        text: `Error validating loan: ${err?.message || 'Database error occurred'}.`
      });
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    setIsProcessing(true);
    await processLoanLookup(manualInput.trim());
    setIsProcessing(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/80 mb-2">
            <QrCode className="w-3.5 h-3.5 text-slate-600" />
            <span>Fast Return Processing</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Scan Student Return QR
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Point camera at student's return QR pass or enter transaction ID for instant check-in.
          </p>
        </div>
      </div>

      {/* Main Scanner Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left / Center: Camera Viewport */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Camera Feed
              </span>
              {isScanning && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Active Scanner
                </span>
              )}
            </div>

            {/* Viewport Box */}
            <div className="relative w-full aspect-square max-w-[340px] mx-auto bg-slate-900 rounded-2xl overflow-hidden border-2 border-slate-800 shadow-inner flex flex-col items-center justify-center text-white">
              {/* html5-qrcode mounts here */}
              <div id="qr-reader-viewport" className="w-full h-full" />

              {/* Placeholder when camera is inactive */}
              {!isScanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-900/95 z-10">
                  <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 mb-3 border border-slate-700">
                    <Camera className="w-8 h-8" />
                  </div>
                  <h3 className="font-bold text-white text-sm mb-1">Camera Standby</h3>
                  <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                    Press "Start Scanner" to request camera permission and begin scanning student return codes.
                  </p>
                </div>
              )}

              {/* Overlay targeting frame when active */}
              {isScanning && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
                  <div className="w-56 h-56 border-2 border-emerald-400/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] relative animate-pulse">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-3 border-l-3 border-emerald-400 rounded-tl-sm"></div>
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-3 border-r-3 border-emerald-400 rounded-tr-sm"></div>
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-3 border-l-3 border-emerald-400 rounded-bl-sm"></div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-3 border-r-3 border-emerald-400 rounded-br-sm"></div>
                  </div>
                </div>
              )}
            </div>

            {/* Camera controls */}
            <div className="mt-5 flex flex-col sm:flex-row items-center gap-3">
              {!isScanning ? (
                <button
                  onClick={startScanner}
                  disabled={isProcessing}
                  className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  Start Scanner
                </button>
              ) : (
                <button
                  onClick={stopScanner}
                  className="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <CameraOff className="w-4 h-4" />
                  Stop Scanner
                </button>
              )}
            </div>

            {/* Error banner for camera permissions */}
            {scannerError && (
              <div className="mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">{scannerError}</p>
                  <p className="text-[11px] text-rose-600/90 mt-1">
                    Tip: On mobile browsers (Chrome / Safari), ensure camera permission is set to "Allow" in site settings.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Rear camera is preferred by default on compatible mobile devices.</span>
          </div>
        </div>

        {/* Right: Manual Lookup & Status Feedback */}
        <div className="lg:col-span-5 space-y-6">
          {/* Manual Input Fallback */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs">
            <div className="flex items-center gap-2 mb-2">
              <Search className="w-4 h-4 text-slate-600" />
              <h2 className="text-sm font-bold text-slate-900">Manual Loan ID Lookup</h2>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              If camera access is unavailable, paste the loan ID or URL directly from the student's return pass.
            </p>

            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                  Loan ID or QR Link
                </label>
                <input
                  type="text"
                  placeholder="e.g. 7m4k9... or labslot:loan:..."
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isProcessing || !manualInput.trim()}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5" />
                    Lookup Loan Record
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Feedback & Alert Box */}
          {statusMessage && (
            <div
              className={`p-4 rounded-2xl border text-xs animate-in fade-in duration-200 ${
                statusMessage.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : statusMessage.type === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-blue-50 border-blue-200 text-blue-800'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {statusMessage.type === 'error' ? (
                  <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-bold">{statusMessage.text}</p>
                </div>
              </div>
            </div>
          )}

          {/* Already Returned Loan Card preview */}
          {validatedLoan && validatedLoan.status === 'Returned' && (
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 text-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">{validatedLoan.componentName}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Returned
                </span>
              </div>
              <p className="text-slate-500">
                Student: <strong>{validatedLoan.studentName}</strong> ({validatedLoan.studentRegNumber})
              </p>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                <span>Total Units: {validatedLoan.quantity}</span>
                <span>All units returned</span>
              </div>
              <button
                onClick={() => {
                  setValidatedLoan(null);
                  setStatusMessage(null);
                  setManualInput('');
                }}
                className="mt-2 w-full py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Clear & Scan Another
              </button>
            </div>
          )}

          {/* Instructions Box */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs text-xs space-y-2.5 text-slate-600">
            <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Scan Protocol
            </h3>
            <ul className="space-y-1.5 list-disc list-inside text-slate-500">
              <li>Scanning automatically fetches current loan details from Firestore.</li>
              <li>Returns are not submitted automatically upon scan.</li>
              <li>You will review the student identity and select condition on the Return Loan page.</li>
              <li>Damaged or incomplete components can be segregated without re-stocking.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
