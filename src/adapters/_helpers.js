/**
 * Shared DOM helpers for adapters (best-effort; sites change often)
 */

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Wait until predicate returns truthy or timeout
 * @param {() => any} fn
 * @param {{timeout?:number, interval?:number}} opts
 */
export async function waitFor(fn, opts = {}) {
  const timeout = opts.timeout ?? 15000;
  const interval = opts.interval ?? 250;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const v = fn();
      if (v) return v;
    } catch {
      /* ignore */
    }
    await sleep(interval);
  }
  return null;
}

/**
 * Query first matching selector from a list
 * @param {Document|Element} root
 * @param {string[]} selectors
 */
export function queryFirst(root, selectors) {
  for (const sel of selectors) {
    try {
      const el = root.querySelector(sel);
      if (el) return el;
    } catch {
      /* invalid selector */
    }
  }
  return null;
}

function isVisibleEl(el) {
  if (!el || el.getAttribute?.('aria-hidden') === 'true') return false;
  const win = el.ownerDocument?.defaultView || window;
  const style = win.getComputedStyle?.(el);
  if (!style) return true;
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (Number(style.opacity) === 0) return false;
  const rects = el.getClientRects?.();
  if (rects && rects.length > 0) return true;
  if (el.offsetParent !== null) return true;
  if (style.position === 'fixed' || style.position === 'sticky') {
    const r = el.getBoundingClientRect?.();
    return Boolean(r && (r.width > 0 || r.height > 0));
  }
  return false;
}

const PROMPT_HINT_RE =
  /ask|message|prompt|输入|消息|send a message|chat|compose|write|说点什么|提问|type a|what do you|跟\s*grok|talk to/i;

/**
 * Pick the most likely chat composer from selector matches.
 * Prefers visible, bottom-of-viewport, labeled textboxes.
 * @param {Document} doc
 * @param {string[]} selectors
 */
export function findBestComposer(doc, selectors) {
  const candidates = [];
  const seen = new Set();
  for (const sel of selectors || []) {
    if (!sel) continue;
    try {
      doc.querySelectorAll(sel).forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        candidates.push(el);
      });
    } catch {
      /* ignore invalid selector */
    }
  }
  if (!candidates.length) return null;

  const visible = candidates.filter(isVisibleEl);
  const pool = visible.length ? visible : candidates;
  const vh = doc.defaultView?.innerHeight || window.innerHeight || 800;

  const score = (el) => {
    let s = 0;
    const rect = el.getBoundingClientRect();
    // Composer is usually near the bottom
    s += Math.max(0, Math.min(120, (rect.bottom / vh) * 120));
    if (rect.top > vh * 0.35) s += 35;
    if (el.tagName === 'TEXTAREA') s += 45;
    if (el.getAttribute('role') === 'textbox') s += 30;
    if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') s += 25;
    const hint = [
      el.getAttribute('aria-label'),
      el.getAttribute('placeholder'),
      el.getAttribute('data-placeholder'),
      el.getAttribute('data-testid'),
      el.id,
      el.className?.toString?.(),
    ]
      .filter(Boolean)
      .join(' ');
    if (PROMPT_HINT_RE.test(hint)) s += 55;
    s += Math.min(45, (rect.width * Math.max(rect.height, 24)) / 4000);
    return s;
  };

  pool.sort((a, b) => score(b) - score(a));
  return pool[0];
}

/**
 * Find visible file input
 * @param {Document} doc
 */
export function findFileInput(doc, extraSelectors = []) {
  const selectors = [
    ...extraSelectors,
    'input[type="file"][accept*="image"]',
    'input[type="file"]',
  ];
  const inputs = [];
  for (const sel of selectors) {
    try {
      doc.querySelectorAll(sel).forEach((el) => inputs.push(el));
    } catch {
      /* ignore */
    }
  }
  // Prefer non-hidden
  for (const input of inputs) {
    const style = input.ownerDocument.defaultView?.getComputedStyle?.(input);
    if (!style) return input;
    if (style.display !== 'none' && style.visibility !== 'hidden') return input;
  }
  return inputs[0] || null;
}

/**
 * Click attach/upload button by aria-label / title heuristics
 * @param {Document} doc
 * @param {RegExp[]} patterns
 */
