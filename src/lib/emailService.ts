import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface EmailConfig {
  webhookUrl: string;
  recipientEmail: string;
  enableOnIssue: boolean;
  enableOnReturn: boolean;
  updatedAt?: any;
}

export const DEFAULT_EMAIL_CONFIG: EmailConfig = {
  webhookUrl: 'https://script.google.com/macros/s/AKfycbxzMzSzwNTMS8RbKlWCM2M4cVAFJzkrEwnq8fs5xoK4UsbQwM1bwGBNLuBezvq4e7zItA/exec',
  recipientEmail: 'vinnerlabiic@gmail.com',
  enableOnIssue: true,
  enableOnReturn: true
};

/**
 * Loads mail configuration from Firestore settings, or returns defaults.
 */
export async function getEmailConfig(): Promise<EmailConfig> {
  try {
    const docRef = doc(db, 'settings', 'email_config');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { ...DEFAULT_EMAIL_CONFIG, ...snap.data() } as EmailConfig;
    }
  } catch (err) {
    console.warn("Could not load email configuration from Firestore, using default:", err);
  }
  return DEFAULT_EMAIL_CONFIG;
}

/**
 * Saves mail configuration to Firestore settings.
 */
export async function saveEmailConfig(config: EmailConfig): Promise<void> {
  const docRef = doc(db, 'settings', 'email_config');
  await setDoc(docRef, {
    ...config,
    updatedAt: Timestamp.now()
  });
}

/**
 * Sends an email using the configured Google Apps Script Webhook.
 */
export async function sendEmailViaWebhook(payload: {
  to?: string;
  subject: string;
  htmlBody: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    const config = await getEmailConfig();
    const webhookUrl = config.webhookUrl?.trim();
    if (!webhookUrl) {
      return { success: false, message: 'Google Webhook URL is not configured.' };
    }

    const recipient = payload.to?.trim() || config.recipientEmail?.trim();
    if (!recipient) {
      return { success: false, message: 'No recipient email configured.' };
    }

    // Google Apps Script accepts text/plain to avoid browser CORS preflight blocks
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        to: recipient,
        subject: payload.subject,
        htmlBody: payload.htmlBody
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const result = await response.json().catch(() => ({ status: 'success' }));
    return { 
      success: result.status === 'success', 
      message: result.message || 'Email dispatched successfully.' 
    };
  } catch (err: any) {
    console.error("Error sending email via webhook:", err);
    return { success: false, message: err.message || 'Failed to dispatch email.' };
  }
}

/**
 * Formats a high-end, executive-grade institutional HTML email for hardware issuance
 * with complete student credentials, project affiliation, and custody terms.
 */
