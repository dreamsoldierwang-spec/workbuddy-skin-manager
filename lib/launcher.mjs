// macOS 启动器：确保 WorkBuddy 以 --remote-debugging-port 运行（三态逻辑）
import { exec } from 'node:child_process';
import { isPortOpen } from './cdp.mjs';

const run = (cmd) =>
  new Promise((resolve) => {
    exec(cmd, () => resolve());
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// WorkBuddy 进程是否在运行（不管端口开没开）
export async function workbuddyRunning() {
  return new Promise((resolve) => {
    exec("pgrep -f 'WorkBuddy.app' >/dev/null 2>&1 && echo yes || echo no", (e, out) => {
      resolve((out || '').includes('yes'));
    });
  });
}

async function quitWorkBuddy() {
  await run(`osascript -e 'tell application "WorkBuddy" to quit' 2>/dev/null`);
  await sleep(1500);
  await run(`pkill -f 'WorkBuddy.app' 2>/dev/null`);
  await sleep(1000);
}

async function launchWithPort(appPath, port) {
  await run(`open -a "${appPath}" --args --remote-debugging-port=${port}`);
}

async function waitPort(port, timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await isPortOpen(port)) return true;
    await sleep(500);
  }
  return false;
}

// 确保 WorkBuddy 带调试端口运行。返回 { relaunched, ok }
export async function ensureWorkBuddy(config) {
  if (await isPortOpen(config.workbuddyDebugPort)) {
    return { relaunched: false, ok: true, alreadyOpen: true };
  }
  const running = await workbuddyRunning();
  if (running) {
    await quitWorkBuddy();
  }
  await launchWithPort(config.workbuddyPath, config.workbuddyDebugPort);
  const ok = await waitPort(config.workbuddyDebugPort);
  return { relaunched: true, ok };
}

// 仅返回状态，不改动 WorkBuddy
export async function status(config) {
  const running = await workbuddyRunning();
  const portOpen = await isPortOpen(config.workbuddyDebugPort);
  return { running, portOpen };
}
