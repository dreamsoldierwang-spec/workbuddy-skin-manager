// 皮肤库管理：列出 / 保存 / 删除 / 导入 .wbskin / 读取 CSS
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { SKINS_DIR } from './config.mjs';

export function ensureDirs() {
  fs.mkdirSync(SKINS_DIR, { recursive: true });
}

// ===== 颜色工具 =====
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return [128, 128, 128];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
}

function luminance(rgb) {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function chooseTextFor(bgHex) {
  return luminance(hexToRgb(bgHex)) > 160 ? '#111111' : '#ffffff';
}

// ===== CSS 生成（旧版皮肤兼容 / 无 .wbskin 时使用）=====
// v2.0：基于五层架构（background/container/component/token/assets）生成毛玻璃风格 CSS
export function buildThemeCss(colors, dark, heroDataUrl) {
  const skin = {
    theme: dark ? 'dark' : 'light',
    colors,
    files: heroDataUrl ? { images: { hero: '__hero__' } } : { images: {} }
  };

  const layers = deriveLayers(skin);
  if (heroDataUrl) {
    layers.background.type = 'image';
    layers.background.image = heroDataUrl;
  }

  return generateCssFromLayers(layers, skin);
}

// 以下工具函数与 Skill 的 build-theme-css.js 保持一致，确保 fallback 行为相同
function ensureHex(c) {
  if (typeof c !== 'string') return '#888888';
  if (c.startsWith('#')) return c;
  return '#888888';
}

function withAlpha(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function deriveLayers(skin) {
  const { theme = 'dark', colors = {}, layers = {}, files = {} } = skin;
  const dark = theme === 'dark';

  const accent = ensureHex(colors.accent || (dark ? '#24C9D7' : '#00c2cb'));
  const secondary = ensureHex(colors.secondary || (dark ? '#EF8FD3' : '#ff6b9d'));
  const surface = ensureHex(colors.surface || (dark ? '#111827' : '#ffffff'));
  const text = ensureHex(colors.text || (dark ? '#F9FAFB' : '#1a1a2e'));
  const textMuted = ensureHex(colors.textMuted || (dark ? '#9CA3AF' : '#4a4a6a'));

  const hasHero = files.images && files.images.hero;

  const defaultBackground = {
    type: hasHero ? 'image' : 'gradient',
    image: hasHero ? files.images.hero : undefined,
    gradient: dark
      ? 'radial-gradient(ellipse at 50% 0%, #1a2634 0%, #0d1117 60%)'
      : 'radial-gradient(ellipse at 50% 0%, #ffffff 0%, #f0f4f8 60%)',
    opacity: 1.0,
    blur: 0,
    scale: 1.0,
    repeat: 'no-repeat',
    position: 'center',
    size: 'cover',
    overlay: dark ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.10)',
    dimOverlay: {
      enabled: true,
      start: dark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.25)',
      end: dark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.05)',
      radial: dark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.20)'
    }
  };

  const glassBase = {
    solid: dark ? surface : '#ffffff',
    opacity: dark ? 0.46 : 0.72,
    blur: 28,
    saturation: 1.25,
    radius: 16,
    border: dark ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(255,255,255,0.45)',
    shadow: dark ? '0 8px 32px rgba(0,0,0,0.25)' : '0 8px 32px rgba(0,0,0,0.08)'
  };

  const defaultContainer = {
    ...glassBase,
    sidebar: { ...glassBase, opacity: dark ? 0.40 : 0.68, radius: 0 },
    panel: { ...glassBase, opacity: dark ? 0.24 : 0.54, radius: 20 },
    input: { ...glassBase, opacity: dark ? 0.30 : 0.62, radius: 24 },
    header: { ...glassBase, opacity: dark ? 0.72 : 0.78, radius: 0 },
    popup: { ...glassBase, opacity: dark ? 0.96 : 0.97, radius: 16 }
  };

  const defaultComponent = {
    text,
    textMuted,
    textPlaceholder: textMuted,
    link: accent,
    border: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
    divider: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    shadow: dark ? '0 2px 8px rgba(0,0,0,0.20)' : '0 2px 8px rgba(0,0,0,0.06)',
    buttonPrimary: {
      bg: withAlpha(accent, dark ? 0.16 : 0.12),
      text: accent,
      hoverBg: accent,
      hoverText: chooseTextFor(accent),
      border: withAlpha(accent, dark ? 0.55 : 0.45)
    },
    buttonSecondary: {
      bg: withAlpha(surface, dark ? 0.10 : 0.28),
      text,
      hoverBg: withAlpha(surface, dark ? 0.24 : 0.52),
      hoverText: text,
      border: dark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)'
    },
    input: {
      bg: colors.inputBg || (dark ? withAlpha(surface, 0.22) : withAlpha(surface, 0.55)),
      text,
      border: dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
      focusBorder: accent,
      placeholder: textMuted
    },
    scrollbar: {
      thumb: secondary,
      track: 'transparent',
      hover: accent
    }
  };

  const defaultTokens = {
    primary: accent,
    secondary,
    success: '#52c41a',
    warning: '#faad14',
    error: '#f5222d',
    surface,
    surfaceSolid: surface,
    background: surface,
    foreground: text
  };

  const merged = {
    background: { ...defaultBackground, ...(layers.background || {}) },
    container: { ...defaultContainer, ...(layers.container || {}) },
    component: { ...defaultComponent, ...(layers.component || {}) },
    tokens: { ...defaultTokens, ...(layers.tokens || {}) },
    assets: layers.assets || {}
  };

  for (const key of ['sidebar', 'panel', 'input', 'header', 'popup']) {
    if (layers.container && layers.container[key]) {
      merged.container[key] = { ...defaultContainer[key], ...layers.container[key] };
    }
  }
  for (const key of ['buttonPrimary', 'buttonSecondary', 'input', 'scrollbar']) {
    if (layers.component && layers.component[key]) {
      merged.component[key] = { ...defaultComponent[key], ...(layers.component[key] || {}) };
    }
  }

  return merged;
}

