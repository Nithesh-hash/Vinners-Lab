import QRCode from 'qrcode';

/**
 * Generate a high-contrast QR code data URL for a loan transaction ID.
 * Error correction level 'H' ensures reliable scanning even with glare or minor damage.
 */
export async function generateLoanQR(transactionId: string): Promise<string> {
  // Use stable URL so standard smartphone cameras and in-app scanners can both interpret it
  const origin = typeof window !== 'undefined' && window.location.origin ? window.location.origin : '';
  const payload = origin ? `${origin}/admin/return-loan?id=${encodeURIComponent(transactionId)}` : `labslot:loan:${transactionId}`;

  return QRCode.toDataURL(payload, {
    width: 400,
    margin: 2,
    color: {
      dark: '#0f172a', // Deep slate for high contrast
      light: '#ffffff'
    },
    errorCorrectionLevel: 'H'
  });
}

/**
 * Parses and extracts a clean Firestore loan transaction ID from scanned QR text.
 * Supports:
 * - URL format: https://domain/admin/return-loan?id=xyz
 * - Custom URI: labslot:loan:xyz
 * - JSON: {"type":"labslot-loan","id":"xyz"}
 * - Plain ID: xyz (alphanumeric firestore ID)
 */
export function parseLoanId(rawText: string): string | null {
  if (!rawText || typeof rawText !== 'string') return null;
  const trimmed = rawText.trim();

  // 1. Check custom URI format
  if (trimmed.startsWith('labslot:loan:')) {
    const id = trimmed.replace('labslot:loan:', '').trim();
    return id.length >= 6 ? id : null;
  }

  // 2. Check JSON format
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed.id === 'string' && parsed.id.length >= 6) {
        return parsed.id.trim();
      }
    } catch {
      // Not JSON, continue
    }
  }

  // 3. Check URL format
  try {
    const url = new URL(trimmed);
    const idParam = url.searchParams.get('id');
    if (idParam && idParam.trim().length >= 6) {
      return idParam.trim();
    }
    // Check path like /admin/return/xyz
    const pathParts = url.pathname.split('/').filter(Boolean);
    const lastPart = pathParts[pathParts.length - 1];
    if (pathParts.includes('return') || pathParts.includes('return-loan')) {
      if (lastPart && lastPart.length >= 6 && !lastPart.includes('.')) {
        return lastPart;
      }
    }
  } catch {
    // Not a full URL, continue
  }

  // 4. Raw alphanumeric Firestore Document ID fallback (e.g. 20 chars like "8xJ3kA2L9zP1qW4eR7tY")
  if (/^[a-zA-Z0-9_-]{6,64}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}
