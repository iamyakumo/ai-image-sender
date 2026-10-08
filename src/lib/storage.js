/**
 * chrome.storage.sync helpers — settings, default prompt, custom targets
 */

export const DEFAULT_PROMPT = `Convert this anime/2D illustration into a photorealistic photograph of a real person.
Keep the exact same pose, framing, clothing, hairstyle, facial expression, accessories, and overall composition.
Realistic human anatomy, natural skin texture with pores and subtle imperfections, realistic hair strands, natural lighting, photographic depth of field, high detail, shot as a real camera photo.
No anime style, no illustration look, no cartoon features, no overly smooth plastic skin.`;

export const BUILTIN_TARGET_IDS = ['grok', 'chatgpt', 'gemini', 'claude'];

const DEFAULTS = {
  defaultPrompt: DEFAULT_PROMPT,
  autoSubmit: false,
  lastTargetId: 'grok',
  customTargets: [],
};

/**
 * Resolve a usable default prompt: empty sync string falls back to DEFAULT_PROMPT,
 * then optionally chrome.storage.local.defaultPrompt if set.
 * @param {string|undefined|null} syncPrompt
 */
async function resolveDefaultPrompt(syncPrompt) {
  if (typeof syncPrompt === 'string' && syncPrompt.trim()) {
    return syncPrompt;
  }
  try {
    const local = await chrome.storage.local.get(['defaultPrompt']);
    if (typeof local.defaultPrompt === 'string' && local.defaultPrompt.trim()) {
      return local.defaultPrompt;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_PROMPT;
}

/**
 * @returns {Promise<{defaultPrompt:string, autoSubmit:boolean, lastTargetId:string, customTargets:Array}>}
 */
export async function getSettings() {
  const data = await chrome.storage.sync.get(DEFAULTS);
  const defaultPrompt = await resolveDefaultPrompt(data.defaultPrompt);
  return {
    defaultPrompt,
    autoSubmit: Boolean(data.autoSubmit),
    lastTargetId: data.lastTargetId || 'grok',
    customTargets: Array.isArray(data.customTargets) ? data.customTargets : [],
  };
}

/**
 * @param {Partial<typeof DEFAULTS>} partial
 */
export async function saveSettings(partial) {
  const current = await getSettings();
  const next = { ...current, ...partial };
  // Persist empty string as intentional clear only if caller passes non-empty or DEFAULT;
  // empty string in save would be treated as fallback on next get — store DEFAULT instead.
  if (typeof next.defaultPrompt === 'string' && !next.defaultPrompt.trim()) {
    next.defaultPrompt = DEFAULT_PROMPT;
  }
  await chrome.storage.sync.set(next);
  return next;
}

/**
 * Session storage for short-lived image payloads (base64) between SW and injector.
 * @param {string} key
 * @param {object} value
 */
export async function setSessionPayload(key, value) {
  if (chrome.storage.session) {
    await chrome.storage.session.set({ [key]: value });
  } else {
    // Fallback for older Chrome: use local with TTL cleanup
    await chrome.storage.local.set({ [`session:${key}`]: { ...value, _ts: Date.now() } });
  }
}

export async function getSessionPayload(key) {
  if (chrome.storage.session) {
    const data = await chrome.storage.session.get(key);
    return data[key] ?? null;
  }
  const data = await chrome.storage.local.get(`session:${key}`);
  return data[`session:${key}`] ?? null;
}

export async function clearSessionPayload(key) {
  if (chrome.storage.session) {
    await chrome.storage.session.remove(key);
  } else {
    await chrome.storage.local.remove(`session:${key}`);
  }
}

/**
 * Export all sync settings as JSON-serializable object
 */
export async function exportSettings() {
  return getSettings();
}

/**
 * Import settings from object (merge or replace customTargets)
 * @param {object} obj
 * @param {{replace?: boolean}} opts
 */
export async function importSettings(obj, opts = {}) {
  if (!obj || typeof obj !== 'object') throw new Error('Invalid settings object');
  const patch = {};
  if (typeof obj.defaultPrompt === 'string') patch.defaultPrompt = obj.defaultPrompt;
  if (typeof obj.autoSubmit === 'boolean') patch.autoSubmit = obj.autoSubmit;
  if (typeof obj.lastTargetId === 'string') patch.lastTargetId = obj.lastTargetId;
  if (Array.isArray(obj.customTargets)) {
    if (opts.replace) {
      patch.customTargets = obj.customTargets;
    } else {
      const cur = await getSettings();
      const byId = new Map(cur.customTargets.map((t) => [t.id, t]));
      for (const t of obj.customTargets) {
        if (t && t.id) byId.set(t.id, t);
      }
      patch.customTargets = [...byId.values()];
    }
  }
  return saveSettings(patch);
}