function generateCssFromLayers(layers, skin) {
  const dark = skin.theme === 'dark';
  const { tokens, component, container } = layers;

  const bg = layers.background;
  const bgImage = bg.type === 'image' && bg.image
    ? `url("${bg.image}")`
    : (bg.gradient || 'none');
  const dim = bg.dimOverlay || {};
  const dimEnabled = dim.enabled !== false;

  const vars = `:root,
html, html.light, html.dark,
body, body.light, body.dark,
body.cb-light, body.cb-dark,
body.vscode-light, body.vscode-dark,
body.agent-ui-theme {
  /* ===== WorkBuddy native tokens ===== */
  --wb-color-text-primary: ${component.text};
  --wb-color-text-secondary: ${component.textMuted};
  --wb-color-text-tertiary: ${component.textMuted};
  --wb-sidebar-bg: ${withAlpha(tokens.surface, container.sidebar.opacity)};
  --wb-panel-bg: ${withAlpha(tokens.surface, container.panel.opacity)};
  --wb-chat-bg: ${withAlpha(tokens.surface, container.panel.opacity)};
  --wb-input-bg: ${component.input.bg};
  --wb-accent: ${tokens.primary};

  --wb-background: ${tokens.background};
  --wb-surface: ${tokens.surface};
  --wb-surface-primary: ${tokens.surface};
  --wb-surface-secondary: ${withAlpha(tokens.surface, container.sidebar.opacity)};
  --wb-surface-tertiary: ${withAlpha(tokens.surface, container.panel.opacity)};
  --wb-main-bg: ${tokens.background};
  --wb-content-bg: ${withAlpha(tokens.surface, container.panel.opacity)};
  --wb-card-bg: ${withAlpha(tokens.surface, container.panel.opacity)};
  --wb-text-primary: ${component.text};
  --wb-text-secondary: ${component.textMuted};
  --wb-text-tertiary: ${component.textMuted};
  --wb-text-link: ${component.link};
  --wb-border: ${component.border};

  /* ===== VS Code / Monaco tokens ===== */
  --vscode-focusBorder: ${tokens.primary};
  --vscode-button-background: ${component.buttonPrimary.bg};
  --vscode-button-hoverBackground: ${component.buttonPrimary.hoverBg};
  --vscode-button-foreground: ${component.buttonPrimary.text};
  --vscode-editor-background: ${tokens.background};
  --vscode-editor-foreground: ${component.text};
  --vscode-sideBar-background: ${withAlpha(tokens.surface, container.sidebar.opacity)};
  --vscode-sideBar-foreground: ${component.text};
  --vscode-activityBar-background: ${withAlpha(tokens.surface, container.sidebar.opacity)};
  --vscode-activityBar-foreground: ${component.text};
  --vscode-foreground: ${component.text};
  --vscode-titleBar-activeBackground: ${withAlpha(tokens.surface, container.header.opacity)};
  --vscode-titleBar-inactiveBackground: ${withAlpha(tokens.surface, container.header.opacity)};
  --vscode-titleBar-activeForeground: ${component.text};
  --vscode-tab-activeBackground: ${withAlpha(tokens.surface, container.panel.opacity)};
  --vscode-tab-inactiveBackground: ${withAlpha(tokens.surface, container.sidebar.opacity)};
  --vscode-tab-activeForeground: ${component.text};
  --vscode-tab-inactiveForeground: ${component.textMuted};
  --vscode-panel-background: ${withAlpha(tokens.surface, container.panel.opacity)};
  --vscode-panel-border: ${component.border};
  --vscode-input-background: ${component.input.bg};
  --vscode-input-foreground: ${component.input.text};
  --vscode-input-border: ${component.input.border};
  --vscode-list-activeSelectionBackground: ${tokens.primary};
  --vscode-list-activeSelectionForeground: ${component.buttonPrimary.text};
  --vscode-list-hoverBackground: ${withAlpha(tokens.secondary, 0.22)};
  --vscode-list-hoverForeground: ${component.text};
  --vscode-list-inactiveSelectionBackground: ${withAlpha(tokens.surface, container.sidebar.opacity)};
  --vscode-list-inactiveSelectionForeground: ${component.text};
  --vscode-scrollbarSlider-background: ${component.scrollbar.thumb};
  --vscode-scrollbarSlider-hoverBackground: ${component.scrollbar.hover};
  --vscode-badge-background: ${tokens.primary};
  --vscode-badge-foreground: ${component.buttonPrimary.text};
  --vscode-progressBar-background: ${tokens.primary};
  --vscode-widget-shadow: ${component.shadow};

  /* ===== Color Token Layer ===== */
  --wb-primary: ${tokens.primary};
  --wb-secondary: ${tokens.secondary};
  --wb-success: ${tokens.success};
  --wb-warning: ${tokens.warning};
  --wb-error: ${tokens.error};
  --wb-surface-solid: ${tokens.surfaceSolid};
  --wb-foreground: ${tokens.foreground};
}`;

  const dimBlock = dimEnabled
    ? `body::after {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -9998;
  pointer-events: none;
  background:
    radial-gradient(ellipse at 70% 30%, transparent 0%, transparent 35%, ${dim.radial || bg.overlay || 'transparent'} 100%),
    linear-gradient(180deg, ${dim.start || bg.overlay || 'transparent'} 0%, transparent 35%, transparent 70%, ${dim.end || bg.overlay || 'transparent'} 100%),
    ${bg.overlay || 'transparent'};
}`
    : '/* no dim overlay */';

  // ===== 1. Background Layer =====
  // Lesson (workbuddy-dream-skin field-lessons): artwork on a negative-z pseudo-element
  // behind `body` is always hidden by opaque page roots. Put the artwork on ONE verified
  // visible shell (`.teams-container`) and make every descendant shell transparent.
  const dimGradients = dimEnabled
    ? `radial-gradient(ellipse at 68% 28%, transparent 0%, transparent 34%, ${dim.radial || bg.overlay || 'transparent'} 100%),
    linear-gradient(180deg, ${dim.start || bg.overlay || 'transparent'} 0%, transparent 34%, transparent 68%, ${dim.end || bg.overlay || 'transparent'} 100%)`
    : `linear-gradient(180deg, ${bg.overlay || 'transparent'} 0%, ${bg.overlay || 'transparent'} 100%)`;

  const backgroundLayer = `/* ===== 1. Background Layer 全局背景层（最后生效，覆盖一切外壳底色） ===== */
/* 1a. 清空所有不透明外壳，让唯一的壁纸持有者透出来 */
html, body, #root, #app, .app, .root, main, .main,
[class*="_grid_"], [class*="gridView"], [class*="gridViewItem"],
.teams-content-wrapper, .teams-main-content,
.main-content, [class*="main-content"],
.conversation-sidebar, .sidebar-next, .sidebar-next-body,
[class*="chatMessage"], [class*="chat-message"], [class*="messageList"],
.group-messages, [class*="assistantMessage"], [class*="assistantTextContent"],
.wb-home-page, .wb-home-page__main-content, [class*="emptyState"], [class*="_emptyState"],
.cb-markdown, [class*="workbench"], [class*="app-root"], [class*="page-root"],
/* 胶囊/分类标签的父级容器不要填充 */
[class*="category"], [class*="categories"], [class*="tag-list"], [class*="tags"],
[class*="chip-group"], [class*="chips"], [class*="pill-group"], [class*="pills"],
[class*="capsule"], [class*="home-row"], [class*="hero-row"], [class*="quick-actions"],
/* 兜底：首页内部所有后代元素一律透明（含背景/边框/阴影），杜绝任何父级背景条。
   胶囊 hover 背景由组件层 [class*="tag"]:hover 等更高特异性规则恢复。 */
.wb-home-page *, [class*="home-page"] *, [class*="homePage"] * {
  background-color: transparent !important;
  background-image: none !important;
  border-color: transparent !important;
  box-shadow: none !important;
}
.wb-home-page, [class*="home-page"], [class*="homePage"],
.monaco-workbench .part, .monaco-editor, .monaco-editor-background {
  background-color: transparent !important;
  background-image: none !important;
  border: none !important;
}

/* 1b. 兜底底色，避免任何缝隙露出宿主白底 */
html, body {
  background-color: ${tokens.surfaceSolid || '#101014'} !important;
}

/* 1c. 唯一壁纸持有者：真实可见外壳 */
.teams-container,
#root:not(:has(.teams-container)),
body:not(:has(#root)) {
  position: relative !important;
  background-color: ${tokens.surfaceSolid || '#101014'} !important;
  background-image: none !important;
}
.teams-container::before,
#root:not(:has(.teams-container))::before,
body:not(:has(#root))::before {
  content: "";
  position: absolute;
  inset: -10px;
  z-index: 0;
  pointer-events: none;
  background: ${bgImage} ${bg.position}/${bg.size} ${bg.repeat};
  opacity: ${bg.opacity};
  filter: brightness(${bg.brightness ?? 0.92}) saturate(${bg.saturation ?? 1.12}) blur(${Math.max(0, bg.blur - 1)}px);
}
.teams-container::after,
#root:not(:has(.teams-container))::after,
body:not(:has(#root))::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: ${dimGradients};
}
/* 1d. 真实内容抬到壁纸之上 */
.teams-container > *,
#root:not(:has(.teams-container)) > *,
body:not(:has(#root)) > * {
  position: relative;
  z-index: 2;
}`;

  const glassBase = cfg => {
    const backdrop = `blur(${cfg.blur}px) saturate(${cfg.saturation || 1.15})`;
    return `background: ${withAlpha(cfg.solid || '#ffffff', cfg.opacity)} !important;
  backdrop-filter: ${backdrop} !important;
  -webkit-backdrop-filter: ${backdrop} !important;
  border-radius: ${cfg.radius}px !important;
  ${cfg.border ? `border: ${cfg.border} !important;` : 'border: none !important;'}
  ${cfg.shadow ? `box-shadow: ${cfg.shadow} !important;` : ''}`;
  };

  // Real WorkBuddy 5.x selectors captured from a live DOM audit (tools/cdp-selector-map.mjs).
  const sidebarSel = `.conversation-list, .sidebar-next-main-header, [class*="sider"], [class*="nav-bar"], nav`;
  const panelSel = `[class*="panel"]:not([class*="main"]):not([class*="content"]):not([class*="category"]):not([class*="categories"]):not([class*="tag"]):not([class*="tags"]):not([class*="chip"]):not([class*="chips"]):not([class*="pill"]):not([class*="pills"]):not([class*="capsule"]):not([class*="home"]):not([class*="hero"]):not([class*="user"]):not([class*="profile"]):not([class*="account"]):not([class*="member"]):not([class*="avatar"]):not([class*="status"]):not([class*="notification"]):not([class*="settings"]), [class*="message-list"], [class*="detail"], [class*="overview"], [class*="preview"]`;
  const inputSel = `[class*="input-area-container"], [class*="_mainArea_"], [class*="composer"], .input-area, .chat-input`;
  const headerSel = `.workbuddy-topbar, .conversation-list-topbar, [class*="titlebar"], [class*="title-bar"]`;
  const popupSel = `[class*="popup"]:not([class*="user-menu"]), [class*="modal"]:not([class*="user-menu"]), [class*="dropdown"]:not([class*="dropdown__"]):not([class*="dropdown--"]):not([class*="user-menu"]), [class*="tooltip"]:not([class*="user-menu"]), [class*="menu"]:not([class*="user-menu"]):not([class*="user-"]):not([class*="menu-item"]):not([class*="menuitem"]), [role="menu"]:not([class*="user-menu"]), [role="listbox"]:not([class*="user-menu"]), [role="dialog"]:not([class*="user-menu"])`;

  const containerLayer = `/* ===== 2. Container Glass Layer 布局容器面板层 ===== */
${sidebarSel} {
  ${glassBase(container.sidebar).replace(/\n  /g, '\n  ')}
  color: ${component.text} !important;
}
${panelSel} {
  ${glassBase(container.panel).replace(/\n  /g, '\n  ')}
  color: ${component.text} !important;
}
${inputSel} {
  ${glassBase(container.input).replace(/\n  /g, '\n  ')}
  color: ${component.text} !important;
}
${headerSel} {
  ${glassBase(container.header).replace(/\n  /g, '\n  ')}
  color: ${component.text} !important;
}
${popupSel} {
  ${glassBase(container.popup).replace(/\n  /g, '\n  ')}
  color: ${component.text} !important;
}

/* 用户区避免多层玻璃嵌套：内部容器全部清理，只留最外层。
   注意：[class*="menu"] 会匹配 .user-menu，所以这里用高特异性覆盖 popup 菜单项规则 */
.user-menu, [class*="user-menu"],
.user-menu *, [class*="user-menu"] *,
[class*="user"], [class*="profile"], [class*="account"], [class*="member"],
[class*="avatar"], [class*="status"], [class*="notification"], [class*="settings"] {
  background-color: transparent !important;
  background-image: none !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

/* 弹出菜单容器加明显边框，强化轮廓 */
${popupSel} {
  border: 1px solid ${dark ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.78)'} !important;
}

/* 语义化菜单项：默认透明，hover 加实底。
   不要写 ${popupSel} > div/li/button/a/span 这类通用子选择器，
   会命中 DUI/组件库菜单的嵌套容器造成套娃。 */
${popupSel} [role="menuitem"],
${popupSel} [class*="menuitem"],
${popupSel} [class*="menu-item"],
${popupSel} [class*="dropdown-item"],
${popupSel} [class*="select-item"] {
  background-color: transparent !important;
  color: ${component.text} !important;
  border-radius: 6px !important;
}
${popupSel} [role="menuitem"]:hover,
${popupSel} [role="menuitem"]:focus,
${popupSel} [class*="menuitem"]:hover,
${popupSel} [class*="menuitem"]:focus,
${popupSel} [class*="menu-item"]:hover,
${popupSel} [class*="menu-item"]:focus,
${popupSel} [class*="dropdown-item"]:hover,
${popupSel} [class*="dropdown-item"]:focus,
${popupSel} [class*="select-item"]:hover,
${popupSel} [class*="select-item"]:focus {
  background-color: ${dark ? 'rgba(40,44,58,0.85)' : 'rgba(255,255,255,0.92)'} !important;
  border-radius: 6px !important;
}

/* WorkBuddy wb-dropdown 菜单项修复：
   .wb-dropdown__item / .wb-dropdown__label 类名包含 "dropdown"，会被上方容器选择器误当成容器，
   导致每个菜单项都被套上实底边框。这里单独清理并统一文字色。 */
.wb-dropdown__list,
.wb-dropdown__item,
.wb-dropdown__label,
[class*="dropdown__list"],
[class*="dropdown__item"],
[class*="dropdown__label"] {
  background-color: transparent !important;
  background-image: none !important;
  border: none !important;
  box-shadow: none !important;
  color: ${component.text} !important;
  text-shadow: none !important;
}
.wb-dropdown__item:hover,
.wb-dropdown__label:hover,
[class*="dropdown__item"]:hover,
[class*="dropdown__label"]:hover {
  background-color: ${dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'} !important;
  border-radius: 6px !important;
}

/* DUI/duim 组件库菜单专门处理：
   - 外层容器保留不透明毛玻璃，提供清晰轮廓；
   - 中间 li/div/menu-item 等嵌套容器强制透明，防止父级背景条；
   - 菜单项默认完全透明无边框，避免每个项都像独立卡片；
   - hover 才加轻微实底背景；
   - 文字/图标统一用皮肤主文字色，去 text-shadow，确保清晰。 */
[class*="dui-menu"], [class*="duim-menu"],
[class*="dui-dropdown"], [class*="duim-dropdown"] {
  background-color: ${dark ? 'rgba(18,20,28,0.96)' : 'rgba(255,255,255,0.97)'} !important;
  backdrop-filter: blur(20px) saturate(1.25) !important;
  -webkit-backdrop-filter: blur(20px) saturate(1.25) !important;
  border: 1px solid ${dark ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.78)'} !important;
  border-radius: 12px !important;
  box-shadow: ${dark ? '0 12px 40px rgba(0,0,0,0.35)' : '0 12px 40px rgba(0,0,0,0.10)'} !important;
}
[class*="dui-menu"] > li, [class*="duim-menu"] > li,
[class*="dui-menu"] > div, [class*="duim-menu"] > div,
[class*="dui-menu"] [class*="menu-item"], [class*="duim-menu"] [class*="menu-item"],
[class*="dui-menu"] [class*="option"], [class*="duim-menu"] [class*="option"],
[class*="dui-dropdown"] > li, [class*="duim-dropdown"] > li,
[class*="dui-dropdown"] > div, [class*="duim-dropdown"] > div,
[class*="dui-dropdown"] [class*="menu-item"], [class*="duim-dropdown"] [class*="menu-item"],
[class*="dui-menu"] [class*="item"], [class*="duim-menu"] [class*="item"],
[class*="dui-dropdown"] [class*="item"], [class*="duim-dropdown"] [class*="item"] {
  background-color: transparent !important;
  background-image: none !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
[class*="dui-menu"] button, [class*="duim-menu"] button,
[class*="dui-menu"] a, [class*="duim-menu"] a,
[class*="dui-dropdown"] button, [class*="duim-dropdown"] button,
[class*="dui-dropdown"] a, [class*="duim-dropdown"] a,
[class*="dui-menu"] [class*="item-content"], [class*="duim-menu"] [class*="item-content"],
[class*="dui-dropdown"] [class*="item-content"], [class*="duim-dropdown"] [class*="item-content"] {
  background-color: transparent !important;
  background-image: none !important;
  color: ${component.text} !important;
  border-radius: 8px !important;
  border: none !important;
  box-shadow: none !important;
  font-weight: 500 !important;
  text-shadow: none !important;
}
[class*="dui-menu"] button:hover, [class*="duim-menu"] button:hover,
[class*="dui-menu"] a:hover, [class*="duim-menu"] a:hover,
[class*="dui-dropdown"] button:hover, [class*="duim-dropdown"] button:hover,
[class*="dui-dropdown"] a:hover, [class*="duim-dropdown"] a:hover,
[class*="dui-menu"] [class*="item-content"]:hover, [class*="duim-menu"] [class*="item-content"]:hover,
[class*="dui-dropdown"] [class*="item-content"]:hover, [class*="duim-dropdown"] [class*="item-content"]:hover {
  background-color: ${dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'} !important;
}
/* DUI 菜单中的图标跟随文字颜色 */
[class*="dui-menu"] button svg, [class*="duim-menu"] button svg,
[class*="dui-menu"] a svg, [class*="duim-menu"] a svg,
[class*="dui-menu"] button [class*="icon"], [class*="duim-menu"] button [class*="icon"],
[class*="dui-menu"] a [class*="icon"], [class*="duim-menu"] a [class*="icon"],
[class*="dui-menu"] [class*="icon"] svg, [class*="duim-menu"] [class*="icon"] svg,
[class*="dui-dropdown"] [class*="icon"] svg, [class*="duim-dropdown"] [class*="icon"] svg {
  color: inherit !important;
  fill: currentColor !important;
  stroke: currentColor !important;
}
/* DUI 菜单中可能存在的 muted/secondary 文字强制主文字色，避免发灰 */
[class*="dui-menu"] [class*="muted"], [class*="duim-menu"] [class*="muted"],
[class*="dui-menu"] [class*="secondary"], [class*="duim-menu"] [class*="secondary"],
[class*="dui-dropdown"] [class*="muted"], [class*="duim-dropdown"] [class*="muted"],
[class*="dui-dropdown"] [class*="secondary"], [class*="duim-dropdown"] [class*="secondary"] {
  color: ${component.text} !important;
}

/* 普通弹出菜单内文字加粗，仅在透明菜单项上保留轻微阴影 */
${popupSel} [role="menuitem"],
${popupSel} [class*="menuitem"],
${popupSel} [class*="menu-item"],
${popupSel} [class*="dropdown-item"],
${popupSel} [class*="select-item"] {
  font-weight: 600 !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35) !important;
}

/* 消息流保持完全透明，让壁纸透出来 */
.group-messages, [class*="chatMessageContainer"], [class*="chatMessageBox"],
[class*="assistantRow"], [class*="assistantMessage"], [class*="userRow"],
.cb-markdown, .teams-content-wrapper, .teams-main-content {
  background: transparent !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  border: none !important;
}`;

  const bp = component.buttonPrimary;
  const bs = component.buttonSecondary;
  const input = component.input;
  const sb = component.scrollbar;

  const chipBorder = dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
  const chipHoverBg = withAlpha(tokens.surface, dark ? 0.18 : 0.34);

  const componentLayer = `/* ===== 3. UI Component Layer 控件组件层 ===== */
body, #app, .app, #root, .root, main, .main,
[class*="chat"], [class*="message"], [class*="panel"], [class*="overview"],
[class*="detail"], [class*="content"],
[class*="task"], [class*="project"], [class*="space"], [class*="conversation"],
[class*="nav"], [class*="nav-item"], [class*="menu-item"], [class*="list-item"] {
  color: ${component.text} !important;
}
p, span, div, label, li, button, input, textarea, select {
  color: inherit !important;
}
/* Icon color system: force icons to inherit theme text color */
svg, svg *, svg path, svg circle, svg rect, svg line, svg polyline, svg polygon {
  fill: currentColor !important;
  stroke: currentColor !important;
}
i, [class*="icon"], [class*="Icon"], [class*="svg-icon"], [class*="img-icon"],
[class*="avatar"] svg, [class*="nav"] svg {
  color: ${component.text} !important;
}
button[class*="primary"] i, button[class*="primary"] [class*="icon"],
[class*="accent"] i, [class*="accent"] [class*="icon"],
[class*="primary"] svg {
  color: ${component.text} !important;
}

/* 列表中的标题/标签文字（WorkBuddy 使用哈希 _title_ 类） */
[class*="_title_"],
.conversation-sidebar [class*="_title_"],
.conversation-section-label-text,
[class*="conversation-section-label"] {
  color: ${component.text} !important;
}
/* 提升特异性，覆盖 WorkBuddy 原生的 .conversation-agent-card [class*="title"]:not(...) !important */
#root .conversation-sidebar [class*="_title_"],
#root .conversation-list [class*="_title_"] {
  color: ${component.text} !important;
}
/* 列表中的时间戳/辅助文字 */
[class*="_timestamp_"], [class*="timestamp"], [class*="meta"] {
  color: ${component.textMuted} !important;
}

/* 基础容器不要带背景和框线 */
p, div, span, label, li {
  background-color: transparent !important;
  border: none !important;
}

a, a:link, a:visited, [class*="link"] { color: ${component.link} !important; }
a:hover, [class*="link"]:hover { color: ${tokens.secondary} !important; }
[class*="muted"], [class*="secondary"], [class*="desc"], [class*="subtitle"],
[class*="placeholder"], [class*="timestamp"], [class*="caption"] {
  color: ${component.textMuted} !important;
}
::placeholder { color: ${component.textPlaceholder} !important; }

/* Primary buttons: accent outline/text, filled on hover */
button[class*="primary"], [class*="button"][class*="primary"], .vs-button-primary, .monaco-button,
button[type="submit"], [role="button"][class*="primary"] {
  background: ${bp.bg} !important;
  color: ${bp.text} !important;
  border: 1px solid ${bp.border} !important;
  border-radius: 10px !important;
  box-shadow: none !important;
  transition: all 0.15s ease !important;
}
button[class*="primary"]:hover, [class*="button"][class*="primary"]:hover, .vs-button-primary:hover, .monaco-button:hover,
button[type="submit"]:hover, [role="button"][class*="primary"]:hover {
  background: ${bp.hoverBg} !important;
  color: ${bp.hoverText} !important;
  border-color: ${bp.hoverBg} !important;
}

/* Default buttons: clean transparent with subtle border, glass on hover */
button:not([class*="primary"]):not([type="submit"]), [role="button"]:not([class*="primary"]),
[class*="button"]:not([class*="primary"]), [class*="_button_"] {
  background: transparent !important;
  color: ${bs.text} !important;
  border: 1px solid ${bs.border} !important;
  border-radius: 10px !important;
  transition: all 0.15s ease !important;
}
button:not([class*="primary"]):not([type="submit"]):hover, [role="button"]:not([class*="primary"]):hover,
[class*="button"]:not([class*="primary"]):hover, [class*="_button_"]:hover {
  background: ${bs.hoverBg} !important;
  border-color: ${withAlpha(tokens.surface, dark ? 0.18 : 0.28)} !important;
}

/* Inputs: glass instead of solid dark */
input, textarea, select,
[class*="input"], [class*="textarea"], [class*="search"], [class*="prompt"],
.monaco-input, .vs-input,
.monaco-workbench .monaco-editor .inputarea,
.monaco-workbench .suggest-widget, .monaco-workbench .quick-input-widget {
  background: ${input.bg} !important;
  color: ${input.text} !important;
  border: 1px solid ${input.border} !important;
  border-radius: 12px !important;
}
input:focus, textarea:focus, [class*="input"]:focus, [class*="textarea"]:focus {
  border-color: ${input.focusBorder} !important;
  box-shadow: 0 0 0 3px ${withAlpha(input.focusBorder, 0.22)} !important;
}

hr, [class*="divider"], [class*="separator"] {
  border-color: ${component.divider} !important;
  background: ${component.divider} !important;
}

/* Cards / bubbles: transparent by default, faint glass on hover */
[class*="card"], [class*="bubble"] {
  background: transparent !important;
  border: none !important;
  color: ${component.text} !important;
}
[class*="card"]:hover, [class*="bubble"]:hover {
  background: ${chipHoverBg} !important;
}

/* Tags / badges / chips / capsules: NO border, NO fill by default.
   去掉默认边框，避免相邻边框被看成一条背景条。hover 才显示淡背景。 */
[class*="tag"], [class*="badge"], [class*="chip"], [class*="pill"], [class*="category"] {
  background: transparent !important;
  border: none !important;
  color: ${component.text} !important;
  border-radius: 999px !important;
  padding: 2px 10px !important;
  box-shadow: none !important;
  transition: all 0.15s ease !important;
}
[class*="tag"]:hover, [class*="badge"]:hover, [class*="chip"]:hover,
[class*="pill"]:hover, [class*="category"]:hover {
  background: ${chipHoverBg} !important;
}

/* 交付总览/产物卡片/表格等面板：WorkBuddy 默认用实色（白/棕），与皮肤冲突 */
#root .main-content table, #root .main-content thead, #root .main-content tbody,
#root .main-content tr, #root .main-content td, #root .main-content th,
#root .cb-markdown table, #root .cb-markdown thead, #root .cb-markdown tbody,
#root .cb-markdown tr, #root .cb-markdown td, #root .cb-markdown th,
#root .teams-main-content [class*="table"], #root .teams-main-content [class*="summary"],
#root .teams-main-content [class*="delivery"], #root .teams-main-content [class*="overview"],
#root .teams-main-content [class*="artifact"], #root .teams-main-content [class*="attachment"],
#root .teams-main-content [class*="file-card"], #root .teams-main-content [class*="resource"],
#root .teams-main-content [class*="result"], #root .teams-main-content [class*="card"],
#root .cb-markdown [class*="card"], #root .cb-markdown [class*="artifact"],
#root .cb-markdown [class*="summary"], #root .cb-markdown [class*="delivery"] {
  background-color: ${withAlpha(tokens.surface, dark ? 0.20 : 0.52)} !important;
  color: ${component.text} !important;
  border-color: ${component.border} !important;
  backdrop-filter: blur(14px) saturate(1.1) !important;
  -webkit-backdrop-filter: blur(14px) saturate(1.1) !important;
}

/* 专家中心顶部精选场景卡片：原生有背景图 + 底部白色渐变遮罩，
   皮肤下浅色文字会看不清。加深卡片底色并把白色渐变改为 surface 色渐变。 */
#root .expert-center-page .ec-featured-scenes-section .ec-featured-scene-card,
#root .expert-center-page .ec-featured-scenes-strip > article,
#root .expert-center-page .ec-featured-scenes-strip > div {
  background-color: ${withAlpha(tokens.surface, dark ? 0.55 : 0.42)} !important;
  background-image: none !important;
  border: 1px solid ${component.border} !important;
  border-radius: 16px !important;
  color: ${component.text} !important;
  backdrop-filter: blur(16px) saturate(1.15) !important;
  -webkit-backdrop-filter: blur(16px) saturate(1.15) !important;
}
#root .expert-center-page .ec-featured-scenes-section .ec-featured-scene-card:hover {
  background-color: ${withAlpha(tokens.surface, dark ? 0.68 : 0.52)} !important;
}
#root .expert-center-page .ec-featured-scene-overlay {
  background-image: linear-gradient(rgba(${hexToRgb(tokens.surface).join(', ')}, 0) 18.78%, rgba(${hexToRgb(tokens.surface).join(', ')}, ${dark ? 0.82 : 0.62}) 90.23%) !important;
}
#root .expert-center-page .ec-featured-scene-name,
#root .expert-center-page .ec-featured-scene-expert-name,
#root .expert-center-page [class*="featured-scene"] [class*="name"] {
  color: ${component.text} !important;
}
/* 专家中心列表/分类标签行：原生透明背景，在壁纸皮肤上文字会看不清，
   加一条半实底毛玻璃带，保证标签文字可读。 */
#root .expert-center-page .ec-list-tabs-row,
#root .expert-center-page .ec-category-tabs-wrap,
#root .expert-center-page .ec-section-title,
#root .expert-center-page .ec-featured-scenes-title {
  background-color: ${withAlpha(tokens.surface, dark ? 0.42 : 0.55)} !important;
  backdrop-filter: blur(16px) saturate(1.15) !important;
  -webkit-backdrop-filter: blur(16px) saturate(1.15) !important;
  border-radius: 12px !important;
  color: ${component.text} !important;
}
#root .expert-center-page .ec-list-tab,
#root .expert-center-page .ec-category-tab,
#root .expert-center-page .ec-sort-btn,
#root .expert-center-page .ec-list-actions {
  background-color: transparent !important;
  color: ${component.text} !important;
}
#root .expert-center-page .ec-list-tab.is-active,
#root .expert-center-page .ec-category-tab.is-active,
#root .expert-center-page .ec-sort-btn.is-active {
  background-color: ${withAlpha(tokens.surface, dark ? 0.62 : 0.78)} !important;
  color: ${component.text} !important;
  border-radius: 8px !important;
}

/* 聊天消息气泡：毛玻璃底，保留壁纸感同时确保文字可读 */
#root [class*="userMessageBubble"],
#root [class*="assistantMessageBubble"],
#root [class*="messageBubble"],
#root [class*="message-bubble"] {
  background-color: ${withAlpha(tokens.surface, dark ? 0.32 : 0.62)} !important;
  color: ${component.text} !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: blur(14px) saturate(1.1) !important;
  -webkit-backdrop-filter: blur(14px) saturate(1.1) !important;
}

/* 代码/文本预览块：头部 + pre 包装器；保留内部 hljs 语法高亮 */
#root .cb-markdown-pre-container,
#root .cb-markdown-pre-wrapper,
#root .cb-markdown-pre,
#root .cb-markdown-pre__header,
#root [class*="markdown-pre"], #root [class*="code-block"], #root [class*="codeBlock"] {
  background-color: ${withAlpha(tokens.surface, dark ? 0.28 : 0.58)} !important;
  color: ${component.text} !important;
  border-color: ${component.border} !important;
  backdrop-filter: blur(14px) saturate(1.1) !important;
  -webkit-backdrop-filter: blur(14px) saturate(1.1) !important;
}
#root .cb-markdown-pre__header,
#root [class*="markdown-pre"][class*="header"] {
  border-bottom: 1px solid ${component.border} !important;
}
#root .cb-markdown-pre pre,
#root .cb-markdown-pre code {
  background-color: transparent !important;
  color: inherit !important;
}

/* 消息中的文件附件标签/胶囊 */
#root [class*="fileTag"],
#root [class*="file-tag"],
#root [class*="attachment-tag"],
#root [class*="resource-tag"] {
  background-color: ${withAlpha(tokens.surface, dark ? 0.25 : 0.55)} !important;
  color: ${component.text} !important;
  border: 1px solid ${component.border} !important;
  border-radius: 999px !important;
  backdrop-filter: blur(10px) saturate(1.05) !important;
  -webkit-backdrop-filter: blur(10px) saturate(1.05) !important;
}

/* 输入区主容器 */
#root [class*="mainArea"], #root [class*="main-area"],
#root [class*="composer"], #root [class*="prompt-area"],
#root [class*="inputArea"], #root [class*="input-area"] {
  background-color: ${withAlpha(tokens.surface, dark ? 0.30 : 0.60)} !important;
  border: 1px solid ${component.border} !important;
  color: ${component.text} !important;
  backdrop-filter: blur(16px) saturate(1.15) !important;
  -webkit-backdrop-filter: blur(16px) saturate(1.15) !important;
}

/* 聊天内渲染的计划/任务详情卡片 */
#root [class*="plan-task-detail"], #root [class*="task-detail"],
#root [class*="plan-card"], #root [class*="task-card"] {
  background-color: ${withAlpha(tokens.surface, dark ? 0.24 : 0.54)} !important;
  color: ${component.text} !important;
  border: 1px solid ${component.border} !important;
  backdrop-filter: blur(14px) saturate(1.1) !important;
  -webkit-backdrop-filter: blur(14px) saturate(1.1) !important;
}

::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: ${sb.track}; }
::-webkit-scrollbar-thumb { background: ${sb.thumb}; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: ${sb.hover}; }`;

  // backgroundLayer 必须放最后：它负责清空所有外壳底色并安装唯一壁纸持有者，
  // 若放在前面会被 containerLayer 的玻璃规则覆盖回不透明。
  return [vars, containerLayer, componentLayer, backgroundLayer].join('\n\n') + '\n';
}

