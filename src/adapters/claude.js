/**
 * Claude (claude.ai) adapter
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
  id: 'claude',
  name: 'Claude',
  hostPatterns: ['claude.ai'],
  matchHost(hostname) {
    return /(^|\.)claude\.ai$/i.test(hostname);
  },
  chatUrl: 'https://claude.ai/new',

  async waitReady(doc) {
    const el = await waitFor(
      () =>
        queryFirst(doc, [
          'div[contenteditable="true"]',
          'fieldset textarea',
          'textarea',
          '[data-testid="chat-input"]',
          'main',
        ]),
      { timeout: 20000 }
    );
    await sleep(400);
    return Boolean(el);
  },

  async attachImage(doc, file) {
    // Claude: paperclip / "Upload a file…" near composer
    return genericAttachImage(doc, file, {
      fileSelectors: [
        'input[type="file"][accept*="image"]',
        'input[type="file"]',
      ],
      attachButtonPatterns: [
        /upload a file/i,
        /attach/i,
        /upload/i,
        /file/i,
        /paperclip/i,
        /添加/i,
        /上传/i,
      ],
      dropSelectors: [
        'div[contenteditable="true"]',
        'fieldset',
        'form',
        'main',
        'body',
      ],
    });
  },

  async fillPrompt(doc, text) {
    return genericFillPrompt(doc, text, [
      'div[contenteditable="true"].ProseMirror',
      'div[contenteditable="true"]',
      '[data-testid="chat-input"]',
      'fieldset textarea',
      'textarea',
      '[role="textbox"]',
    ]);
  },

  async submit(doc) {
    return genericSubmit(doc, [
      'button[aria-label*="Send"]',
      'button[aria-label*="发送"]',
      'button[type="button"][aria-label*="Message"]',
    ]);
  },
};
