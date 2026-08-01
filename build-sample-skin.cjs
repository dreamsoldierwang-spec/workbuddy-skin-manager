const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJ = '/Users/dreamsoldier/WorkSpace_WorkBuddy/v2026-7-29_Skin_For_WorkBuddy/skin-tools';
const SKILL = '/Users/dreamsoldier/.workbuddy/skills/workbuddy-skin-generator';
const TMP = path.join(PROJ, 'tmp-sample-skin');

const id = 'cyber-neon';
const skin = {
  schemaVersion: '2.0',
  id,
  name: '赛博霓虹',
  author: 'WorkBuddy Skin Generator',
  description: '深色赛博朋克霓虹风格，毛玻璃面板 + 高对比文字。',
  theme: 'dark',
  colors: {
    accent: '#00f0ff',
    secondary: '#ff00aa',
    surface: '#0a0a14',
    surfaceTransparent: 'rgba(16,16,30,0.92)',
    text: '#f0f2ff',
    textMuted: '#a0a4c0',
    inputBg: 'rgba(0,0,0,0.45)'
  },
  layers: {
    background: {
      type: 'gradient',
      gradient: 'radial-gradient(ellipse at 50% 0%, #141428 0%, #050510 60%)',
      overlay: 'rgba(0,0,0,0.25)'
    },
    container: {
      opacity: 0.38,
      blur: 30,
      saturation: 1.3,
      radius: 18,
      border: '1px solid rgba(255,255,255,0.10)',
      shadow: '0 8px 32px rgba(0,0,0,0.35)',
      sidebar: { opacity: 0.46, blur: 26, radius: 0 },
      panel: { opacity: 0.32, blur: 34, radius: 22 },
      input: { opacity: 0.54, blur: 26, radius: 26 }
    },
    component: {
      text: '#f0f2ff',
      textMuted: '#a0a4c0',
      link: '#00f0ff'
    },
    tokens: {
      primary: '#00f0ff',
      secondary: '#ff00aa'
    }
  },
  files: {
    css: ['theme.css'],
    images: {}
  },
  createdAt: new Date().toISOString()
};

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });
fs.writeFileSync(path.join(TMP, 'skin.json'), JSON.stringify(skin, null, 2));

execSync(`node "${path.join(SKILL, 'scripts/build-theme-css.js')}" "${path.join(TMP, 'skin.json')}" "${path.join(TMP, 'theme.css')}"`, { stdio: 'inherit' });

const outWbskin = path.join(PROJ, 'build-electron', `${skin.name}.wbskin`);
fs.mkdirSync(path.dirname(outWbskin), { recursive: true });
execSync(`node "${path.join(SKILL, 'scripts/pack-wbskin.js')}" "${TMP}" "${outWbskin}"`, { stdio: 'inherit' });

console.log('Sample skin created at:', outWbskin);
