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
   * Completely isolated, single-page A4 print engine.
   * Renders the invoice in an isolated frame with dedicated, self-contained CSS rules.
   * Calibrated strictly to fit on EXACTLY 1 PAGE without background bleed or blank pages.
   */
  const handlePrint = () => {
    const printContent = document.getElementById('printable-invoice-slip');
    if (!printContent) {
      window.print();
      return;
    }

    // Remove any leftover iframe
    const oldIframe = document.getElementById('invoice-print-frame');
    if (oldIframe) oldIframe.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'invoice-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = '800px';
    iframe.style.height = '1100px';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Vinner Lab - Invoice ${request.requestCode || request.id}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 7mm 9mm;
            }
            * {
              box-sizing: border-box !important;
              margin: 0;
              padding: 0;
              visibility: visible !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              background: #ffffff !important;
              color: #000000 !important;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
              font-size: 10px;
              line-height: 1.35;
              width: 100%;
              height: 100%;
            }
            .invoice-page {
              width: 100%;
              max-width: 192mm;
              margin: 0 auto;
              background: #ffffff !important;
              page-break-inside: avoid !important;
              page-break-after: avoid !important;
              break-inside: avoid !important;
            }
            .header-bar {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #000000;
              padding-bottom: 6px;
              margin-bottom: 8px;
            }
            .logo-group {
              display: flex;
              align-items: center;
              gap: 10px;
            }
            .logo-img {
              width: 44px;
              height: 44px;
              border-radius: 8px;
              border: 1px solid #cccccc;
              object-fit: contain;
            }
            .inst-title {
              font-size: 15px;
              font-weight: 900;
              letter-spacing: -0.2px;
              color: #000000;
            }
            .inst-sub {
              font-size: 8px;
              color: #444444;
              margin-top: 1px;
            }
            .invoice-badge {
              border: 2px solid #000000;
              padding: 4px 10px;
              border-radius: 6px;
              text-align: right;
              min-width: 150px;
              background: #ffffff;
            }
            .invoice-badge-label {
              font-size: 7.5px;
              font-weight: bold;
              color: #666666;
              text-transform: uppercase;
            }
            .invoice-badge-num {
              font-family: monospace;
              font-size: 12px;
              font-weight: 900;
              color: #000000;
              margin: 1px 0;
            }
            .invoice-badge-date {
              font-size: 8px;
              color: #444444;
            }
            .sub-bar {
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 9px;
              border-bottom: 1px solid #dddddd;
              padding-bottom: 4px;
              margin-bottom: 8px;
            }
            .creds-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
              border: 1px solid #cccccc;
              border-radius: 6px;
              padding: 8px 10px;
              margin-bottom: 8px;
              font-size: 9.5px;
              background: #ffffff;
            }
            .creds-col-label {
              font-size: 7.5px;
              font-weight: bold;
              color: #666666;
              text-transform: uppercase;
              margin-bottom: 3px;
              display: block;
            }
            .table-sec {
              margin-bottom: 8px;
            }
            .sec-heading {
              font-size: 8.5px;
              font-weight: bold;
              text-transform: uppercase;
              margin-bottom: 3px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 9.5px;
              border: 1px solid #cccccc;
              border-radius: 6px;
              overflow: hidden;
            }
            th {
              background: #0f172a;
              color: #ffffff;
              padding: 5px 6px;
              text-align: left;
              font-size: 8px;
              font-weight: bold;
            }
            td {
              padding: 4.5px 6px;
              border-bottom: 1px solid #eeeeee;
              background: #ffffff;
            }
            tfoot tr td {
              border-top: 2px solid #000000;
              font-weight: bold;
              padding: 5px 6px;
              background: #fafafa;
            }
            .terms-box {
              border: 1.5px solid #000000;
              border-radius: 6px;
              padding: 7px 9px;
              font-size: 8.5px;
              line-height: 1.35;
              margin-bottom: 8px;
              background: #ffffff;
            }
            .sig-section {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              padding-top: 8px;
              font-size: 9px;
            }
            .sig-box {
              width: 200px;
            }
            .sig-box-right {
              width: 210px;
              text-align: right;
            }
            .sig-line {
              border-bottom: 1.5px solid #000000;
              height: 26px;
              margin-bottom: 4px;
            }
            .footer-txt {
              text-align: center;
              font-size: 7.5px;
              color: #666666;
              margin-top: 6px;
              padding-top: 4px;
              border-top: 1px solid #eeeeee;
            }
          </style>
        </head>
        <body>
          <div class="invoice-page">
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

    // Ensure image is loaded before opening the print preview
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
        <div className="p-3.5 sm:p-4 border-b border-slate-200 flex items-center justify-between bg-slate-100 shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">
                Official Hardware Handover Slip
              </h3>
              <p className="text-[11px] text-slate-600 font-mono">Invoice Reference: {request.requestCode}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="py-1.5 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Print 1-page official slip"
            >
              <Printer className="w-4 h-4 text-slate-700" />
              <span>Print Slip</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className="py-1.5 px-3.5 rounded-lg bg-slate-900 hover:bg-black text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-white" />
              <span>{isDownloading ? 'Generating...' : 'Download PDF'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors ml-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Document Body (Targeted by #printable-invoice-slip) */}
        <div 
          id="printable-invoice-slip" 
          className="p-5 sm:p-7 overflow-y-auto space-y-3.5 text-slate-900 font-sans print:p-0 print:space-y-2 bg-white"
        >
          
          {/* Top Institutional Header with Vinner Lab Symbol */}
          <div className="header-bar border-b-2 border-slate-900 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="logo-group flex items-center gap-3">
              {/* Official Vinner Lab Symbol */}
              <img 
                src="/logo.png" 
                alt="Vinner Lab Logo" 
                className="logo-img w-11 h-11 rounded-lg object-contain shrink-0 border border-slate-300 shadow-2xs bg-white p-0.5" 
              />
              <div>
                <h1 className="inst-title text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  VINNER LABORATORY & INNOVATION CENTER
                </h1>
                <p className="inst-sub text-[10px] text-slate-600 font-medium">
                  Central Hardware Inventory, Microelectronics & Embedded Systems Facility
                </p>
              </div>
            </div>

            {/* Invoice Reference Badge */}
            <div className="invoice-badge bg-white border-2 border-slate-900 px-3 py-1.5 rounded-lg text-left sm:text-right sm:min-w-44 shrink-0">
              <span className="invoice-badge-label text-[8px] font-bold text-slate-500 uppercase tracking-wider block">OFFICIAL INVOICE NO.</span>
              <span className="invoice-badge-num font-mono text-xs sm:text-sm font-black text-slate-900 block mt-0.5">
                {request.requestCode}
              </span>
              <span className="invoice-badge-date text-[10px] text-slate-600 block">
                Issue Date: {formatDate(request.createdAt)}
              </span>
            </div>
          </div>

          {/* Document Subheader */}
          <div className="sub-bar flex items-center justify-between text-[11px] border-b border-slate-200 pb-1.5">
            <h2 className="font-bold text-slate-900 uppercase tracking-wider">
              HARDWARE ISSUE INVOICE & HANDOVER RECEIPT
            </h2>
            <span className="text-slate-600 font-medium text-[10px]">
              {request.status === 'completed'
                ? 'Status: Fully Handed Over'
                : request.status === 'partially_issued'
                ? 'Status: Partially Handed Over'
                : 'Status: Approved for Collection'}
            </span>
          </div>

          {/* Student / Faculty Recipient & Project Details */}
          <div className="creds-grid grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3 rounded-lg border border-slate-300 text-[11px]">
            {/* Column 1: Recipient Details */}
            <div className="space-y-1">
              <span className="creds-col-label text-[8px] font-bold text-slate-500 uppercase tracking-wider block">
                Borrower / Recipient Credentials
              </span>
              <p className="text-xs font-bold text-slate-900">
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
                  <strong>Student Code:</strong> {request.studentCode}
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
            <div className="space-y-1 border-t sm:border-t-0 sm:border-l border-slate-300 pt-2 sm:pt-0 sm:pl-3">
              <span className="creds-col-label text-[8px] font-bold text-slate-500 uppercase tracking-wider block">
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
          <div className="table-sec space-y-1.5">
            <h4 className="sec-heading text-[10px] font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-slate-700" />
              <span>Issued Hardware Components Specification</span>
            </h4>

            <div className="overflow-x-auto rounded-lg border border-slate-300 overflow-hidden">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-900 text-white font-bold text-[10px]">
                  <tr>
                    <th className="py-1.5 px-2.5 w-10 text-center">S.No</th>
                    <th className="py-1.5 px-2.5 w-24">Code</th>
                    <th className="py-1.5 px-2.5">Component Description</th>
                    <th className="py-1.5 px-2.5">Category</th>
                    <th className="py-1.5 px-2.5 text-right">Qty (Units)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {request.items.map((item, idx) => {
                    const qty = (item.unitsIssuedSoFar && item.unitsIssuedSoFar > 0)
                      ? item.unitsIssuedSoFar
                      : (item.approvedQuantity ?? item.requestedQuantity);
                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-1.5 px-2.5 text-center text-slate-500">{idx + 1}</td>
                        <td className="py-1.5 px-2.5 font-mono font-bold text-slate-900">
                          {item.componentCode || `IIC-C${idx + 1}`}
                        </td>
                        <td className="py-1.5 px-2.5 font-medium text-slate-900">
                          {item.componentName}
                        </td>
                        <td className="py-1.5 px-2.5 text-slate-600">{item.category || 'Hardware'}</td>
                        <td className="py-1.5 px-2.5 text-right font-bold text-slate-900">
                          {qty} unit{qty > 1 ? 's' : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 font-bold text-[11px] border-t-2 border-slate-900">
                  <tr>
                    <td colSpan={4} className="py-1.5 px-2.5 text-slate-900">
                      TOTAL ALLOCATED: {request.items.length} item type(s)
                    </td>
                    <td className="py-1.5 px-2.5 text-right text-slate-900">
                      {totalIssued > 0 ? `${totalIssued} Units Issued` : `${totalApproved} Units Approved`}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Official Undertaking / Terms & Conditions */}
          <div className="terms-box p-3 rounded-lg bg-white border-1.5 border-slate-900 text-[10px] text-slate-900 space-y-1 leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px] text-slate-900">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-800 shrink-0" />
              <span>Terms of Loan & Borrower Declaration</span>
            </div>
            <p className="text-[9.5px] text-slate-800">
              I hereby solemnly declare that I have received the laboratory hardware components listed above in working and undamaged physical condition. 
              I undertake full custody and responsibility for the safe handling, maintenance, and timely return of these items on or before the designated return date. 
              In the event of loss, theft, physical damage, component burnout, or failure to return, I hereby agree and undertake to either replace the damaged/lost component with an identical genuine model or return the equivalent financial amount as determined by the laboratory administration.
            </p>
            <p className="text-[9px] font-bold text-slate-900 pt-1 border-t border-slate-200">
              Note: Components must be returned with all original cables, pins, and accessories in intact condition.
            </p>
          </div>

          {/* Physical Signatures Section (at bottom right for Faculty/Student) */}
          <div className="sig-section pt-3 flex flex-col sm:flex-row items-end justify-between gap-6 text-[10px]">
            {/* Left: Lab Administrator Signature */}
            <div className="sig-box space-y-1 w-full sm:w-56">
              <div className="sig-line border-b-2 border-slate-900 pb-0.5 h-8 flex items-end">
                <span className="text-[9px] text-slate-400 italic">Authorized Signature / Seal</span>
              </div>
              <p className="font-bold text-slate-900">Signature of Lab Admin / In-Charge</p>
              <p className="text-[10px] text-slate-600">Name: {request.approvedByAdminName || 'Lab Administrator'}</p>
              <p className="text-[10px] text-slate-600">Date: {formatDate(new Date())}</p>
            </div>

            {/* Right: Signature of Faculty / Student */}
            <div className="sig-box-right space-y-1 w-full sm:w-60 text-left sm:text-right">
              <div className="sig-line border-b-2 border-slate-900 pb-0.5 h-8 flex items-end justify-start sm:justify-end">
                <span className="text-[9px] text-slate-400 italic">Sign above this line on printout</span>
              </div>
              <p className="font-bold text-slate-900">Signature of Faculty / Student</p>
              <p className="text-[10px] text-slate-600">Name: {request.recipientName || request.requesterName}</p>
              <p className="text-[10px] text-slate-600">Reg / Emp ID: {request.recipientRegNumber || request.requesterRegNumber}</p>
            </div>
          </div>

          {/* Footer Notice */}
          <div className="footer-txt pt-2 border-t border-slate-200 text-center text-[9px] text-slate-500">
            This is an official laboratory handover invoice. Keep a physical signed copy for laboratory audit and return verification.
          </div>

        </div>

      </div>
    </div>
  );
}