export function buildIssueEmailHtml(params: {
  studentName: string;
  studentRegNumber: string;
  studentEmail?: string;
  studentMobile?: string;
  studentCode?: string;
  projectCode?: string;
  facultyName?: string;
  facultyMobile?: string;
  componentCode?: string;
  componentName: string;
  category?: string;
  quantity: number;
  issueDate: string;
  dueDate: string;
  adminName: string;
  projectPurpose?: string;
  transactionId?: string;
}): string {
  const compCodeBadge = params.componentCode 
    ? `<span style="background-color: #e0e7ff; color: #3730a3; border: 1px solid #c7d2fe; padding: 3px 9px; border-radius: 6px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-weight: 700; font-size: 13px;">${params.componentCode}</span>` 
    : '';

  const studentCodeBadge = params.studentCode
    ? `<span style="background-color: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; padding: 2px 8px; border-radius: 6px; font-family: monospace; font-weight: 700; font-size: 12px;">${params.studentCode}</span>`
    : '<span style="color: #94a3b8; font-style: italic;">Not Registered</span>';

  const projectCodeBadge = params.projectCode
    ? `<span style="background-color: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; padding: 2px 8px; border-radius: 6px; font-family: monospace; font-weight: 700; font-size: 12px;">${params.projectCode}</span>`
    : '<span style="color: #64748b; font-size: 12px; font-weight: 500;">Individual Direct Issue</span>';

  const studentEmailLink = params.studentEmail
    ? `<a href="mailto:${params.studentEmail}" style="color: #2563eb; text-decoration: none; font-weight: 600;">${params.studentEmail}</a>`
    : '<span style="color: #94a3b8; font-style: italic;">Not Registered</span>';

  const studentPhoneLink = params.studentMobile
    ? `<a href="tel:${params.studentMobile}" style="color: #0f172a; text-decoration: none; font-weight: 600;">${params.studentMobile}</a>`
    : '<span style="color: #94a3b8; font-style: italic;">Not Registered</span>';

  const facultyGuideText = params.facultyName
    ? `${params.facultyName}${params.facultyMobile ? ` &bull; 📞 ${params.facultyMobile}` : ''}`
    : '<span style="color: #94a3b8; font-style: italic;">None (Direct Student Allocation)</span>';

  const refId = params.transactionId 
    ? `#TX-${params.transactionId.slice(-8).toUpperCase()}` 
    : `#TX-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hardware Issuance Dispatch Record</title>
  </head>
  <body style="margin: 0; padding: 24px 12px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; -webkit-font-smoothing: antialiased;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08);">
      
      <!-- INSTITUTIONAL HEADER -->
      <tr>
        <td style="background: linear-gradient(135deg, #090d16 0%, #1e293b 100%); padding: 28px 32px; color: #ffffff;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <div style="font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #38bdf8; margin-bottom: 4px;">
                  Institution's Innovation Council &bull; IIC Lab
                </div>
                <div style="font-size: 22px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff; margin: 0;">
                  VINNER LAB
                </div>
                <div style="font-size: 12px; color: #94a3b8; margin-top: 3px;">
                  Official Laboratory Hardware Tracking & Custody System
                </div>
              </td>
              <td align="right" valign="top">
                <div style="display: inline-block; background-color: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); padding: 6px 14px; border-radius: 9999px;">
                  <span style="display: inline-block; width: 7px; height: 7px; background-color: #34d399; border-radius: 50%; margin-right: 6px; vertical-align: middle;"></span>
                  <span style="color: #a7f3d0; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; vertical-align: middle;">
                    Hardware Issued
                  </span>
                </div>
                <div style="font-size: 10px; font-family: monospace; color: #94a3b8; margin-top: 6px;">
                  ${refId}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- BODY CONTENT -->
      <tr>
        <td style="padding: 28px 32px 16px 32px;">

          <!-- SECTION 1: HARDWARE & LOAN DETAILS -->
          <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin-bottom: 10px;">
            📦 Hardware Allocation Specifications
          </div>
          
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; margin-bottom: 22px;">
            <tr>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; color: #64748b; font-weight: 500; width: 38%;">
                Component
              </td>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; color: #0f172a; font-weight: 700; text-align: right;">
                ${compCodeBadge} <span style="margin-left: 4px;">${params.componentName}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; color: #64748b; font-weight: 500;">
                Category
              </td>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; color: #334155; font-weight: 600; text-align: right;">
                ${params.category || 'General Laboratory Hardware'}
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; color: #64748b; font-weight: 500;">
                Quantity Issued
              </td>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 14px; color: #047857; font-weight: 800; text-align: right;">
                ${params.quantity} unit(s)
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; color: #64748b; font-weight: 500;">
                Issue Date
              </td>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; color: #0f172a; font-weight: 600; text-align: right;">
                ${params.issueDate}
              </td>
            </tr>
            <tr>
              <td style="padding: 14px 18px; background-color: #fffbeb; font-size: 13px; color: #92400e; font-weight: 700;">
                ⏰ Expected Due Date
              </td>
              <td style="padding: 14px 18px; background-color: #fffbeb; font-size: 14px; color: #b45309; font-weight: 800; text-align: right;">
                ${params.dueDate}
              </td>
            </tr>
          </table>

          <!-- SECTION 2: COMPLETE STUDENT DETAILS -->
          <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin-bottom: 10px;">
            🎓 Authorized Student Custody Profile
          </div>

          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; margin-bottom: 22px;">
            <tr>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; color: #64748b; font-weight: 500; width: 38%;">
                Full Name
              </td>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 14px; color: #0f172a; font-weight: 700; text-align: right;">
                ${params.studentName}
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; color: #64748b; font-weight: 500;">
                Registration No.
              </td>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; font-family: monospace; color: #0f172a; font-weight: 700; text-align: right;">
                ${params.studentRegNumber}
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; color: #64748b; font-weight: 500;">
                Student ID Code
              </td>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; text-align: right;">
                ${studentCodeBadge}
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; color: #64748b; font-weight: 500;">
                Email Address
              </td>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; text-align: right;">
                ${studentEmailLink}
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; color: #64748b; font-weight: 500;">
                Mobile Number
              </td>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; text-align: right;">
                ${studentPhoneLink}
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; color: #64748b; font-weight: 500;">
                Project / Team Code
              </td>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; text-align: right;">
                ${projectCodeBadge}
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 18px; font-size: 13px; color: #64748b; font-weight: 500;">
                Faculty Guide
              </td>
              <td style="padding: 12px 18px; font-size: 13px; color: #1e293b; font-weight: 600; text-align: right;">
                ${facultyGuideText}
              </td>
            </tr>
          </table>

          <!-- SECTION 3: ADMINISTRATIVE AUTHORIZATION -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 18px; margin-bottom: 16px;">
            <tr>
              <td style="font-size: 12px; color: #64748b; width: 40%;">
                Authorized Admin:
              </td>
              <td style="font-size: 12px; color: #0f172a; font-weight: 700; text-align: right;">
                ${params.adminName}
              </td>
            </tr>
            ${params.projectPurpose ? `
            <tr>
              <td style="font-size: 12px; color: #64748b; padding-top: 6px;">
                Purpose / Remarks:
              </td>
              <td style="font-size: 12px; color: #0f172a; text-align: right; padding-top: 6px; font-weight: 500;">
                ${params.projectPurpose}
              </td>
            </tr>` : ''}
          </table>

          <!-- MANDATORY RETURN NOTICE CALLOUT -->
          <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 8px; margin-bottom: 12px;">
            <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #1e40af;">
              <strong>Laboratory Custody Terms:</strong> The above student is held accountable for safe keeping and timely return of the listed hardware on or before <strong>${params.dueDate}</strong>. Damaged or missing components will incur standard inventory replacement protocols.
            </p>
          </div>

        </td>
      </tr>

      <!-- INSTITUTIONAL FOOTER -->
      <tr>
        <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;">
          <div style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">
            Vinner Lab &bull; Institution's Innovation Council (IIC)
          </div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 4px; line-height: 1.5;">
            Automated system dispatch &bull; Please do not reply directly to this email.<br>
            For lab support or inquiries, please contact the designated Laboratory In-charge.
          </div>
          <div style="font-size: 10px; color: #cbd5e1; margin-top: 8px; font-family: monospace;">
            Dispatched: ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
          </div>
        </td>
      </tr>

    </table>
  </body>
  </html>
  `;
}

