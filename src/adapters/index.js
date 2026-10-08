/**
 * Adapter registry — built-ins + custom from storage
 */
import grok from './grok.js';
import chatgpt from './chatgpt.js';
import gemini from './gemini.js';
import claude from './claude.js';
import { createCustomAdapter } from './custom.js';

export const BUILTIN_ADAPTERS = [grok, chatgpt, gemini, claude];

const byId = Object.fromEntries(BUILTIN_ADAPTERS.map((a) => [a.id, a]));

/**
 * @param {string} id
 * @param {Array} [customTargets]
 */
export function getAdapter(id, customTargets = []) {
  if (byId[id]) return byId[id];
  const cfg = (customTargets || []).find((t) => t.id === id);
  if (cfg) return createCustomAdapter(cfg);
  return null;
}

/**
 * List for menus / popup
 * @param {Array} customTargets
 */
export function listTargets(customTargets = []) {
  const builtins = BUILTIN_ADAPTERS.map((a) => ({
    id: a.id,
    name: a.name,
    chatUrl: typeof a.chatUrl === 'function' ? a.chatUrl() : a.chatUrl,
    builtin: true,
  }));
  const customs = (customTargets || []).map((t) => ({
    id: t.id,
    name: t.name,
    chatUrl: t.chatUrl,
    builtin: false,
  }));
  return [...builtins, ...customs];
}

export function resolveChatUrl(adapter) {
  if (!adapter) return null;
  return typeof adapter.chatUrl === 'function' ? adapter.chatUrl() : adapter.chatUrl;
}

export { createCustomAdapter };
