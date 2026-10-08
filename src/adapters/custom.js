/**
 * Factory for user-configured custom targets
 */
import {
  waitFor,
  queryFirst,
  putFileOnInput,
  dropFileOn,
  setComposerText,
  sleep,
  findFileInput,
} from './_helpers.js';

/**
 * @param {object} config
 * @param {string} config.id
 * @param {string} config.name
 * @param {string} config.chatUrl
 * @param {string} [config.fileInputSelector]
 * @param {string} [config.dropZoneSelector]
 * @param {string} [config.promptSelector]
 * @param {string} [config.submitSelector]
 * @param {string} [config.defaultPrompt] per-target override (optional)
 */
export function createCustomAdapter(config) {
  const id = config.id;
  let host = '';
  try {
    host = new URL(config.chatUrl).hostname;
  } catch {
    host = '';
  }

  return {
    id,
    name: config.name || 'Custom',
    isCustom: true,
    config,
    hostPatterns: host ? [host] : [],
    matchHost(hostname) {
      return host ? hostname === host || hostname.endsWith('.' + host) : false;
    },
    chatUrl: config.chatUrl,

    async waitReady(doc) {
      const sels = [
        config.promptSelector,
        config.fileInputSelector,
        config.dropZoneSelector,
        'textarea',
        'div[contenteditable="true"]',
        'main',
        'body',
      ].filter(Boolean);
      const el = await waitFor(() => queryFirst(doc, sels), { timeout: 20000 });
      await sleep(200);
      return Boolean(el);
    },

    async attachImage(doc, file) {
      if (config.fileInputSelector) {
        let input = queryFirst(doc, [config.fileInputSelector]);
        if (!input) {
          input = await waitFor(() => queryFirst(doc, [config.fileInputSelector]), {
            timeout: 5000,
          });
        }
        if (input && input.tagName === 'INPUT') {
          try {
            putFileOnInput(input, file);
            return { ok: true, method: 'custom-file-input' };
          } catch (e) {
            return { ok: false, error: String(e?.message || e) };
          }
        }
      }

      // Fallback: any file input
      const input = findFileInput(doc);
      if (input) {
        try {
          putFileOnInput(input, file);
          return { ok: true, method: 'file-input' };
        } catch (e) {
          return { ok: false, error: String(e?.message || e) };
        }
      }

      if (config.dropZoneSelector) {
        const zone = queryFirst(doc, [config.dropZoneSelector]);
        if (zone) {
          try {
            dropFileOn(zone, file);
            return { ok: true, method: 'custom-drop' };
          } catch (e) {
            return { ok: false, error: String(e?.message || e) };
          }
        }
      }

      try {
        dropFileOn(doc.body, file);
        return { ok: true, method: 'body-drop' };
      } catch (e) {
        return { ok: false, error: String(e?.message || e) };
      }
    },

    async fillPrompt(doc, text) {
      const sels = [
        config.promptSelector,
        'textarea',
        'div[contenteditable="true"]',
        '[role="textbox"]',
      ].filter(Boolean);
      const el = queryFirst(doc, sels);
      if (!el) return { ok: false, error: 'Prompt selector not found' };
      return setComposerText(el, text)
        ? { ok: true }
        : { ok: false, error: 'Failed to set prompt' };
    },

    async submit(doc) {
      if (!config.submitSelector) {
        return { ok: false, error: 'No submit selector configured' };
      }
      const btn = queryFirst(doc, [config.submitSelector]);
      if (!btn) return { ok: false, error: 'Submit button not found' };
      btn.click();
      return { ok: true };
    },
  };
}
