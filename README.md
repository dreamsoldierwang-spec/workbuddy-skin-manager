# WorkBuddy 皮肤管理器（workbuddy-skin-manager）

macOS 桌面应用，用于导入、应用、导出、管理 WorkBuddy 皮肤（`.wbskin`）。

## 这是什么

一个**纯 Electron 桌面应用**——不依赖浏览器、不启 HTTP 服务，窗口直接加载本地界面，所有操作走 Electron IPC。它消费由「WorkBuddy 皮肤生成 Skill」（`workbuddy-skin-generator`）产出的 `.wbskin` 皮肤包。

## 功能

- 导入 `.wbskin`（点击选择或拖拽）
- 一键应用皮肤到 WorkBuddy（通过 CDP 注入 CSS）
- 导出已有皮肤为 `.wbskin`
- 删除 / 恢复默认皮肤
- 皮肤卡片预览（缩略图 + 标签 + 配色圆点）

## 运行（开发模式）

```bash
npm install
npm start
```

要求：Node ≥ 20、macOS，且 **WorkBuddy 正在运行**（应用皮肤需要连接 WorkBuddy 的 CDP 调试端口）。

## 打包（生成 .app / .dmg）

需要 [Node.js](https://nodejs.org) ≥ 20 与 Python ≥ 3.9（dmg 安装盘布局用 Python 的 `dmgbuild` 生成）：

```bash
npm install
pip install dmgbuild          # 生成标准 macOS 拖拽安装盘
npm run dist
# 或
bash build/make-electron-app.sh
```

产物位于 `build-electron/`：
- `WorkBuddy 皮肤管理器.app` —— 可直接运行的桌面应用
- `WorkBuddySkinManager.dmg` —— 标准 macOS 拖拽安装盘

> **DMG 内容**：只包含 `WorkBuddy 皮肤管理器.app` 与指向 `/Applications` 的替身，打开后即为「把 App 拖到 Applications」的标准安装界面，不再夹杂 `.wbskin` 皮肤文件。
>
> **预装皮肤**：`skins/` 目录下的 5 套示例皮肤（赛博霓虹 / 功夫足球 / 蜘蛛侠 / 三国·争洛阳 / 奥德赛·斯巴达）会预解压进 `.app/Contents/Resources/app/skins/`，用户打开 App 即可直接使用。示例皮肤的重新生成由 `build-sample-skin.cjs` 调用 `workbuddy-skin-generator` Skill 完成。

## 发布说明（对外分发）

当前打包为 **ad-hoc 签名**（你自己的 Mac 可直接双击运行）。若要分发给其他 Mac 用户，苹果的 Gatekeeper 会拦截"无法验证开发者"，还需两步：

1. 用 **Developer ID Application** 证书签名（替换打包脚本中的 `codesign` 签名标识）；
2. **公证**（`xcrun notarytool` 提交）+ **装订**（`xcrun stapler staple` 票据）。

## 目录结构

```
workbuddy-skin-manager/
├── main.cjs                 # Electron 主进程（loadFile 本地界面，无浏览器/HTTP）
├── preload.cjs              # 预加载脚本（暴露 electronAPI）
├── lib/                     # 后端逻辑（skins / cdp / launcher / config）
├── public/                  # 前端界面（index.html / app.js / style.css）
├── build/                   # 打包脚本（make-electron-app.sh）
├── build-sample-skin.cjs    # 示例皮肤生成
├── skins/                   # 预置示例皮肤
├── package.json
├── package-lock.json
└── README.md
```

## 皮肤格式

`.wbskin` 为 ZIP，含 `skin.json` / `theme.css` / `images/`。完整规范见配套 Skill `workbuddy-skin-generator` 的 `references/wbskin-spec.md`。

## License

MIT