/**
 * Formats a high-end, executive-grade institutional HTML email for hardware return verification
 * with complete student details, physical condition audit, and stock reconciliation.
 */
export function buildReturnEmailHtml(params: {
  studentName: string;
  studentRegNumber: string;
  studentEmail?: string;
  studentMobile?: string;
  studentCode?: string;
  projectCode?: string;
  facultyName?: string;
  componentCode?: string;
  componentName: string;
  category?: string;
  returnedQuantity: number;
  returnDate: string;
  condition: 'Good' | 'Damaged' | 'Incomplete';
  adminNotes?: string;
  adminName: string;
  remainingQuantity?: number;
  transactionId?: string;
}): string {
  const compCodeBadge = params.componentCode 
    ? `<span style="background-color: #e0e7ff; color: #3730a3; border: 1px solid #c7d2fe; padding: 3px 9px; border-radius: 6px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-weight: 700; font-size: 13px;">${params.componentCode}</span>` 
    : '';

  const studentCodeBadge = params.studentCode
    ? `<span style="background-color: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; padding: 2px 8px; border-radius: 6px; font-family: monospace; font-weight: 700; font-size: 12px;">${params.studentCode}</span>`
    : '<span style="color: #94a3b8; font-style: italic;">Not Registered</span>';

  const projectCodeBadge = params.projectCode
    ? `<span style="background-color: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; padding: 2px 8px; border-radius: 6px; font-family: monospace; font-weight: 700; font-size: 12px;">${params.projectCode}</span>`
    : '<span style="color: #64748b; font-size: 12px; font-weight: 500;">Individual Direct Issue</span>';

  const studentEmailLink = params.studentEmail
    ? `<a href="mailto:${params.studentEmail}" style="color: #2563eb; text-decoration: none; font-weight: 600;">${params.studentEmail}</a>`
    : '<span style="color: #94a3b8; font-style: italic;">Not Registered</span>';

  const studentPhoneLink = params.studentMobile
    ? `<a href="tel:${params.studentMobile}" style="color: #0f172a; text-decoration: none; font-weight: 600;">${params.studentMobile}</a>`
    : '<span style="color: #94a3b8; font-style: italic;">Not Registered</span>';

  let conditionColor = '#047857';
  let conditionBg = '#ecfdf5';
  let conditionBorder = '#a7f3d0';
  let conditionLabel = '✓ Good (Verified & Functional)';

  if (params.condition === 'Damaged') {
    conditionColor = '#b91c1c';
    conditionBg = '#fef2f2';
    conditionBorder = '#fecaca';
    conditionLabel = '⚠ Damaged / Physical Defect';
  } else if (params.condition === 'Incomplete') {
    conditionColor = '#b45309';
    conditionBg = '#fffbeb';
    conditionBorder = '#fde68a';
    conditionLabel = '⚠ Incomplete / Missing Accessories';
  }

  const isOutstanding = params.remainingQuantity !== undefined && params.remainingQuantity > 0;
  const refId = params.transactionId 
    ? `#RET-${params.transactionId.slice(-8).toUpperCase()}` 
    : `#RET-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Official Hardware Return Verification Receipt</title>
  </head>
  <body style="margin: 0; padding: 24px 12px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; -webkit-font-smoothing: antialiased;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08);">
      
      <!-- INSTITUTIONAL HEADER -->
      <tr>
        <td style="background: linear-gradient(135deg, #090d16 0%, #1e293b 100%); padding: 28px 32px; color: #ffffff;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <div style="font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #38bdf8; margin-bottom: 4px;">
                  Institution's Innovation Council &bull; IIC Lab
                </div>
                <div style="font-size: 22px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff; margin: 0;">
                  VINNER LAB
                </div>
                <div style="font-size: 12px; color: #94a3b8; margin-top: 3px;">
                  Official Return Verification & Stock Clearance Receipt
                </div>
              </td>
              <td align="right" valign="top">
                <div style="display: inline-block; background-color: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.4); padding: 6px 14px; border-radius: 9999px;">
                  <span style="display: inline-block; width: 7px; height: 7px; background-color: #60a5fa; border-radius: 50%; margin-right: 6px; vertical-align: middle;"></span>
                  <span style="color: #bfdbfe; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; vertical-align: middle;">
                    Hardware Returned
                  </span>
                </div>
                <div style="font-size: 10px; font-family: monospace; color: #94a3b8; margin-top: 6px;">
                  ${refId}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- BODY CONTENT -->
      <tr>
        <td style="padding: 28px 32px 16px 32px;">

          <!-- SECTION 1: RETURN AUDIT SUMMARY -->
          <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin-bottom: 10px;">
            🔍 Physical Inventory Audit & Verification
          </div>
          
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; margin-bottom: 22px;">
            <tr>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; color: #64748b; font-weight: 500; width: 38%;">
                Returned Component
              </td>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; color: #0f172a; font-weight: 700; text-align: right;">
                ${compCodeBadge} <span style="margin-left: 4px;">${params.componentName}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; color: #64748b; font-weight: 500;">
                Returned Quantity
              </td>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 14px; color: #15803d; font-weight: 800; text-align: right;">
                ${params.returnedQuantity} unit(s) verified & restocked
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; color: #64748b; font-weight: 500;">
                Physical Condition
              </td>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; text-align: right;">
                <span style="background-color: ${conditionBg}; color: ${conditionColor}; border: 1px solid ${conditionBorder}; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 700;">
                  ${conditionLabel}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; color: #64748b; font-weight: 500;">
                Return Timestamp
              </td>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; color: #0f172a; font-weight: 600; text-align: right;">
                ${params.returnDate}
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 18px; font-size: 13px; color: #64748b; font-weight: 500;">
                Loan Clearance Status
              </td>
              <td style="padding: 12px 18px; font-size: 13px; text-align: right;">
                ${isOutstanding ? `
                  <span style="color: #b45309; font-weight: 700; background-color: #fef3c7; border: 1px solid #fde68a; padding: 2px 8px; border-radius: 6px;">
                    Partial (${params.remainingQuantity} units still on loan)
                  </span>
                ` : `
                  <span style="color: #15803d; font-weight: 700; background-color: #dcfce7; border: 1px solid #bbf7d0; padding: 2px 8px; border-radius: 6px;">
                    ✓ Full Return (Loan Completely Cleared)
                  </span>
                `}
              </td>
            </tr>
          </table>

          <!-- SECTION 2: COMPLETE STUDENT DETAILS -->
          <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin-bottom: 10px;">
            🎓 Returning Student Profile
          </div>

          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; margin-bottom: 22px;">
            <tr>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; color: #64748b; font-weight: 500; width: 38%;">
                Student Name
              </td>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 14px; color: #0f172a; font-weight: 700; text-align: right;">
                ${params.studentName}
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; color: #64748b; font-weight: 500;">
                Registration No.
              </td>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; font-family: monospace; color: #0f172a; font-weight: 700; text-align: right;">
                ${params.studentRegNumber}
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; color: #64748b; font-weight: 500;">
                Student ID Code
              </td>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; text-align: right;">
                ${studentCodeBadge}
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; color: #64748b; font-weight: 500;">
                Email Address
              </td>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; text-align: right;">
                ${studentEmailLink}
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; color: #64748b; font-weight: 500;">
                Mobile Number
              </td>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; text-align: right;">
                ${studentPhoneLink}
              </td>
            </tr>
            ${params.projectCode ? `
            <tr>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; color: #64748b; font-weight: 500;">
                Project / Team Code
              </td>
              <td style="padding: 12px 18px; border-bottom: 1px solid #edf2f7; font-size: 13px; text-align: right;">
                ${projectCodeBadge}
              </td>
            </tr>` : ''}
            ${params.facultyName ? `
            <tr>
              <td style="padding: 12px 18px; font-size: 13px; color: #64748b; font-weight: 500;">
                Faculty Guide
              </td>
              <td style="padding: 12px 18px; font-size: 13px; color: #1e293b; font-weight: 600; text-align: right;">
                ${params.facultyName}
              </td>
            </tr>` : ''}
          </table>

          <!-- SECTION 3: INSPECTOR NOTES & ADMIN VERIFIER -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 18px; margin-bottom: 16px;">
            <tr>
              <td style="font-size: 12px; color: #64748b; width: 40%;">
                Verified By Admin:
              </td>
              <td style="font-size: 12px; color: #0f172a; font-weight: 700; text-align: right;">
                ${params.adminName}
              </td>
            </tr>
            ${params.adminNotes ? `
            <tr>
              <td style="font-size: 12px; color: #64748b; padding-top: 6px;">
                Inspection Remarks:
              </td>
              <td style="font-size: 12px; color: #0f172a; text-align: right; padding-top: 6px; font-weight: 600;">
                "${params.adminNotes}"
              </td>
            </tr>` : ''}
          </table>

        </td>
      </tr>

      <!-- INSTITUTIONAL FOOTER -->
      <tr>
        <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;">
          <div style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">
            Vinner Lab &bull; Institution's Innovation Council (IIC)
          </div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 4px; line-height: 1.5;">
            Official Hardware Custody & Inventory Restock Audit &bull; Please retain for institutional records.
          </div>
          <div style="font-size: 10px; color: #cbd5e1; margin-top: 8px; font-family: monospace;">
            Audited: ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
          </div>
        </td>
      </tr>

    </table>
  </body>
  </html>
  `;
}

