/**
 * Image fetch / File / base64 helpers for the extension context
 */

/**
 * Guess mime from URL or Content-Type
 */
export function guessMime(url, contentType) {
  if (contentType && contentType.startsWith('image/')) {
    return contentType.split(';')[0].trim();
  }
  const u = (url || '').toLowerCase().split('?')[0];
  if (u.endsWith('.png')) return 'image/png';
  if (u.endsWith('.gif')) return 'image/gif';
  if (u.endsWith('.webp')) return 'image/webp';
  if (u.endsWith('.svg')) return 'image/svg+xml';
  if (u.endsWith('.bmp')) return 'image/bmp';
  if (u.endsWith('.jpg') || u.endsWith('.jpeg') || u.endsWith('.jfif')) return 'image/jpeg';
  return 'image/png';
}

export function filenameFromUrl(url, mime) {
  try {
    const path = new URL(url).pathname;
    const base = path.split('/').pop() || 'image';
    if (base.includes('.')) return base.slice(0, 120);
  } catch {
    /* ignore */
  }
  const ext =
    mime === 'image/jpeg' ? 'jpg' :
    mime === 'image/gif' ? 'gif' :
    mime === 'image/webp' ? 'webp' :
    mime === 'image/svg+xml' ? 'svg' : 'png';
  return `image.${ext}`;
}

/**
 * ArrayBuffer → base64 string
 */
export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * base64 → Uint8Array
 */
export function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Fetch image bytes in extension context (uses host_permissions).
 * @param {string} url
 * @returns {Promise<{base64:string, mime:string, filename:string, byteLength:number}>}
 */
export async function fetchImageAsBase64(url) {
  if (!url) throw new Error('Empty image URL');

  if (url.startsWith('data:')) {
    const m = url.match(/^data:([^;,]+)?(?:;[^,]*)?,(.*)$/s);
    if (!m) throw new Error('Invalid data URL');
    const mime = (m[1] || 'image/png').split(';')[0];
    const isBase64 = /;base64/i.test(url.slice(0, url.indexOf(',')));
    const payload = m[2];
    const base64 = isBase64 ? payload : btoa(unescape(encodeURIComponent(payload)));
    return {
      base64,
      mime,
      filename: filenameFromUrl('data-image', mime),
      byteLength: Math.floor((base64.length * 3) / 4),
    };
  }

  const res = await fetch(url, { credentials: 'omit', cache: 'no-cache' });
  if (!res.ok) {
    // Retry with include credentials for same-site hotlink issues
    const res2 = await fetch(url, { credentials: 'include', cache: 'no-cache' });
    if (!res2.ok) throw new Error(`Failed to fetch image: HTTP ${res.status}`);
    const buf = await res2.arrayBuffer();
    const mime = guessMime(url, res2.headers.get('content-type'));
    return {
      base64: arrayBufferToBase64(buf),
      mime,
      filename: filenameFromUrl(url, mime),
      byteLength: buf.byteLength,
    };
  }
  const buf = await res.arrayBuffer();
  const mime = guessMime(url, res.headers.get('content-type'));
  return {
    base64: arrayBufferToBase64(buf),
    mime,
    filename: filenameFromUrl(url, mime),
    byteLength: buf.byteLength,
  };
}

/**
 * Build a File in page/injected context from base64
 */
export function fileFromBase64(base64, mime, filename) {
  const bytes = base64ToUint8Array(base64);
  return new File([bytes], filename || 'image.png', { type: mime || 'image/png' });
}

/**
 * Assign FileList onto an <input type="file"> via DataTransfer
 * @param {HTMLInputElement} input
 * @param {File} file
 */
export function assignFileToInput(input, file) {
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Simulate drag-and-drop of a File onto an element
 * @param {Element} target
 * @param {File} file
 */
export function simulateDrop(target, file) {
  const dt = new DataTransfer();
  dt.items.add(file);
  const opts = { bubbles: true, cancelable: true, dataTransfer: dt };
  for (const type of ['dragenter', 'dragover', 'drop']) {
    target.dispatchEvent(new DragEvent(type, opts));
  }
}
