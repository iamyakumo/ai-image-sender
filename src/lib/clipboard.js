/**
 * Clipboard fallback — copy image (or open blob) when auto-upload fails
 */

import { base64ToUint8Array } from './image.js';

/**
 * Try to write image bytes to the system clipboard as image/png (or original mime).
 * Must run in a page/context that has focus; service worker support is limited.
 * @param {string} base64
 * @param {string} mime
 * @returns {Promise<{ok:boolean, error?:string}>}
 */
export async function copyImageToClipboard(base64, mime) {
  try {
    if (!navigator.clipboard || !window.ClipboardItem) {
      return { ok: false, error: 'ClipboardItem not available' };
    }
    const bytes = base64ToUint8Array(base64);
    // Many browsers only accept image/png on clipboard
    let blob = new Blob([bytes], { type: mime || 'image/png' });
    if (mime && mime !== 'image/png') {
      try {
        blob = await ensurePngBlob(blob);
      } catch {
        /* keep original */
      }
    }
    await navigator.clipboard.write([
      new ClipboardItem({ [blob.type]: blob }),
    ]);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

async function ensurePngBlob(blob) {
  const bmp = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bmp, 0, 0);
  return canvas.convertToBlob({ type: 'image/png' });
}

/**
 * Show a non-blocking toast on the page
 * @param {string} message
 * @param {'info'|'success'|'error'} level
 */
export function showPageToast(message, level = 'info') {
  const id = 'ai-image-sender-toast';
  document.getElementById(id)?.remove();
  const el = document.createElement('div');
  el.id = id;
  el.setAttribute('role', 'status');
  const bg =
    level === 'error' ? '#b91c1c' :
    level === 'success' ? '#15803d' : '#1e293b';
  Object.assign(el.style, {
    position: 'fixed',
    zIndex: '2147483647',
    top: '16px',
    right: '16px',
    maxWidth: '360px',
    padding: '12px 16px',
    borderRadius: '10px',
    background: bg,
    color: '#fff',
    font: '13px/1.45 system-ui, -apple-system, Segoe UI, sans-serif',
    boxShadow: '0 8px 24px rgba(0,0,0,.35)',
    whiteSpace: 'pre-wrap',
  });
  el.textContent = message;
  document.documentElement.appendChild(el);
  setTimeout(() => el.remove(), 8000);
}
