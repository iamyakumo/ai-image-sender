import {
  getSettings,
  saveSettings,
  exportSettings,
  importSettings,
} from '../lib/storage.js';

const $ = (id) => document.getElementById(id);

function uid() {
  return 'custom_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function showStatus(text, ok = true) {
  const el = $('status');
  el.hidden = false;
  el.textContent = text;
  el.className = 'status ' + (ok ? 'ok' : 'err');
}

function clearCustomForm() {
  $('cEditId').value = '';
  $('cName').value = '';
  $('cUrl').value = '';
  $('cFile').value = '';
  $('cDrop').value = '';
  $('cPrompt').value = '';
  $('cSubmit').value = '';
  $('cDefaultPrompt').value = '';
}

function fillCustomForm(t) {
  $('cEditId').value = t.id;
  $('cName').value = t.name || '';
  $('cUrl').value = t.chatUrl || '';
  $('cFile').value = t.fileInputSelector || '';
  $('cDrop').value = t.dropZoneSelector || '';
  $('cPrompt').value = t.promptSelector || '';
  $('cSubmit').value = t.submitSelector || '';
  $('cDefaultPrompt').value = t.defaultPrompt || '';
}

function readCustomForm() {
  const chatUrl = $('cUrl').value.trim();
  if (!chatUrl) throw new Error('Chat URL is required');
  try {
    // validate
    new URL(chatUrl);
  } catch {
    throw new Error('Invalid chat URL');
  }
  const name = $('cName').value.trim() || new URL(chatUrl).hostname;
  return {
    id: $('cEditId').value || uid(),
    name,
    chatUrl,
    fileInputSelector: $('cFile').value.trim(),
    dropZoneSelector: $('cDrop').value.trim(),
    promptSelector: $('cPrompt').value.trim(),
    submitSelector: $('cSubmit').value.trim(),
    defaultPrompt: $('cDefaultPrompt').value.trim(),
  };
}

async function render() {
  const settings = await getSettings();
  $('prompt').value = settings.defaultPrompt;
  $('autoSubmit').checked = Boolean(settings.autoSubmit);

  const tbody = $('customTable').querySelector('tbody');
  tbody.innerHTML = '';
  for (const t of settings.customTargets || []) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(t.name)}</td>
      <td><code>${escapeHtml(t.chatUrl)}</code></td>
      <td class="row"></td>
    `;
    const cell = tr.querySelector('td:last-child');
    const editBtn = document.createElement('button');
    editBtn.textContent = '编辑';
    editBtn.addEventListener('click', () => fillCustomForm(t));
    const delBtn = document.createElement('button');
    delBtn.textContent = '删除';
    delBtn.className = 'danger';
    delBtn.addEventListener('click', async () => {
      const s = await getSettings();
      await saveSettings({
        customTargets: s.customTargets.filter((x) => x.id !== t.id),
      });
      await chrome.runtime.sendMessage({ type: 'AIS_REBUILD_MENUS' });
      showStatus('已删除 ' + t.name, true);
      clearCustomForm();
      render();
    });
    cell.append(editBtn, delBtn);
    tbody.appendChild(tr);
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

$('saveGeneral').addEventListener('click', async () => {
  try {
    await saveSettings({
      defaultPrompt: $('prompt').value,
      autoSubmit: $('autoSubmit').checked,
    });
    showStatus('通用设置已保存', true);
  } catch (e) {
    showStatus(String(e?.message || e), false);
  }
});

$('requestPerm').addEventListener('click', async () => {
  try {
    const url = $('cUrl').value.trim();
    if (!url) throw new Error('先填写对话 URL');
    const resp = await chrome.runtime.sendMessage({
      type: 'AIS_REQUEST_ORIGIN',
      chatUrl: url,
    });
    if (resp?.ok) showStatus('已获得 host 权限（或本来就有）', true);
    else showStatus(resp?.error || '权限被拒绝', false);
  } catch (e) {
    showStatus(String(e?.message || e), false);
  }
});

$('addCustom').addEventListener('click', async () => {
  try {
    const item = readCustomForm();
    // Request permission in the same user gesture
    const perm = await chrome.runtime.sendMessage({
      type: 'AIS_REQUEST_ORIGIN',
      chatUrl: item.chatUrl,
    });
    if (!perm?.ok) {
      showStatus('已保存目标，但 host 权限未授予：' + (perm?.error || ''), false);
    }
    const s = await getSettings();
    const list = [...(s.customTargets || [])];
    const idx = list.findIndex((x) => x.id === item.id);
    if (idx >= 0) list[idx] = item;
    else list.push(item);
    await saveSettings({ customTargets: list });
    await chrome.runtime.sendMessage({ type: 'AIS_REBUILD_MENUS' });
    clearCustomForm();
    await render();
    showStatus(perm?.ok ? '自定义目标已保存' : '已保存（请再点「请求该 URL 权限」）', Boolean(perm?.ok));
  } catch (e) {
    showStatus(String(e?.message || e), false);
  }
});

$('exportBtn').addEventListener('click', async () => {
  const data = await exportSettings();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ai-image-sender-settings.json';
  a.click();
  URL.revokeObjectURL(url);
  showStatus('已导出', true);
});

$('importFile').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    await importSettings(JSON.parse(text), { replace: false });
    await chrome.runtime.sendMessage({ type: 'AIS_REBUILD_MENUS' });
    await render();
    showStatus('导入成功', true);
  } catch (err) {
    showStatus(String(err?.message || err), false);
  }
  e.target.value = '';
});

$('importPaste').addEventListener('click', async () => {
  try {
    const text = $('importArea').value.trim();
    if (!text) throw new Error('粘贴 JSON 后再导入');
    await importSettings(JSON.parse(text), { replace: false });
    await chrome.runtime.sendMessage({ type: 'AIS_REBUILD_MENUS' });
    await render();
    showStatus('导入成功', true);
  } catch (e) {
    showStatus(String(e?.message || e), false);
  }
});

render().catch((e) => showStatus(String(e?.message || e), false));