// ===== 皮肤列表 =====
export function listSkins() {
  ensureDirs();
  const out = [];
  for (const name of fs.readdirSync(SKINS_DIR)) {
    const dir = path.join(SKINS_DIR, name);
    const meta = path.join(dir, 'skin.json');
    if (fs.statSync(dir).isDirectory() && fs.existsSync(meta)) {
      try {
        const data = JSON.parse(fs.readFileSync(meta, 'utf8'));
        const heroDataUrl = readHeroDataUrl(dir, data);
        out.push({ ...data, id: name, heroDataUrl });
      } catch {}
    }
  }
  return out;
}

function inlineLocalUrls(css, dir) {
  return css.replace(/url\(\s*["']?([^)"'\s]+)["']?\s*\)/gi, (match, rel) => {
    // 已经是 data url / http / 绝对路径 则跳过
    if (/^(data:|https?:|\/)/i.test(rel)) return match;
    const abs = path.join(dir, rel);
    if (!fs.existsSync(abs)) return match;
    const ext = path.extname(abs).toLowerCase();
    const mime =
      ext === '.png' ? 'image/png' :
      ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
      ext === '.webp' ? 'image/webp' :
      ext === '.woff2' ? 'font/woff2' :
      ext === '.woff' ? 'font/woff' :
      ext === '.ttf' ? 'font/ttf' :
      'application/octet-stream';
    const b64 = fs.readFileSync(abs).toString('base64');
    return `url("data:${mime};base64,${b64}")`;
  });
}

