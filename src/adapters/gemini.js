/**
 * Google Gemini (gemini.google.com) adapter
 */
import {
  waitFor,
  queryFirst,
  genericAttachImage,
  genericFillPrompt,
  genericSubmit,
  sleep,
} from './_helpers.js';

export default {
  id: 'gemini',
  name: 'Gemini',
  hostPatterns: ['gemini.google.com'],
  matchHost(hostname) {
    return /(^|\.)gemini\.google\.com$/i.test(hostname);
  },
  chatUrl: 'https://gemini.google.com/app',

  async waitReady(doc) {
    const el = await waitFor(
      () =>
        queryFirst(doc, [
          'rich-textarea',
          'div[contenteditable="true"]',
          'textarea',
          '[aria-label*="Prompt"]',
          'main',
        ]),
      { timeout: 20000 }
    );
    await sleep(400);
    return Boolean(el);
  },

  async attachImage(doc, file) {
    // Gemini: "Open upload file menu" / image button near composer
    return genericAttachImage(doc, file, {
      fileSelectors: [
        'input[type="file"][accept*="image"]',
        'input[type="file"]',
      ],
      attachButtonPatterns: [
        /upload/i,
        /image/i,
        /photo/i,
        /open upload/i,
        /insert/i,
        /添加/i,
        /上传/i,
        /图片/i,
      ],
      dropSelectors: [
        'rich-textarea',
        'div[contenteditable="true"]',
        'form',
        'main',
        'body',
      ],
    });
  },

  async fillPrompt(doc, text) {
    return genericFillPrompt(doc, text, [
      'rich-textarea div[contenteditable="true"]',
      'div[contenteditable="true"][aria-label]',
      'div[contenteditable="true"]',
      'textarea',
      '[role="textbox"]',
    ]);
  },

  async submit(doc) {
    return genericSubmit(doc, [
      'button[aria-label*="Send"]',
      'button[aria-label*="发送"]',
      'button.send-button',
      'button[mattooltip*="Send"]',
    ]);
  },
};
