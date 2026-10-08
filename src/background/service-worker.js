/**
 * Background service worker (MV3, ES module)
 * - Context menus for images
 * - Fetch image → open AI tab → inject target-injector → AIS_RUN
 */
import { getSettings, saveSettings, setSessionPayload } from '../lib/storage.js';
import { fetchImageAsBase64 } from '../lib/image.js';
import { getAdapter, listTargets, resolveChatUrl, BUILTIN_ADAPTERS } from '../adapters/index.js';

const MENU_PARENT = 'ais_send_parent';
const MENU_PREFIX = 'ais_send_';
const MENU_CUSTOM_PICKER = 'ais_send_custom_picker';

async function rebuildContextMenus() {
  await chrome.contextMenus.removeAll();
  const settings = await getSettings();
  const targets = listTargets(settings.customTargets);

  chrome.contextMenus.create({
    id: MENU_PARENT,
    title: 'Send to… / 发送到…',
    contexts: ['image'],
  });

  for (const t of BUILTIN_ADAPTERS) {
    chrome.contextMenus.create({
      id: MENU_PREFIX + t.id,
      parentId: MENU_PARENT,
      title: t.name,
      contexts: ['image'],
    });
  }

  // Custom targets as direct items
  for (const t of settings.customTargets || []) {
    chrome.contextMenus.create({
      id: MENU_PREFIX + t.id,
      parentId: MENU_PARENT,
      title: t.name || 'Custom',
      contexts: ['image'],
    });
  }

  chrome.contextMenus.create({
    id: MENU_CUSTOM_PICKER,
    parentId: MENU_PARENT,
    title: 'Custom… / 管理自定义站点',
    contexts: ['image'],
  });

  // Keep reference to avoid unused warning in some bundlers
  void targets;
}

chrome.runtime.onInstalled.addListener(() => {
  rebuildContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
  rebuildContextMenus();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.customTargets) {
    rebuildContextMenus();
  }
});

/**
 * Resolve image URL from context menu or source tab
 */
async function resolveImageUrl(info, tab) {
  if (info?.srcUrl) return info.srcUrl;
  if (!tab?.id) return null;
  try {
    const resp = await chrome.tabs.sendMessage(tab.id, {
      type: 'AIS_GET_IMAGE',
      srcUrl: info?.srcUrl,
    });
    if (resp?.ok && resp.url) return resp.url;
  } catch {
    /* content script may be missing on restricted pages */
  }
  return null;
}

function originFromUrl(url) {
  try {
    return new URL(url).origin + '/*';
  } catch {
    return null;
  }
}

/**
 * Ensure host permission for custom targets
 */
async function ensureHostPermission(chatUrl) {
  const pattern = originFromUrl(chatUrl);
  if (!pattern) return { ok: false, error: 'Invalid chat URL' };
  try {
    const have = await chrome.permissions.contains({ origins: [pattern] });
    if (have) return { ok: true };
    const granted = await chrome.permissions.request({ origins: [pattern] });
    return granted
      ? { ok: true }
      : { ok: false, error: 'Host permission denied for ' + pattern };
  } catch (e) {
    // permissions.request only works from user gesture (menu/popup) — OK here
    return { ok: false, error: String(e?.message || e) };
  }
}

/**
 * Open or focus a tab for the chat URL
 */
async function openChatTab(chatUrl) {
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find((t) => {
    try {
      return t.url && new URL(t.url).origin === new URL(chatUrl).origin;
    } catch {
      return false;
    }
  });
  if (existing?.id) {
    await chrome.tabs.update(existing.id, { active: true, url: chatUrl });
    if (existing.windowId != null) {
      await chrome.windows.update(existing.windowId, { focused: true });
    }
    return existing.id;
  }
  const tab = await chrome.tabs.create({ url: chatUrl, active: true });
  return tab.id;
}

function waitTabComplete(tabId, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Tab load timeout'));
    }, timeoutMs);

    function listener(id, info) {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);

    // Already complete?
    chrome.tabs.get(tabId).then((t) => {
      if (t.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }).catch(() => {});
  });
}

