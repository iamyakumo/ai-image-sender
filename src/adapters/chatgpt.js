/**
 * ChatGPT (chatgpt.com / chat.openai.com) adapter
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
  id: 'chatgpt',
  name: 'ChatGPT',
  hostPatterns: ['chatgpt.com', 'chat.openai.com'],
  matchHost(hostname) {
    return /(^|\.)chatgpt\.com$/i.test(hostname) || /(^|\.)chat\.openai\.com$/i.test(hostname);
  },
  chatUrl: 'https://chatgpt.com/',

  async waitReady(doc) {
    const el = await waitFor(
      () =>
        queryFirst(doc, [
          '#prompt-textarea',
          'div[contenteditable="true"]#prompt-textarea',
          'textarea[id="prompt-textarea"]',
          '[data-testid="composer"]',
          'div[contenteditable="true"]',
          'main',
        ]),
      { timeout: 20000 }
    );
    await sleep(400);
    return Boolean(el);
  },

  async attachImage(doc, file) {
    // ChatGPT: "+" or attach / "Upload files and more" button
    return genericAttachImage(doc, file, {
      fileSelectors: [
        'input[type="file"][multiple]',
        'input[type="file"][accept*="image"]',
        'input[type="file"]',
      ],
      attachButtonPatterns: [
        /upload files/i,
        /attach/i,
        /upload/i,
        /add photos/i,
        /plus/i,
        /添加/i,
        /上传/i,
      ],
      dropSelectors: [
        '#prompt-textarea',
        '[data-testid="composer"]',
        'form',
        'main',
        'body',
      ],
    });
  },

  async fillPrompt(doc, text) {
    return genericFillPrompt(doc, text, [
      '#prompt-textarea',
      'div[contenteditable="true"]#prompt-textarea',
      'textarea#prompt-textarea',
      '[data-testid="prompt-textarea"]',
      'div[contenteditable="true"]',
      'textarea',
    ]);
  },

  async submit(doc) {
    return genericSubmit(doc, [
      'button[data-testid="send-button"]',
      'button[aria-label*="Send"]',
      'button[data-testid="fruitjuice-send-button"]',
    ]);
  },
};
