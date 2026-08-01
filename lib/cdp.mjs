// CDP（Chrome DevTools Protocol）注入模块
// 使用 ws 包（而非全局 WebSocket）：Electron 主进程是 Node 20，无全局 WebSocket；
// 且 ws 的 EventEmitter 风格（.on('message')/.on('open')）与本模块代码匹配。
import WebSocket from 'ws';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 端口是否已开放（即 WorkBuddy 是否以调试模式运行）
export async function isPortOpen(port, timeoutMs = 800) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

// 等待渲染层 page target 出现，返回其 webSocketDebuggerUrl
async function findWsUrl(port, timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json`);
      if (res.ok) {
        const targets = await res.json();
        const page =
          targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl) ||
          targets.find((t) => t.webSocketDebuggerUrl);
        if (page) return page.webSocketDebuggerUrl;
      }
    } catch {}
    await sleep(400);
  }
  return null;
}

class CDP {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 0;
    this.pending = new Map();
  }
  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.on('message', (data) => {
        let msg;
        try {
          msg = JSON.parse(data.toString());
        } catch {
          return;
        }
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        }
      });
      this.ws.on('open', resolve);
      this.ws.on('error', reject);
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() {
    try {
      this.ws.close();
    } catch {}
  }
}

// 注入皮肤 CSS（带固定 id，便于后续移除/替换）
export async function injectCss(port, css) {
  const wsUrl = await findWsUrl(port);
  if (!wsUrl) throw new Error('找不到 WorkBuddy 的渲染页面（CDP target 未就绪）');
  const cdp = new CDP(wsUrl);
  await cdp.connect();
  try {
    const script = `(()=>{let s=document.getElementById('wb-skin');if(!s){s=document.createElement('style');s.id='wb-skin';document.documentElement.appendChild(s);}s.textContent=${JSON.stringify(css)};return true;})()`;
    await cdp.send('Runtime.evaluate', { expression: script, returnByValue: true });
  } finally {
    cdp.close();
  }
}

// 移除皮肤（恢复默认）
export async function removeCss(port) {
  const wsUrl = await findWsUrl(port);
  if (!wsUrl) throw new Error('找不到 WorkBuddy 的渲染页面（CDP target 未就绪）');
  const cdp = new CDP(wsUrl);
  await cdp.connect();
  try {
    const script = `(()=>{const s=document.getElementById('wb-skin');if(s)s.remove();return true;})()`;
    await cdp.send('Runtime.evaluate', { expression: script, returnByValue: true });
  } finally {
    cdp.close();
  }
}
