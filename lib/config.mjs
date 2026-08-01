import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');
export const SKINS_DIR = path.join(ROOT, 'skins');
export const PUBLIC_DIR = path.join(ROOT, 'public');
export const CONFIG_PATH = path.join(ROOT, 'config.json');

// 工具自身监听端口（与 WorkBuddy 的调试端口 9223 分开）
export const TOOL_PORT = 18759;
export const DEBUG_PORT = 9223;

export const DEFAULT_CONFIG = {
  workbuddyPath: '/Applications/WorkBuddy.app',
  workbuddyDebugPort: DEBUG_PORT,
  toolPort: TOOL_PORT,
  lastTheme: null,
};

export function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) };
    }
  } catch {}
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}
