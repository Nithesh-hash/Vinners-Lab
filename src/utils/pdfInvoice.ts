import { jsPDF } from 'jspdf';
import type { IssueRequest } from '@/types';

function formatDateStr(timestamp: any): string {
  if (!timestamp) return new Date().toLocaleDateString('en-GB');
  try {
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds ? timestamp.seconds * 1000 : timestamp);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return new Date().toLocaleDateString('en-GB');
  }
}

let cachedLogoDataUrl: string | null = null;

/**
 * Loads the official Vinner Lab symbol as a base64 data URL for PDF rendering.
 */
export async function getLogoDataUrl(): Promise<string | null> {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;
  if (typeof window === 'undefined') return null;

  try {
    const res = await fetch('/logo.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        cachedLogoDataUrl = reader.result as string;
        resolve(cachedLogoDataUrl);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('Could not load logo for PDF:', err);
    return null;
  }
}

/**
 * Generates and returns a professional, print-ready Laboratory Hardware Issue Invoice PDF.
 * Free, client-side generation using jsPDF with official Vinner Lab symbol, student/faculty details,
 * components table, institutional declaration, and physical signature lines.
 * Pure white background, high-contrast, zero-glassmorphism official design.
 */
export function generateIssueInvoicePDF(request: IssueRequest, logoDataUrl?: string | null): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm

  // Professional Monochromatic Institutional Palette
  const black: [number, number, number] = [0, 0, 0];
  const darkGray: [number, number, number] = [30, 41, 59]; // Slate 800
  const midGray: [number, number, number] = [100, 116, 139]; // Slate 500
  const lightBorder: [number, number, number] = [203, 213, 225]; // Slate 300
  const solidBorder: [number, number, number] = [15, 23, 42]; // Slate 900
  const white: [number, number, number] = [255, 255, 255];

  let y = margin;

  // 1. TOP HEADER BANNER RULE
  doc.setDrawColor(...solidBorder);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // Render Vinner Lab Symbol if available
  let textStartX = margin;
  const logoSize = 13;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', margin, y - 2, logoSize, logoSize);
      textStartX = margin + logoSize + 3.5; // ~30.5mm
    } catch (e) {
      console.warn('Failed to draw logo on PDF:', e);
      textStartX = margin;
    }
  }

  // Institution Title (Guaranteed clear gap before right invoice box)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...black);
  doc.text('VINNER LABORATORY & INNOVATION CENTER', textStartX, y + 3);

  doc.setFontSize(7.2);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...darkGray);
  doc.text('CENTRAL HARDWARE REQUISITION & INVENTORY MANAGEMENT SYSTEM', textStartX, y + 7.5);

  // Top Right: Official Invoice Reference Box (Pure white, crisp solid border, starts at 136mm)
  const invoiceBoxWidth = 60;
  const invoiceBoxX = pageWidth - margin - invoiceBoxWidth; // 136mm
  const invoiceBoxY = y - 4;
  const invoiceBoxHeight = 17;

  doc.setFillColor(...white);
  doc.setDrawColor(...solidBorder);
  doc.setLineWidth(0.3);
  doc.rect(invoiceBoxX, invoiceBoxY, invoiceBoxWidth, invoiceBoxHeight, 'FD');

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...midGray);
  doc.text('OFFICIAL INVOICE NO.', invoiceBoxX + 4, invoiceBoxY + 4.5);

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...black);
  doc.text(request.requestCode || 'REQ-0000', invoiceBoxX + 4, invoiceBoxY + 9.5);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...darkGray);
  doc.text(`Issue Date: ${formatDateStr(request.createdAt)}`, invoiceBoxX + 4, invoiceBoxY + 14);

  y += 18;

  // Horizontal Divider
  doc.setDrawColor(...lightBorder);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5.5;

  // 2. DOCUMENT SUBHEADER
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...black);
  doc.text('HARDWARE ISSUE INVOICE & HANDOVER RECEIPT', margin, y);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...midGray);
  const statusLabel = request.status === 'completed'
    ? 'Status: Fully Handed Over'
    : request.status === 'partially_issued'
    ? 'Status: Partially Handed Over'
    : 'Status: Approved for Collection';
  doc.text(statusLabel, pageWidth - margin, y, { align: 'right' });

  y += 4.5;

  // 3. STUDENT & RECIPIENT INFORMATION BLOCK (Pure White, Crisp Border)
  const infoBoxHeight = 42;
  doc.setFillColor(...white);
  doc.setDrawColor(...lightBorder);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentWidth, infoBoxHeight, 'FD');

  // Vertical Divider between columns
  doc.setDrawColor(...lightBorder);
  doc.line(margin + contentWidth / 2, y + 3, margin + contentWidth / 2, y + infoBoxHeight - 3);

  const col1X = margin + 4;
  const col2X = margin + (contentWidth / 2) + 4;
  let infoY = y + 5.5;

  // Column 1: Recipient / Student Details
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...black);
  doc.text('RECIPIENT / BORROWER DETAILS', col1X, infoY);

  infoY += 4.5;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...black);
  doc.text(`Name: ${request.recipientName || request.requesterName}`, col1X, infoY);

  infoY += 4.2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...darkGray);
  doc.text(`Reg / Emp No: ${request.recipientRegNumber || request.requesterRegNumber}`, col1X, infoY);

  infoY += 4.2;
  const roleText = request.recipientType === 'faculty' ? 'Teacher / Faculty Advisor' : 'Student';
  const codeSuffix = request.studentCode && request.recipientType !== 'faculty' ? ` | Student Code: ${request.studentCode}` : '';
  doc.text(`Role: ${roleText}${codeSuffix}`, col1X, infoY);

  if (request.requesterEmail) {
    infoY += 4.2;
    doc.text(`Email: ${request.requesterEmail}`, col1X, infoY);
  }

  if (request.requesterMobile) {
    infoY += 4.2;
    // Standard plain text "Phone / Mobile" without any corrupted Unicode emoji characters
    doc.text(`Phone / Mobile: ${request.requesterMobile}`, col1X, infoY);
  }

  // Column 2: Authorization & Project Details
  let col2Y = y + 5.5;
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...black);
  doc.text('AUTHORIZATION & PROJECT INFO', col2X, col2Y);

  col2Y += 4.5;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...black);
  doc.text(`Authorization: ${request.projectCode ? `Project Code (${request.projectCode})` : 'Personal Account Issue'}`, col2X, col2Y);

  col2Y += 4.2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...darkGray);
  doc.text(`Approved By: ${request.approvedByAdminName || 'Lab Administrator'}`, col2X, col2Y);

  col2Y += 4.2;
  doc.text(`Requester: ${request.requesterName} (${request.requesterRegNumber})`, col2X, col2Y);

  if (request.purposeNotes) {
    col2Y += 4.2;
    const truncatedPurpose = request.purposeNotes.length > 44 ? `${request.purposeNotes.slice(0, 41)}...` : request.purposeNotes;
    doc.text(`Purpose: ${truncatedPurpose}`, col2X, col2Y);
  }

  y += infoBoxHeight + 6;

  // 4. HARDWARE COMPONENTS TABLE
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...black);
  doc.text('ISSUED HARDWARE COMPONENTS SPECIFICATION', margin, y);
  y += 3.5;

  // Table Headers
  const colWidths = {
    sno: 12,
    code: 28,
    name: 82,
    category: 32,
    qty: 28
  };

  const tableHeaderY = y;
  const headerHeight = 6.5;
  doc.setFillColor(...solidBorder);
  doc.rect(margin, tableHeaderY, contentWidth, headerHeight, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);

  let curX = margin;
  doc.text('S.NO', curX + 2, tableHeaderY + 4.5);
  curX += colWidths.sno;
  doc.text('CODE', curX + 2, tableHeaderY + 4.5);
  curX += colWidths.code;
  doc.text('COMPONENT DESCRIPTION', curX + 2, tableHeaderY + 4.5);
  curX += colWidths.name;
  doc.text('CATEGORY', curX + 2, tableHeaderY + 4.5);
  curX += colWidths.category;
  doc.text('QTY (UNITS)', curX + 2, tableHeaderY + 4.5);

  y += headerHeight;

  // Table Rows (Pure White Backgrounds, Clean Thin Borders)
  let totalUnits = 0;
  const items = request.items || [];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...darkGray);

  items.forEach((item, index) => {
    const rowHeight = 7;
    doc.setFillColor(...white);
    doc.rect(margin, y, contentWidth, rowHeight, 'F');
    doc.setDrawColor(...lightBorder);
    doc.setLineWidth(0.2);
    doc.rect(margin, y, contentWidth, rowHeight, 'S');

    const qty = (item.unitsIssuedSoFar && item.unitsIssuedSoFar > 0)
      ? item.unitsIssuedSoFar
      : (item.approvedQuantity ?? item.requestedQuantity);
    totalUnits += qty;

    curX = margin;
    // S.No
    doc.text(String(index + 1), curX + 4, y + 4.6);
    curX += colWidths.sno;

    // Code
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...black);
    doc.text(item.componentCode || `IIC-C${index + 1}`, curX + 2, y + 4.6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...darkGray);
    curX += colWidths.code;

    // Name (truncated if long)
    const displayName = item.componentName.length > 42 ? `${item.componentName.slice(0, 39)}...` : item.componentName;
    doc.text(displayName, curX + 2, y + 4.6);
    curX += colWidths.name;

    // Category
    doc.text(item.category || 'Hardware', curX + 2, y + 4.6);
    curX += colWidths.category;

    // Qty
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...black);
    doc.text(`${qty} unit${qty > 1 ? 's' : ''}`, curX + 4, y + 4.6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...darkGray);

    y += rowHeight;
  });

  // Table Total Row
  doc.setFillColor(...white);
  doc.rect(margin, y, contentWidth, 6.5, 'F');
  doc.setDrawColor(...solidBorder);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentWidth, 6.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...black);
  doc.text(`TOTAL ISSUED: ${items.length} item type(s)`, margin + 4, y + 4.5);
  doc.text(`${totalUnits} Total Units`, margin + colWidths.sno + colWidths.code + colWidths.name + colWidths.category + 4, y + 4.5);

  y += 11;

  // 5. OFFICIAL TERMS & CONDITIONS AND UNDERTAKING (Pure White & Clean Black Style)
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...black);
  doc.text('TERMS OF LOAN & BORROWER DECLARATION', margin, y);
  y += 3.5;

  const declarationBoxHeight = 36;
  doc.setFillColor(...white); // Pure white background
  doc.setDrawColor(...solidBorder); // Solid clean border
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentWidth, declarationBoxHeight, 'FD');

  const declarationText = 
    'I hereby solemnly declare that I have received the laboratory hardware components listed above in working and undamaged physical condition. ' +
    'I undertake full custody and responsibility for the safe handling, maintenance, and timely return of these items on or before the designated due date. ' +
    'In the event of loss, theft, physical damage, component burnout, or failure to return, I hereby agree and undertake to either replace the damaged/lost ' +
    'component with an identical genuine model or return the equivalent financial amount as determined by the laboratory administration.';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...darkGray);
  const splitText = doc.splitTextToSize(declarationText, contentWidth - 8);
  doc.text(splitText, margin + 4, y + 5.5);

  // Institutional note
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...black);
  doc.text('Note: Components must be returned with all original cables, pins, and accessories in intact condition.', margin + 4, y + declarationBoxHeight - 3.5);

  y += declarationBoxHeight + 10;

  // 6. SIGNATURES SECTION (Admin at left, Faculty/Student Signature at bottom right as requested)
  // Always anchored at the bottom of the invoice page
  const minSigY = pageHeight - margin - 32;
  const sigY = Math.max(minSigY, y + 6);

  // Left Signature: Lab Administrator
  const adminSigX = margin + 6;
  doc.setDrawColor(...solidBorder);
  doc.setLineWidth(0.4);
  doc.line(adminSigX, sigY + 16, adminSigX + 62, sigY + 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...black);
  doc.text('Signature of Lab Admin / In-Charge', adminSigX, sigY + 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...midGray);
  doc.text(`Name: ${request.approvedByAdminName || 'Lab Administrator'}`, adminSigX, sigY + 24);
  doc.text(`Date: ${formatDateStr(new Date())}`, adminSigX, sigY + 27.5);

  // Right Signature: Faculty / Student (Physical Printout Signature Space)
  const studentSigX = pageWidth - margin - 68;
  doc.line(studentSigX, sigY + 16, studentSigX + 65, sigY + 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...black);
  doc.text('Signature of Faculty / Student', studentSigX, sigY + 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...midGray);
  doc.text(`Name: ${request.recipientName || request.requesterName}`, studentSigX, sigY + 24);
  doc.text(`Reg / Emp ID: ${request.recipientRegNumber || request.requesterRegNumber}`, studentSigX, sigY + 27.5);

  // Bottom Footer Notice (Positioned at bottom edge)
  const footerY = Math.max(pageHeight - margin + 2, sigY + 31);
  doc.setFontSize(6.5);
  doc.setTextColor(...midGray);
  doc.text('This is an official laboratory handover invoice. Keep a physical signed copy for laboratory audit and return verification.', pageWidth / 2, footerY, { align: 'center' });

  return doc;
}

/**
 * Generates and triggers browser download of the Issue Invoice PDF with the Vinner Lab symbol.
 */
export async function downloadIssueInvoicePDF(request: IssueRequest): Promise<void> {
  const logoDataUrl = await getLogoDataUrl();
  const doc = generateIssueInvoicePDF(request, logoDataUrl);
  const fileName = `VinnerLab_Invoice_${request.requestCode || request.id}.pdf`;
  doc.save(fileName);
}