/**
 * Triggers an issue email notification to the configured admin recipient.
 */
export async function notifyAdminOnIssue(params: {
  studentName: string;
  studentRegNumber: string;
  studentEmail?: string;
  studentMobile?: string;
  studentCode?: string;
  projectCode?: string;
  facultyName?: string;
  facultyMobile?: string;
  componentCode?: string;
  componentName: string;
  category?: string;
  quantity: number;
  issueDate: Date;
  dueDate: Date;
  adminName: string;
  projectPurpose?: string;
  transactionId?: string;
}): Promise<void> {
  const config = await getEmailConfig();
  if (!config.enableOnIssue) return;

  const codeStr = params.componentCode ? `[${params.componentCode}] ` : '';
  const subject = `[Vinner Lab] Hardware Issued — ${codeStr}${params.componentName} to ${params.studentName} (${params.studentRegNumber})`;

  const htmlBody = buildIssueEmailHtml({
    ...params,
    issueDate: params.issueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    dueDate: params.dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  });

  sendEmailViaWebhook({ subject, htmlBody }).catch(err => console.warn("Issue email notification warning:", err));
}

/**
 * Triggers a return email notification to the configured admin recipient.
 */
export async function notifyAdminOnReturn(params: {
  studentName: string;
  studentRegNumber: string;
  studentEmail?: string;
  studentMobile?: string;
  studentCode?: string;
  projectCode?: string;
  facultyName?: string;
  componentCode?: string;
  componentName: string;
  category?: string;
  returnedQuantity: number;
  returnDate: Date;
  condition: 'Good' | 'Damaged' | 'Incomplete';
  adminNotes?: string;
  adminName: string;
  remainingQuantity?: number;
  transactionId?: string;
}): Promise<void> {
  const config = await getEmailConfig();
  if (!config.enableOnReturn) return;

  const codeStr = params.componentCode ? `[${params.componentCode}] ` : '';
  const conditionTag = params.condition === 'Good' ? 'Condition: Good' : `⚠️ Condition: ${params.condition}`;
  const subject = `[Vinner Lab] Hardware Return Verified — ${codeStr}${params.componentName} (${params.returnedQuantity} units, ${conditionTag})`;

  const htmlBody = buildReturnEmailHtml({
    ...params,
    returnDate: params.returnDate.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  });

  sendEmailViaWebhook({ subject, htmlBody }).catch(err => console.warn("Return email notification warning:", err));
}