export function clickAttachButton(doc, patterns) {
  const candidates = [
    ...doc.querySelectorAll('button, [role="button"], label'),
  ];
  for (const el of candidates) {
    const label = [
      el.getAttribute('aria-label'),
      el.getAttribute('title'),
      el.getAttribute('data-testid'),
      el.textContent,
    ]
      .filter(Boolean)
      .join(' ');
    if (patterns.some((re) => re.test(label))) {
      el.click();
      return el;
    }
  }
  return null;
}

function composerContainsPrefix(el, text) {
  if (!el || !text) return false;
  const prefix = text.slice(0, Math.min(48, text.length));
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    return (el.value || '').includes(prefix);
  }
  return (el.textContent || '').includes(prefix);
}

/**
 * Fill a textarea or contenteditable (React-friendly).
 * Uses native value setters + InputEvent; verifies and retries once.
 * @param {Element} el
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function setComposerText(el, text) {
  if (!el) return false;

  const applyOnce = () => {
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      el.focus();
      const proto =
        el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc?.set) {
        desc.set.call(el, text);
      } else {
        el.value = text;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      try {
        el.dispatchEvent(
          new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            data: text,
            inputType: 'insertText',
          })
        );
      } catch {
        /* older engines */
      }
      return true;
    }

    if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
      el.focus();
      try {
        document.execCommand('selectAll', false);
        const inserted = document.execCommand('insertText', false, text);
        if (!inserted) el.textContent = text;
      } catch {
        el.textContent = text;
      }
      try {
        el.dispatchEvent(
          new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            data: text,
            inputType: 'insertText',
          })
        );
      } catch {
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return true;
    }
    return false;
  };

  if (!applyOnce()) return false;
  if (composerContainsPrefix(el, text)) return true;
  await sleep(200);
  applyOnce();
  return composerContainsPrefix(el, text);
}

/**
 * Assign file to input via DataTransfer
 */
export function putFileOnInput(input, file) {
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Drop file onto element
 */
export function dropFileOn(el, file) {
  const dt = new DataTransfer();
  dt.items.add(file);
  const opts = { bubbles: true, cancelable: true, dataTransfer: dt };
  for (const type of ['dragenter', 'dragover', 'drop']) {
    el.dispatchEvent(new DragEvent(type, opts));
  }
}

/**
 * Generic attach: try file input, else click attach then file input, else drop
 * (prefer form/main/body — avoid dropping onto the composer which can wipe text)
 */
export async function genericAttachImage(doc, file, opts = {}) {
  const {
    fileSelectors = [],
    attachButtonPatterns = [
      /attach/i,
      /upload/i,
      /image/i,
      /photo/i,
      /file/i,
      /添加/i,
      /上传/i,
      /图片/i,
      /附件/i,
    ],
    // Prefer non-composer drop targets so we do not clear prompt text
    dropSelectors = ['form', 'main', 'body'],
  } = opts;

  let input = findFileInput(doc, fileSelectors);
  if (!input) {
    clickAttachButton(doc, attachButtonPatterns);
    await sleep(400);
    input = await waitFor(() => findFileInput(doc, fileSelectors), { timeout: 5000 });
  }
  if (input) {
    try {
      putFileOnInput(input, file);
      return { ok: true, method: 'file-input' };
    } catch (e) {
      return { ok: false, error: String(e?.message || e) };
    }
  }

  const dropTarget = queryFirst(doc, dropSelectors) || doc.body;
  try {
    dropFileOn(dropTarget, file);
    return { ok: true, method: 'drop' };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export async function genericFillPrompt(doc, text, selectors) {
  if (!text) return { ok: true, skipped: true };
  const list = [
    ...(selectors || []),
    'textarea[placeholder]',
    'div[contenteditable="true"]',
    '[role="textbox"]',
    'textarea',
  ];
  const el =
    findBestComposer(doc, list) ||
    (await waitFor(() => findBestComposer(doc, list), { timeout: 8000 }));
  if (!el) return { ok: false, error: 'Composer not found' };
  const ok = await setComposerText(el, text);
  return ok ? { ok: true } : { ok: false, error: 'Failed to set text' };
}

export async function genericSubmit(doc, selectors = []) {
  const btn =
    queryFirst(doc, selectors) ||
    queryFirst(doc, [
      'button[data-testid*="send"]',
      'button[aria-label*="Send"]',
      'button[aria-label*="发送"]',
      'button[type="submit"]',
    ]);
  if (!btn || btn.disabled) return { ok: false, error: 'Send button not found or disabled' };
  btn.click();
  return { ok: true };
}
