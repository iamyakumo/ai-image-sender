/**
 * Grok (grok.com) adapter — selectors are best-effort and need maintenance
 */
import {
  waitFor,
  queryFirst,
  findBestComposer,
  genericAttachImage,
  genericFillPrompt,
  genericSubmit,
  sleep,
} from './_helpers.js';

/** Common grok.com composer selectors (DOM changes often — keep best-effort) */
const GROK_PROMPT_SELECTORS = [
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
  'textarea[aria-label]',
  'textarea[placeholder]',
  'textarea',
  'div[contenteditable="true"][role="textbox"]',
  'div[contenteditable="true"]',
  '[role="textbox"]',
];

export default {
  id: 'grok',
  name: 'Grok',
  hostPatterns: ['grok.com', 'www.grok.com'],
  matchHost(hostname) {
    return /(^|\.)grok\.com$/i.test(hostname);
  },
  chatUrl: 'https://grok.com/',

  async waitReady(doc) {
    // Wait for main chat shell / composer
    const el = await waitFor(
      () =>
        findBestComposer(doc, GROK_PROMPT_SELECTORS) ||
        queryFirst(doc, ['textarea', 'div[contenteditable="true"]', '[role="textbox"]', 'main']),
      { timeout: 20000 }
    );
    await sleep(300);
    return Boolean(el);
  },

  async attachImage(doc, file) {
    // Prefer file input; drop on form/main/body (not composer) to avoid wiping prompt
    return genericAttachImage(doc, file, {
      fileSelectors: [
        'input[type="file"][accept*="image"]',
        'input[type="file"]',
      ],
      attachButtonPatterns: [
        /attach/i,
        /upload/i,
        /image/i,
        /media/i,
        /photo/i,
        /file/i,
        /paperclip/i,
      ],
      dropSelectors: ['form', 'main', '#__next', 'body'],
    });
  },

  async fillPrompt(doc, text) {
    return genericFillPrompt(doc, text, GROK_PROMPT_SELECTORS);
  },

  async submit(doc) {
    return genericSubmit(doc, [
      'button[aria-label*="Submit"]',
      'button[aria-label*="Send"]',
      'button[type="submit"]',
      'button[data-testid*="send"]',
    ]);
  },
};
