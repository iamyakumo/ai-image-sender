/**
 * Source-page content script — help background resolve image URLs / blobs
 * when contextMenus info.srcUrl is missing (e.g. background-image, canvas).
 */
(function () {
  if (window.__AI_IMAGE_SENDER_SOURCE__) return;
  window.__AI_IMAGE_SENDER_SOURCE__ = true;

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.type !== 'AIS_GET_IMAGE') return;

    (async () => {
      try {
        // Prefer element under last right-click
        const el = window.__AIS_LAST_IMG__ || document.querySelector('img:hover');
        if (el && el.tagName === 'IMG' && el.src) {
          sendResponse({ ok: true, url: el.src, naturalWidth: el.naturalWidth });
          return;
        }
        if (msg.srcUrl) {
          sendResponse({ ok: true, url: msg.srcUrl });
          return;
        }
        sendResponse({ ok: false, error: 'No image found' });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();

    return true; // async
  });

  // Track last contextmenu image
  document.addEventListener(
    'contextmenu',
    (e) => {
      const t = e.target;
      if (t && t.tagName === 'IMG') {
        window.__AIS_LAST_IMG__ = t;
      } else if (t && t.closest) {
        const img = t.closest('img');
        window.__AIS_LAST_IMG__ = img || null;
      }
    },
    true
  );
})();