function readHeroDataUrl(dir, data) {
  // 兼容旧版 hero.webp
  const legacy = path.join(dir, 'hero.webp');
  if (fs.existsSync(legacy)) {
    return 'data:image/webp;base64,' + fs.readFileSync(legacy).toString('base64');
  }
  // .wbskin 规范：从 files.images.hero 读取
  const heroRel = data.files?.images?.hero;
  if (!heroRel) return null;
  const heroPath = path.join(dir, heroRel);
  if (!fs.existsSync(heroPath)) return null;
  const ext = path.extname(heroPath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
  return `data:${mime};base64,` + fs.readFileSync(heroPath).toString('base64');
}

// ===== 读取皮肤（用于应用）=====
export function getSkin(id) {
  const dir = path.join(SKINS_DIR, id);
  const meta = path.join(dir, 'skin.json');
  if (!fs.existsSync(meta)) return null;
  const data = JSON.parse(fs.readFileSync(meta, 'utf8'));
  const heroDataUrl = readHeroDataUrl(dir, data);

  // 按 files.css 顺序合并 CSS；兼容旧版 theme.css
  let css = '';
  const cssFiles = data.files?.css || ['theme.css'];
  for (const rel of cssFiles) {
    const p = path.join(dir, rel);
    if (fs.existsSync(p)) css += fs.readFileSync(p, 'utf8') + '\n';
  }

  // 如果没有读到 CSS，回退生成（旧数据兼容）
  if (!css.trim() && data.colors) {
    css = buildThemeCss(data.colors, data.theme === 'dark', heroDataUrl);
  }

  // 将 CSS 中的相对资源路径（images/ fonts/）内联为 data URL，
  // 因为注入到 WorkBuddy 后无法访问本地相对路径
  css = inlineLocalUrls(css, dir);

  return { ...data, id, dir, heroDataUrl, css };
}

// ===== 保存皮肤（旧版生成器兼容）=====
export function saveSkin({ id, name, colors, dark, heroBuffer, themeCss }) {
  const dir = path.join(SKINS_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  const meta = {
    schemaVersion: '1.0',
    id,
    name,
    theme: dark ? 'dark' : 'light',
    colors,
    files: {
      css: ['theme.css'],
      images: heroBuffer ? { hero: 'hero.webp' } : {},
    },
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(dir, 'skin.json'), JSON.stringify(meta, null, 2));
  fs.writeFileSync(path.join(dir, 'theme.css'), themeCss);
  if (heroBuffer) fs.writeFileSync(path.join(dir, 'hero.webp'), heroBuffer);
  return { ...meta, id };
}

// ===== 删除皮肤 =====
export function deleteSkin(id) {
  const dir = path.join(SKINS_DIR, id);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

// ===== 导出 .wbskin =====
export function exportWbskin(id, destPath) {
  const dir = path.join(SKINS_DIR, id);
  const meta = path.join(dir, 'skin.json');
  if (!fs.existsSync(meta)) throw new Error('皮肤不存在');
  const tmpFile = path.join(os.tmpdir(), `wbskin-export-${id}-${Date.now()}.zip`);
  try {
    // 在皮肤目录内打包，确保 zip 根目录直接是 skin.json / theme.css / images/
    execSync(`cd "${dir}" && zip -q -r "${tmpFile}" .`, { timeout: 30000 });
    fs.cpSync(tmpFile, destPath);
  } finally {
    fs.rmSync(tmpFile, { force: true });
  }
  return { ok: true, destPath };
}

// ===== 导入 .wbskin =====
export function importWbskin(wbskinPath) {
  if (!fs.existsSync(wbskinPath)) throw new Error('文件不存在');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wbskin-'));
  try {
    // macOS / Linux 均内置 unzip
    execSync(`unzip -q "${wbskinPath}" -d "${tmpDir}"`, { timeout: 30000 });
  } catch (e) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    throw new Error('解压 .wbskin 失败，请确认文件是有效的 zip 包');
  }

  const metaPath = path.join(tmpDir, 'skin.json');
  if (!fs.existsSync(metaPath)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    throw new Error('该 .wbskin 缺少 skin.json，不是有效皮肤包');
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  } catch {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    throw new Error('skin.json 解析失败');
  }

  const id = data.id || path.basename(wbskinPath, path.extname(wbskinPath));
  const dest = path.join(SKINS_DIR, id);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(tmpDir, dest, { recursive: true, force: true });
  fs.rmSync(tmpDir, { recursive: true, force: true });

  return { ...data, id };
}
