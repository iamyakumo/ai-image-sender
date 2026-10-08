import { getSettings, saveSettings } from '../lib/storage.js';
import { listTargets } from '../adapters/index.js';

const $ = (id) => document.getElementById(id);

function showStatus(text, ok = true) {
  const el = $('status');
  el.hidden = false;
  el.textContent = text;
  el.className = 'status ' + (ok ? 'ok' : 'err');
}

async function load() {
  const settings = await getSettings();
  const targets = listTargets(settings.customTargets);
  const sel = $('target');
  sel.innerHTML = '';
  for (const t of targets) {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.builtin ? t.name : `${t.name} (custom)`;
    sel.appendChild(opt);
  }
  sel.value = settings.lastTargetId || 'grok';
  if (![...sel.options].some((o) => o.value === sel.value)) {
    sel.value = 'grok';
  }
  $('prompt').value = settings.defaultPrompt;
  $('autoSubmit').checked = Boolean(settings.autoSubmit);
}

$('save').addEventListener('click', async () => {
  try {
    await saveSettings({
      lastTargetId: $('target').value,
      defaultPrompt: $('prompt').value,
      autoSubmit: $('autoSubmit').checked,
    });
    await chrome.runtime.sendMessage({ type: 'AIS_REBUILD_MENUS' });
    showStatus('已保存 / Saved', true);
  } catch (e) {
    showStatus(String(e?.message || e), false);
  }
});

$('options').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

$('target').addEventListener('change', async () => {
  await saveSettings({ lastTargetId: $('target').value });
});

load().catch((e) => showStatus(String(e?.message || e), false));