/**
 * Sends a test email to verify recipient connectivity with official institutional layout.
 */
export async function sendTestEmail(targetEmail?: string): Promise<{ success: boolean; message: string }> {
  const config = await getEmailConfig();
  const recipient = targetEmail || config.recipientEmail;

  const htmlBody = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Vinner Lab Email Relay Test</title>
  </head>
  <body style="margin: 0; padding: 24px 12px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
    <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08);">
      
      <div style="background: linear-gradient(135deg, #090d16 0%, #1e293b 100%); padding: 28px 32px; color: #ffffff;">
        <div style="font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #38bdf8; margin-bottom: 4px;">
          Institution's Innovation Council &bull; IIC
        </div>
        <div style="font-size: 20px; font-weight: 800; color: #ffffff;">
          VINNER LAB &bull; Mail Relay Test
        </div>
        <div style="font-size: 12px; color: #94a3b8; margin-top: 3px;">
          Automated Dispatch Verification
        </div>
      </div>

      <div style="padding: 28px 32px;">
        <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px;">
          <div style="font-size: 14px; font-weight: 700; color: #065f46; margin-bottom: 4px;">
            ✓ Google Apps Script Webhook Verified & Active
          </div>
          <div style="font-size: 12px; color: #047857; line-height: 1.5;">
            Your automated email system is operational. Whenever components are issued or returned in Vinner Lab, executive summaries with complete student credentials and inventory audit codes will be delivered directly to this inbox.
          </div>
        </div>

        <table width="100%" cellpadding="8" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 12px;">
          <tr>
            <td style="color: #64748b; font-weight: 500;">Destination Inbox:</td>
            <td style="font-weight: 700; color: #0f172a; text-align: right;">${recipient}</td>
          </tr>
          <tr>
            <td style="color: #64748b; font-weight: 500;">Relay Provider:</td>
            <td style="font-weight: 600; color: #047857; text-align: right;">Google Apps Script Webhook Relay</td>
          </tr>
          <tr>
            <td style="color: #64748b; font-weight: 500;">Timestamp:</td>
            <td style="color: #334155; text-align: right;">${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</td>
          </tr>
        </table>
      </div>

      <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 32px; text-align: center; font-size: 11px; color: #94a3b8;">
        Vinner Lab &bull; Institution's Innovation Council &bull; Do not reply
      </div>
    </div>
  </body>
  </html>
  `;

  return sendEmailViaWebhook({
    to: recipient,
    subject: '[Vinner Lab] Verification Test — Mail Relay Active',
    htmlBody
  });
}