async function injectAndRun(tabId, payload) {
  // Small delay for SPA hydration
  await new Promise((r) => setTimeout(r, 800));

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['src/content/target-injector.js'],
  });

  // Retry message a few times (injector may need a tick)
  let lastErr = null;
  for (let i = 0; i < 5; i++) {
    try {
      const result = await chrome.tabs.sendMessage(tabId, {
        type: 'AIS_RUN',
        payload,
      });
      return result;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw lastErr || new Error('Failed to message injector');
}

/**
 * Main send pipeline
 * @param {string} targetId
 * @param {string} imageUrl
 * @param {{prompt?: string}} [opts]
 */
async function sendImageToTarget(targetId, imageUrl, opts = {}) {
  const settings = await getSettings();
  const adapter = getAdapter(targetId, settings.customTargets);
  if (!adapter) throw new Error('Unknown target: ' + targetId);

  const chatUrl = resolveChatUrl(adapter);
  if (!chatUrl) throw new Error('No chat URL for target');

  if (adapter.isCustom) {
    const perm = await ensureHostPermission(chatUrl);
    if (!perm.ok) throw new Error(perm.error || 'Permission denied');
  }

  const image = await fetchImageAsBase64(imageUrl);
  // Guard oversized payloads (~chrome message limits); 8MB base64 is ~6MB binary
  if (image.base64.length > 10 * 1024 * 1024) {
    throw new Error('Image too large to pass to the chat tab (>~7MB). Try a smaller image.');
  }

  let prompt = settings.defaultPrompt;
  if (typeof opts.prompt === 'string') {
    prompt = opts.prompt;
  } else if (adapter.isCustom && adapter.config?.defaultPrompt) {
    prompt = adapter.config.defaultPrompt;
  }

  const payload = {
    adapterId: adapter.isCustom ? 'custom' : adapter.id,
    base64: image.base64,
    mime: image.mime,
    filename: image.filename,
    prompt,
    autoSubmit: Boolean(settings.autoSubmit),
    custom: adapter.isCustom
      ? {
          fileInputSelector: adapter.config.fileInputSelector,
          dropZoneSelector: adapter.config.dropZoneSelector,
          promptSelector: adapter.config.promptSelector,
          submitSelector: adapter.config.submitSelector,
        }
      : undefined,
  };

  const payloadKey = 'ais_' + Date.now();
  await setSessionPayload(payloadKey, { targetId, filename: image.filename });

  await saveSettings({ lastTargetId: targetId });

  const tabId = await openChatTab(chatUrl);
  await waitTabComplete(tabId);
  const result = await injectAndRun(tabId, payload);
  return { result, tabId, payloadKey };
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === MENU_CUSTOM_PICKER) {
      chrome.runtime.openOptionsPage();
      return;
    }
    if (!String(info.menuItemId).startsWith(MENU_PREFIX)) return;
    const targetId = String(info.menuItemId).slice(MENU_PREFIX.length);
    const imageUrl = await resolveImageUrl(info, tab);
    if (!imageUrl) {
      console.error('[AI Image Sender] No image URL');
      return;
    }
    await sendImageToTarget(targetId, imageUrl);
  } catch (e) {
    console.error('[AI Image Sender]', e);
    // Notify source tab if possible
    if (tab?.id) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (msg) => alert(msg),
          args: ['AI Image Sender: ' + String(e?.message || e)],
        });
      } catch {
        /* ignore */
      }
    }
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;

  if (msg.type === 'AIS_GET_SETTINGS') {
    getSettings().then(sendResponse);
    return true;
  }

  if (msg.type === 'AIS_SAVE_SETTINGS') {
    saveSettings(msg.partial || {})
      .then(async (s) => {
        await rebuildContextMenus();
        sendResponse({ ok: true, settings: s });
      })
      .catch((e) => sendResponse({ ok: false, error: String(e?.message || e) }));
    return true;
  }

  if (msg.type === 'AIS_LIST_TARGETS') {
    getSettings().then((s) => sendResponse({ targets: listTargets(s.customTargets), settings: s }));
    return true;
  }

  if (msg.type === 'AIS_SEND') {
    // From popup: { targetId, imageUrl?, prompt? } — imageUrl may come from active tab selection
    (async () => {
      try {
        let imageUrl = msg.imageUrl;
        if (!imageUrl && msg.useActiveTabImage) {
          const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (active?.id) {
            try {
              const resp = await chrome.tabs.sendMessage(active.id, { type: 'AIS_GET_IMAGE' });
              if (resp?.ok) imageUrl = resp.url;
            } catch {
              /* no content script */
            }
          }
        }
        if (!imageUrl) throw new Error('No image URL. Right-click an image instead.');
        const out = await sendImageToTarget(msg.targetId, imageUrl, { prompt: msg.prompt });
        sendResponse({ ok: true, ...out });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }

  if (msg.type === 'AIS_REBUILD_MENUS') {
    rebuildContextMenus().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg.type === 'AIS_REQUEST_ORIGIN') {
    ensureHostPermission(msg.chatUrl).then(sendResponse);
    return true;
  }

  void sender;
});

// Initial menus (in case onInstalled already fired)
rebuildContextMenus().catch(console.error);
