const skinGrid = document.getElementById('skinGrid');
const statusPill = document.getElementById('statusPill');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const currentSkinName = document.getElementById('currentSkinName');
const dropZone = document.getElementById('dropZone');
const toast = document.getElementById('toast');
const toastMsg = document.getElementById('toastMsg');

let currentThemeId = null;

// ===== 工具函数 =====
function showToast(message, type = 'success') {
  toastMsg.textContent = message;
  toast.className = 'toast show' + (type === 'error' ? ' toast-err' : '');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function themeLabel(theme) {
  if (theme === 'dark') return '深色';
  if (theme === 'light') return '浅色';
  return '';
}

// ===== 状态刷新 =====
async function refreshStatus() {
  try {
    const cfg = await window.electronAPI.getConfig();
    const st = cfg.status || {};
    const running = st.running && st.portOpen;
    statusDot.className = 'status-dot ' + (running ? 'on' : 'off');
    const port = cfg.workbuddyDebugPort || 9223;
    statusText.textContent = running
      ? `WorkBuddy 已运行 · 端口 ${port}`
      : `WorkBuddy 未运行 · 端口 ${port}`;
    currentThemeId = cfg.lastTheme || null;
  } catch (e) {
    statusDot.className = 'status-dot off';
    statusText.textContent = 'WorkBuddy 状态获取失败';
  }
}

function updateCurrentSkinName(skins) {
  if (!currentThemeId) {
    currentSkinName.textContent = '默认';
    return;
  }
  const skin = skins.find((s) => s.id === currentThemeId);
  currentSkinName.textContent = skin ? skin.name : currentThemeId;
}

// ===== 加载皮肤列表 =====
async function loadSkins() {
  await refreshStatus();
  try {
    const skins = await window.electronAPI.listSkins();
    updateCurrentSkinName(skins);
    skinGrid.innerHTML = '';

    if (!skins.length) {
      skinGrid.innerHTML = `
        <div class="empty">
          <p>还没有已安装的皮肤。</p>
          <p class="hint">使用「WorkBuddy 皮肤生成 Skill」制作 .wbskin 皮肤包，然后拖拽或点击导入。</p>
        </div>`;
      return;
    }

    skins.forEach((sk) => {
      const card = document.createElement('div');
      card.className = 'skincard';

      const thumb = sk.heroDataUrl
        ? `style="background-image:url(${sk.heroDataUrl})"`
        : `style="background:linear-gradient(135deg,${sk.colors?.accent || '#ccc'},${sk.colors?.secondary || '#999'})"`;

      const sw = ['accent', 'secondary', 'surface', 'text']
        .map((k) => `<span class="swatch" style="background:${sk.colors?.[k] || sk.layers?.tokens?.[k] || '#ccc'}"></span>`)
        .join('');

      const label = [sk.name, themeLabel(sk.theme)].filter(Boolean).join(' · ');

      card.innerHTML = `
        <div class="thumb" ${thumb}>
          <div class="tag">${label}</div>
        </div>
        <div class="meta">
          <div class="id">${sk.id}</div>
          <div class="swatches">${sw}</div>
          <div class="actions">
            <button class="btn-apply" data-id="${sk.id}">应用</button>
            <button class="btn-export" data-id="${sk.id}">导出</button>
            <button class="btn-delete" data-id="${sk.id}">删除</button>
          </div>
        </div>`;

      card.querySelector('.btn-apply').addEventListener('click', () => applySkin(sk));
      card.querySelector('.btn-export').addEventListener('click', () => exportSkin(sk));
      card.querySelector('.btn-delete').addEventListener('click', () => deleteSkin(sk));
      skinGrid.appendChild(card);
    });
  } catch (e) {
    skinGrid.innerHTML = `<div class="empty"><p>加载失败：${e.message || e}</p></div>`;
  }
}

// ===== 操作 =====
async function applySkin(sk) {
  showToast('正在应用皮肤…', 'success');
  try {
    const data = await window.electronAPI.applySkin(sk.id);
    currentThemeId = sk.id;
    currentSkinName.textContent = sk.name;
    showToast(`已应用「${sk.name}」✓`);
    refreshStatus();
  } catch (e) {
    showToast('应用失败：' + (e.message || e), 'error');
  }
}

async function exportSkin(sk) {
  try {
    const data = await window.electronAPI.exportSkin(sk.id);
    if (data.canceled) return;
    showToast(`已导出「${sk.name}」到 ${data.filePath}`);
  } catch (e) {
    showToast('导出失败：' + (e.message || e), 'error');
  }
}

async function deleteSkin(sk) {
  if (!confirm(`确定删除皮肤「${sk.name}」？`)) return;
  try {
    await window.electronAPI.deleteSkin(sk.id);
    if (currentThemeId === sk.id) {
      currentThemeId = null;
      currentSkinName.textContent = '默认';
    }
    showToast(`已删除「${sk.name}」`);
    loadSkins();
  } catch (e) {
    showToast('删除失败：' + (e.message || e), 'error');
  }
}

async function importSkin() {
  try {
    const data = await window.electronAPI.importSkin();
    if (data.canceled) return;
    showToast(`已导入「${data.name}」✓`);
    loadSkins();
  } catch (e) {
    showToast('导入失败：' + (e.message || e), 'error');
  }
}

async function restoreDefault() {
  showToast('正在恢复默认皮肤…', 'success');
  try {
    await window.electronAPI.restoreDefault();
    currentThemeId = null;
    currentSkinName.textContent = '默认';
    showToast('已恢复 WorkBuddy 默认皮肤 ✓');
    refreshStatus();
  } catch (e) {
    showToast('恢复失败：' + (e.message || e), 'error');
  }
}

// ===== 拖拽导入 =====
['dragenter', 'dragover', 'dragleave', 'drop'].forEach((name) => {
  document.body.addEventListener(name, (e) => { e.preventDefault(); e.stopPropagation(); }, false);
});

['dragenter', 'dragover'].forEach((name) => {
  dropZone.addEventListener(name, () => dropZone.classList.add('hover'), false);
});

['dragleave', 'drop'].forEach((name) => {
  dropZone.addEventListener(name, () => dropZone.classList.remove('hover'), false);
});

dropZone.addEventListener('drop', async (e) => {
  const files = Array.from(e.dataTransfer.files || []);
  const wbskin = files.find((f) => f.name.toLowerCase().endsWith('.wbskin'));
  if (!wbskin) {
    showToast('请拖拽 .wbskin 文件', 'error');
    return;
  }
  const filePath = window.electronAPI.getPathForFile(wbskin);
  try {
    const data = await window.electronAPI.importSkinPath(filePath);
    showToast(`已导入「${data.name}」✓`);
    loadSkins();
  } catch (err) {
    showToast('导入失败：' + (err.message || err), 'error');
  }
});

// ===== 事件绑定 =====
document.getElementById('importBtn').addEventListener('click', importSkin);
document.getElementById('restoreBtn').addEventListener('click', restoreDefault);

// 初始加载
loadSkins();
