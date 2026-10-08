/**
 * Injected into the AI chat tab (classic script, no ES imports).
 * Receives payload via chrome.runtime.onMessage { type: 'AIS_RUN', payload }.
 *
 * Adapter DOM logic is duplicated here (best-effort) because scripting.executeScript
 * cannot load ES modules. Keep roughly in sync with src/adapters/*.js.
 */
(function () {
  if (window.__AIS_INJECTOR_LOADED__) return;
  window.__AIS_INJECTOR_LOADED__ = true;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function waitFor(fn, timeout = 15000, interval = 250) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const v = fn();
        if (v) return v;
      } catch (_) {}
      await sleep(interval);
    }
    return null;
  }

  function queryFirst(selectors) {
    for (const sel of selectors) {
      if (!sel) continue;
      try {
        const el = document.querySelector(sel);
        if (el) return el;
      } catch (_) {}
    }
    return null;
  }

  function isVisibleEl(el) {
    if (!el || el.getAttribute?.('aria-hidden') === 'true') return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (Number(style.opacity) === 0) return false;
    const rects = el.getClientRects();
    if (rects && rects.length > 0) return true;
    if (el.offsetParent !== null) return true;
    if (style.position === 'fixed' || style.position === 'sticky') {
      const r = el.getBoundingClientRect();
      return Boolean(r && (r.width > 0 || r.height > 0));
    }
    return false;
  }

  const PROMPT_HINT_RE =
    /ask|message|prompt|输入|消息|send a message|chat|compose|write|说点什么|提问|type a|what do you|跟\s*grok|talk to/i;

  /** Prefer visible bottom-of-page composers with Ask/Message/Prompt labels */
  function findBestComposer(selectors) {
    const candidates = [];
    const seen = new Set();
    for (const sel of selectors || []) {
      if (!sel) continue;
      try {
        document.querySelectorAll(sel).forEach((el) => {
          if (seen.has(el)) return;
          seen.add(el);
          candidates.push(el);
        });
      } catch (_) {}
    }
    if (!candidates.length) return null;

    const visible = candidates.filter(isVisibleEl);
    const pool = visible.length ? visible : candidates;
    const vh = window.innerHeight || 800;

    const score = (el) => {
      let s = 0;
      const rect = el.getBoundingClientRect();
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

  function base64ToUint8Array(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function fileFromPayload(payload) {
    const bytes = base64ToUint8Array(payload.base64);
    return new File([bytes], payload.filename || 'image.png', {
      type: payload.mime || 'image/png',
    });
  }

  function putFileOnInput(input, file) {
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function dropFileOn(el, file) {
    const dt = new DataTransfer();
    dt.items.add(file);
    const opts = { bubbles: true, cancelable: true, dataTransfer: dt };
    ['dragenter', 'dragover', 'drop'].forEach((type) => {
      el.dispatchEvent(new DragEvent(type, opts));
    });
  }

  function findFileInput(extra) {
    const sels = [
      ...(extra || []),
      'input[type="file"][accept*="image"]',
      'input[type="file"]',
    ];
    const found = [];
    for (const sel of sels) {
      try {
        document.querySelectorAll(sel).forEach((el) => found.push(el));
      } catch (_) {}
    }
    for (const input of found) {
      const style = getComputedStyle(input);
      if (style.display !== 'none' && style.visibility !== 'hidden') return input;
    }
    return found[0] || null;
  }

  function clickAttach(patterns) {
    const nodes = document.querySelectorAll('button, [role="button"], label');
    for (const el of nodes) {
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

  /** React-friendly set: native value setter + InputEvent; verify + retry */
  async function setComposerText(el, text) {
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
        } catch (_) {}
        return true;
      }

      if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
        el.focus();
        try {
          document.execCommand('selectAll', false);
          const inserted = document.execCommand('insertText', false, text);
          if (!inserted) el.textContent = text;
        } catch (_) {
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
        } catch (_) {
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

  function toast(message, level) {
    const id = 'ai-image-sender-toast';
    document.getElementById(id)?.remove();
    const el = document.createElement('div');
    el.id = id;
    el.setAttribute('role', 'status');
    const bg = level === 'error' ? '#b91c1c' : level === 'success' ? '#15803d' : '#1e293b';
    Object.assign(el.style, {
      position: 'fixed',
      zIndex: '2147483647',
      top: '16px',
      right: '16px',
      maxWidth: '380px',
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
    setTimeout(() => el.remove(), 9000);
  }

  async function copyImageFallback(payload) {
    try {
      if (!navigator.clipboard || !window.ClipboardItem) {
        return { ok: false, error: 'Clipboard API unavailable' };
      }
      let blob = new Blob([base64ToUint8Array(payload.base64)], {
        type: payload.mime || 'image/png',
      });
      if (blob.type !== 'image/png') {
        try {
          const bmp = await createImageBitmap(blob);
          const canvas = document.createElement('canvas');
          canvas.width = bmp.width;
          canvas.height = bmp.height;
          canvas.getContext('2d').drawImage(bmp, 0, 0);
          blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
        } catch (_) {}
      }
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e?.message || e) };
    }
  }

  /** Per-adapter selector packs (maintain when sites change) */
  const ADAPTER_UI = {
    grok: {
      // Best-effort: grok.com DOM changes often
      ready: [
        'textarea[placeholder]',
        'textarea[aria-label]',
        'form textarea',
        'textarea',
        'div[contenteditable="true"]',
        '[role="textbox"]',
        'main',
      ],
      prompt: [
        'textarea[placeholder*="Ask" i]',
        'textarea[placeholder*="Grok" i]',
        'textarea[placeholder*="Message" i]',
        'textarea[aria-label*="Ask" i]',
        'textarea[aria-label*="Message" i]',
        'textarea[aria-label*="Prompt" i]',
        '[data-testid*="composer"] textarea',
        '[data-testid*="chat"] textarea',
        'form textarea',
        'footer textarea',
        'textarea',
        'div[contenteditable="true"][role="textbox"]',
        'div[contenteditable="true"]',
        '[role="textbox"]',
      ],
      attachPatterns: [/attach/i, /upload/i, /image/i, /media/i, /photo/i, /file/i, /paperclip/i],
      // Prefer non-composer drop targets so attach does not wipe prompt
      drop: ['form', 'main', '#__next', 'body'],
      submit: [
        'button[aria-label*="Submit"]',
        'button[aria-label*="Send"]',
        'button[type="submit"]',
        'button[data-testid*="send"]',
      ],
    },
    chatgpt: {
      ready: [
        '#prompt-textarea',
        'div[contenteditable="true"]',
        '[data-testid="composer"]',
        'main',
      ],
      prompt: [
        '#prompt-textarea',
        'div[contenteditable="true"]#prompt-textarea',
        'textarea#prompt-textarea',
        'div[contenteditable="true"][data-id]',
        'div[contenteditable="true"]',
        'textarea',
      ],
      attachPatterns: [/upload files/i, /attach/i, /upload/i, /add photos/i, /添加/i, /上传/i],
      drop: ['[data-testid="composer"]', 'form', 'main', 'body'],
      submit: ['button[data-testid="send-button"]', 'button[aria-label*="Send"]'],
    },
    gemini: {
      ready: ['rich-textarea', 'div[contenteditable="true"]', 'textarea', 'main'],
      prompt: [
        'rich-textarea div[contenteditable="true"]',
        'div[contenteditable="true"][aria-label]',
        'div[contenteditable="true"]',
        'textarea',
        '[role="textbox"]',
      ],
      attachPatterns: [/upload/i, /image/i, /photo/i, /open upload/i, /添加/i, /上传/i, /图片/i],
      drop: ['form', 'main', 'body'],
      submit: ['button[aria-label*="Send"]', 'button[aria-label*="发送"]'],
    },
    claude: {
      ready: ['div[contenteditable="true"]', 'textarea', 'main'],
      prompt: [
        'div[contenteditable="true"].ProseMirror',
        'div.ProseMirror[contenteditable="true"]',
        'fieldset div[contenteditable="true"]',
        'div[contenteditable="true"]',
        'textarea',
        '[role="textbox"]',
      ],
      attachPatterns: [/upload a file/i, /attach/i, /upload/i, /paperclip/i, /添加/i, /上传/i],
      drop: ['fieldset', 'form', 'main', 'body'],
      submit: ['button[aria-label*="Send"]', 'button[aria-label*="发送"]'],
    },
  };

  function uiFor(payload) {
    if (payload.adapterId && ADAPTER_UI[payload.adapterId]) {
      return ADAPTER_UI[payload.adapterId];
    }
    // Custom: build from selectors in payload.custom
    const c = payload.custom || {};
    return {
      ready: [c.promptSelector, c.fileInputSelector, c.dropZoneSelector, 'textarea', 'div[contenteditable="true"]', 'body'].filter(Boolean),
      prompt: [c.promptSelector, 'textarea', 'div[contenteditable="true"]', '[role="textbox"]'].filter(Boolean),
      attachPatterns: [/attach/i, /upload/i, /image/i, /file/i],
      drop: [c.dropZoneSelector, 'form', 'main', 'body'].filter(Boolean),
      submit: c.submitSelector ? [c.submitSelector] : [],
      fileInputSelector: c.fileInputSelector,
    };
  }

  async function attachImage(ui, file) {
    if (ui.fileInputSelector) {
      const input =
        queryFirst([ui.fileInputSelector]) ||
        (await waitFor(() => queryFirst([ui.fileInputSelector]), 5000));
      if (input) {
        putFileOnInput(input, file);
        return { ok: true, method: 'custom-file-input' };
      }
    }

    // Prefer file-input path; only drop if no input can be found
    let input = findFileInput();
    if (!input) {
      clickAttach(ui.attachPatterns || []);
      await sleep(450);
      input = await waitFor(() => findFileInput(), 6000);
    }
    if (input) {
      putFileOnInput(input, file);
      return { ok: true, method: 'file-input' };
    }

    // Last resort: drop on form/main/body — avoid composer to not wipe text
    const dropTarget = queryFirst(ui.drop || ['form', 'main', 'body']) || document.body;
    dropFileOn(dropTarget, file);
    return { ok: true, method: 'drop' };
  }

  async function fillPrompt(ui, text) {
    if (!text) return { ok: true, skipped: true };
    const sels = ui.prompt || [];
    const el =
      findBestComposer(sels) ||
      (await waitFor(() => findBestComposer(sels), 8000));
    if (!el) return { ok: false, error: 'Composer not found' };
    const ok = await setComposerText(el, text);
    return ok
      ? { ok: true }
      : { ok: false, error: 'Failed to fill prompt (React composer did not accept text)' };
  }

  async function maybeSubmit(ui, autoSubmit) {
    if (!autoSubmit) return { ok: false, skipped: true };
    const sels = ui.submit || [];
    const btn = queryFirst(sels);
    if (!btn || btn.disabled) return { ok: false, error: 'Send button missing' };
    btn.click();
    return { ok: true };
  }

  async function run(payload) {
    const ui = uiFor(payload);
    await waitFor(() => queryFirst(ui.ready || ['body']), 20000);
    await sleep(350);

    const promptText = payload.prompt || '';
    let promptResult = { ok: true, skipped: !promptText };

    // 1) Fill prompt first (before attach can wipe / remount composer)
    try {
      promptResult = await fillPrompt(ui, promptText);
    } catch (e) {
      promptResult = { ok: false, error: String(e?.message || e) };
    }

    const file = fileFromPayload(payload);
    let attachResult;
    try {
      attachResult = await attachImage(ui, file);
    } catch (e) {
      attachResult = { ok: false, error: String(e?.message || e) };
    }

    // 2) Re-fill after upload UI — attach often clears the composer
    await sleep(650);
    if (promptText) {
      try {
        const second = await fillPrompt(ui, promptText);
        promptResult = second;
      } catch (e) {
        promptResult = { ok: false, error: String(e?.message || e) };
      }
    }

    if (!attachResult.ok) {
      const clip = await copyImageFallback(payload);
      if (clip.ok) {
        toast(
          '自动上传失败，图片已复制到剪贴板。请在对话框中粘贴 (Ctrl/Cmd+V)。\nAuto-upload failed — image copied. Paste into the chat.' +
            (promptResult.ok && !promptResult.skipped
              ? '\n提示词已尝试填入 / Prompt fill attempted.'
              : promptText
                ? '\n提示词未填入：' + (promptResult.error || 'unknown')
                : ''),
          'info'
        );
      } else {
        toast(
          '自动上传失败，且无法写入剪贴板：' + (attachResult.error || clip.error || ''),
          'error'
        );
      }
      return { ok: false, attachResult, promptResult, clipboard: clip };
    }

    if (promptText && !promptResult.ok) {
      toast(
        '图片已附上，但提示词未能写入输入框（站点可能改了 DOM / React 未接受赋值）。请手动粘贴提示词。\nImage attached, but prompt was not filled. Paste the prompt manually.',
        'error'
      );
    }

    const submitResult = await maybeSubmit(ui, payload.autoSubmit);

    const promptOk = !promptText || promptResult.ok;
    const promptSkipped = promptResult.skipped;
    let summary;
    if (promptSkipped) {
      summary =
        '图片已尝试填入（无提示词）' +
        (payload.autoSubmit && submitResult.ok ? '并发送' : '（未自动发送）') +
        '。\nImage injected (no prompt)' +
        (payload.autoSubmit && submitResult.ok ? ' & submitted' : ' (not auto-sent)') +
        '.';
    } else if (promptOk) {
      summary =
        '图片与提示词已填入' +
        (payload.autoSubmit && submitResult.ok ? '并发送' : '（未自动发送）') +
        '。\nImage + prompt injected' +
        (payload.autoSubmit && submitResult.ok ? ' & submitted' : ' (not auto-sent)') +
        '.';
    } else {
      summary =
        '图片已附上，提示词未写入。\nImage attached; prompt NOT filled.';
    }

    // Avoid a second success toast if we already showed the prompt-fail error
    if (!(promptText && !promptResult.ok)) {
      toast(summary, promptOk ? 'success' : 'info');
    }

    return {
      ok: attachResult.ok && promptOk,
      attachResult,
      promptResult,
      submitResult,
    };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.type !== 'AIS_RUN') return;
    run(msg.payload)
      .then((result) => sendResponse(result))
      .catch((e) => sendResponse({ ok: false, error: String(e?.message || e) }));
    return true;
  });
})();
