/**
 * Dynamic QR Code Attendance Utility for AcademiaHub
 * Cryptographically generates 1-second rotating HMAC tokens matching the backend algorithm.
 */

export interface DynamicQrPayload {
  sid: string;      // sessionId
  cid: string;      // checkpointId
  t: number;        // timestamp in seconds (synchronized to server)
  hash: string;     // 16-character HMAC-SHA256 signature
  type?: string;    // 'START' | 'END'
}

/**
 * Generate a 1-second time-based dynamic token for an attendance checkpoint
 * using the browser's native Web Crypto API.
 */
export async function generateDynamicQrToken(
  secret: string,
  checkpointId: string,
  timestampSeconds: number
): Promise<string> {
  if (!secret || !checkpointId) return '';

  const enc = new TextEncoder();
  const keyData = enc.encode(secret);
  const msgData = enc.encode(`${checkpointId}:${timestampSeconds}`);

  try {
    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, msgData);
    const hashArray = Array.from(new Uint8Array(signature));
    const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hex.substring(0, 16);
  } catch (err) {
    console.error('Failed to generate dynamic QR token via Web Crypto:', err);
    return '';
  }
}

/**
 * Serializes dynamic attendance payload into a compact JSON string for high QR scannability
 */
export function formatQrPayload(payload: DynamicQrPayload): string {
  return JSON.stringify({
    sid: payload.sid,
    cid: payload.cid,
    t: payload.t,
    hash: payload.hash,
    type: payload.type
  });
}

/**
 * Parses and validates raw scanned QR string from student camera
 */
export function parseScannedQr(raw: string): DynamicQrPayload | null {
  if (!raw || typeof raw !== 'string') return null;

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.cid && parsed.t && parsed.hash) {
      return {
        sid: parsed.sid || '',
        cid: String(parsed.cid),
        t: Number(parsed.t),
        hash: String(parsed.hash),
        type: parsed.type
      };
    }
  } catch {
    // Colon-delimited format support: AH_ATTEND:<cid>:<sid>:<t>:<hash>
    if (raw.startsWith('AH_ATTEND:')) {
      const parts = raw.split(':');
      if (parts.length >= 5) {
        return {
          cid: parts[1],
          sid: parts[2],
          t: Number(parts[3]),
          hash: parts[4]
        };
      }
    }
  }

  return null;
}

/**
 * Plays a pleasant modern audio chime when a valid QR is successfully scanned
 */
export function playScanSuccessSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // Two-tone pleasant ascending chime (800Hz -> 1200Hz)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.15);
    
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {
    // Ignore audio errors if blocked by browser policy
  }
}
