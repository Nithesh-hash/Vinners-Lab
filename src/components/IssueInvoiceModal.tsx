import { useState } from 'react';
import type { IssueRequest } from '@/types';
import { downloadIssueInvoicePDF } from '@/utils/pdfInvoice';
import { 
  X, 
  Download, 
  Printer, 
  FileText, 
  ShieldCheck, 
  Package
} from 'lucide-react';

interface IssueInvoiceModalProps {
  request: IssueRequest | null;
  onClose: () => void;
}

function formatDate(timestamp: any): string {
  if (!timestamp) return new Date().toLocaleDateString('en-GB');
  try {
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds ? timestamp.seconds * 1000 : timestamp);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return new Date().toLocaleDateString('en-GB');
  }
}

export default function IssueInvoiceModal({ request, onClose }: IssueInvoiceModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  if (!request) return null;

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await downloadIssueInvoicePDF(request);
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('Could not generate PDF. You can also use the Print button.');
    } finally {
      setTimeout(() => setIsDownloading(false), 800);
    }
  };

  /**
   * Completely isolated print handler.
   * Renders ONLY the #printable-invoice-slip in a hidden iframe so the parent dashboard
   * and background elements are 100% excluded from the print preview.
   */
  const handlePrint = () => {
    const printContent = document.getElementById('printable-invoice-slip');
    if (!printContent) {
      window.print();
      return;
    }

    // Remove any leftover iframe
    const oldIframe = document.getElementById('invoice-print-frame');
    if (oldIframe) {
      oldIframe.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'invoice-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    // Clone all stylesheets and styles from current document
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map(el => el.outerHTML)
      .join('\n');

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Vinner Lab - Invoice ${request.requestCode || request.id}</title>
          ${styles}
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
            body {
              background: #ffffff !important;
              margin: 0 !important;
              padding: 0 !important;
              color: #000000 !important;
              font-family: Inter, system-ui, -apple-system, sans-serif !important;
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          </style>
        </head>
        <body>
          <div class="p-2 sm:p-4 bg-white">
            ${printContent.innerHTML}
          </div>
        </body>
      </html>
    `);
    doc.close();

    const triggerPrint = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        try {
          if (iframe.parentNode) {
            document.body.removeChild(iframe);
          }
        } catch {}
      }, 2000);
    };

    // Ensure images like /logo.png are loaded before launching print dialog
    const img = iframe.contentWindow?.document.querySelector('img');
    if (img && !img.complete) {
      img.onload = () => setTimeout(triggerPrint, 150);
      img.onerror = () => triggerPrint();
    } else {
      setTimeout(triggerPrint, 250);
    }
  };

  const totalApproved = request.items.reduce((acc, it) => acc + (it.approvedQuantity ?? it.requestedQuantity), 0);
  const totalIssued = request.items.reduce((acc, it) => acc + (it.unitsIssuedSoFar || it.issuedQuantity || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-300 animate-in zoom-in-95 duration-200 print:shadow-none print:border-none print:max-h-none print:w-full">
        
        {/* Modal Controls Bar (Hidden during Print) */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-100 shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                Official Hardware Handover Slip
              </h3>
              <p className="text-xs text-slate-600 font-mono">Invoice Reference: {request.requestCode}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="py-2 px-3 sm:px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Print only this invoice slip"
            >
              <Printer className="w-4 h-4 text-slate-700" />
              <span className="hidden sm:inline">Print Slip</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className="py-2 px-4 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-white" />
              <span>{isDownloading ? 'Generating...' : 'Download PDF'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors ml-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Document Body (Identified by #printable-invoice-slip for print isolation) */}
        <div 
          id="printable-invoice-slip" 
          className="p-6 sm:p-8 overflow-y-auto space-y-6 text-slate-900 font-sans print:p-0 print:space-y-4 bg-white"
        >
          
          {/* Top Institutional Header with Vinner Lab Symbol */}
          <div className="border-b-2 border-slate-900 pb-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                {/* Official Vinner Lab Symbol */}
                <img 
                  src="/logo.png" 
                  alt="Vinner Lab Logo" 
                  className="w-13 h-13 rounded-2xl object-cover shrink-0 border border-slate-300 shadow-xs bg-white p-0.5" 
                />
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    VINNER LABORATORY & INNOVATION CENTER
                  </h1>
                  <p className="text-xs text-slate-600 mt-0.5 font-medium">
                    Central Hardware Inventory, Microelectronics & Embedded Systems Facility
                  </p>
                </div>
              </div>

              {/* Invoice Reference Badge (Clean Pure White, Crisp Border) */}
              <div className="bg-white border-2 border-slate-900 p-3.5 rounded-xl text-left sm:text-right sm:min-w-52 shrink-0">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">OFFICIAL INVOICE NO.</span>
                <span className="font-mono text-base font-black text-slate-900 block mt-0.5">
                  {request.requestCode}
                </span>
                <span className="text-[11px] text-slate-600 block mt-1">
                  Issue Date: {formatDate(request.createdAt)}
                </span>
              </div>
            </div>
          </div>

          {/* Document Subheader */}
          <div className="flex items-center justify-between text-xs border-b border-slate-200 pb-2">
            <h2 className="font-bold text-slate-900 uppercase tracking-wider">
              HARDWARE ISSUE INVOICE & HANDOVER RECEIPT
            </h2>
            <span className="text-slate-600 font-medium">
              {request.status === 'completed'
                ? 'Status: Fully Handed Over'
                : request.status === 'partially_issued'
                ? 'Status: Partially Handed Over'
                : 'Status: Approved for Collection'}
            </span>
          </div>

          {/* Student / Faculty Recipient & Project Details (Clean White Card) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-slate-300 text-xs">
            {/* Column 1: Recipient Details */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Borrower / Recipient Credentials
              </span>
              <p className="text-sm font-bold text-slate-900">
                {request.recipientName || request.requesterName}
              </p>
              <p className="text-slate-700">
                <strong>Reg / Emp No:</strong> {request.recipientRegNumber || request.requesterRegNumber}
              </p>
              <p className="text-slate-700">
                <strong>Role:</strong> {request.recipientType === 'faculty' ? 'Teacher / Faculty Advisor' : 'Student'}
              </p>
              {request.studentCode && request.recipientType !== 'faculty' && (
                <p className="text-slate-700 font-mono">
                  <strong>Unique Student Code:</strong> {request.studentCode}
                </p>
              )}
              {request.requesterEmail && (
                <p className="text-slate-700">
                  <strong>Email:</strong> {request.requesterEmail}
                </p>
              )}
              {request.requesterMobile && (
                <p className="text-slate-700">
                  <strong>Phone / Mobile:</strong> {request.requesterMobile}
                </p>
              )}
            </div>

            {/* Column 2: Authorization & Project Details */}
            <div className="space-y-1.5 border-t sm:border-t-0 sm:border-l border-slate-300 pt-3 sm:pt-0 sm:pl-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Authorization & Project Context
              </span>
              <p className="text-slate-900 font-bold">
                {request.projectCode ? `Project Team Code (${request.projectCode})` : 'Personal Account Issue'}
              </p>
              <p className="text-slate-700">
                <strong>Authorized By:</strong> {request.approvedByAdminName || 'Lab Administrator'}
              </p>
              <p className="text-slate-700">
                <strong>Requester:</strong> {request.requesterName} ({request.requesterRegNumber})
              </p>
              {request.purposeNotes && (
                <p className="text-slate-700 italic">
                  <strong>Purpose:</strong> "{request.purposeNotes}"
                </p>
              )}
            </div>
          </div>

          {/* Components Specification Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Package className="w-4 h-4 text-slate-700" />
              <span>Issued Hardware Components Specification</span>
            </h4>

            <div className="overflow-x-auto rounded-xl border border-slate-300 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-white font-bold text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">S.No</th>
                    <th className="py-2.5 px-3 w-28">Code</th>
                    <th className="py-2.5 px-3">Component Description</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-right">Qty (Units)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {request.items.map((item, idx) => {
                    const qty = (item.unitsIssuedSoFar && item.unitsIssuedSoFar > 0)
                      ? item.unitsIssuedSoFar
                      : (item.approvedQuantity ?? item.requestedQuantity);
                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 text-center text-slate-500">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {item.componentCode || `IIC-C${idx + 1}`}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {item.componentName}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{item.category || 'Hardware'}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                          {qty} unit{qty > 1 ? 's' : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-white font-bold text-xs border-t-2 border-slate-900">
                  <tr>
                    <td colSpan={4} className="py-2.5 px-3 text-slate-900">
                      TOTAL ALLOCATED: {request.items.length} item type(s)
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-900">
                      {totalIssued > 0 ? `${totalIssued} Units Issued` : `${totalApproved} Units Approved`}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Official Undertaking / Terms & Conditions (Clean White Box, Solid Crisp Border) */}
          <div className="p-4 rounded-xl bg-white border-2 border-slate-900 text-xs text-slate-900 space-y-1.5 leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] text-slate-900">
              <ShieldCheck className="w-4 h-4 text-slate-800 shrink-0" />
              <span>Terms of Loan & Borrower Declaration</span>
            </div>
            <p className="text-[11px] text-slate-800">
              I hereby solemnly declare that I have received the laboratory hardware components listed above in working and undamaged physical condition. 
              I undertake full custody and responsibility for the safe handling, maintenance, and timely return of these items on or before the designated return date. 
              In the event of loss, theft, physical damage, component burnout, or failure to return, I hereby agree and undertake to either replace the damaged/lost component with an identical genuine model or return the equivalent financial amount as determined by the laboratory administration.
            </p>
            <p className="text-[10px] font-bold text-slate-900 pt-1 border-t border-slate-200">
              Note: Components must be returned with all original cables, pins, and accessories in intact condition.
            </p>
          </div>

          {/* Physical Signatures Section (at bottom right for Faculty/Student) */}
          <div className="pt-8 flex flex-col sm:flex-row items-end justify-between gap-8 text-xs">
            {/* Left: Lab Administrator Signature */}
            <div className="space-y-2 w-full sm:w-60">
              <div className="border-b-2 border-slate-900 pb-1 h-12 flex items-end">
                <span className="text-[10px] text-slate-400 italic">Authorized Signature / Seal</span>
              </div>
              <p className="font-bold text-slate-900">Signature of Lab Admin / In-Charge</p>
              <p className="text-[11px] text-slate-600">Name: {request.approvedByAdminName || 'Lab Administrator'}</p>
              <p className="text-[11px] text-slate-600">Date: {formatDate(new Date())}</p>
            </div>

            {/* Right: Signature of Faculty / Student */}
            <div className="space-y-2 w-full sm:w-64 text-left sm:text-right">
              <div className="border-b-2 border-slate-900 pb-1 h-12 flex items-end justify-start sm:justify-end">
                <span className="text-[10px] text-slate-400 italic">Sign above this line on printout</span>
              </div>
              <p className="font-bold text-slate-900">Signature of Faculty / Student</p>
              <p className="text-[11px] text-slate-600">Name: {request.recipientName || request.requesterName}</p>
              <p className="text-[11px] text-slate-600">Reg / Emp ID: {request.recipientRegNumber || request.requesterRegNumber}</p>
            </div>
          </div>

          {/* Footer Notice */}
          <div className="pt-4 border-t border-slate-200 text-center text-[10px] text-slate-500">
            This is an official laboratory handover invoice. Keep a physical signed copy for laboratory audit and return verification.
          </div>

        </div>

      </div>
    </div>
  );
}
