#!/bin/bash
# 打包 WorkBuddy 皮肤管理器 为 Electron .app（含 ws 依赖）+ .dmg
set -e
PROJ="/Users/dreamsoldier/WorkSpace_WorkBuddy/v2026-7-29_Skin_For_WorkBuddy/skin-tools"
ELECTRON_APP="$PROJ/node_modules/electron/dist/Electron.app"
OUT="$PROJ/build-electron"
APP_NAME="WorkBuddy 皮肤管理器"
APP="$OUT/$APP_NAME.app"

echo "==> 清理旧产物（保留用户生成的 .wbskin 皮肤包）"
mkdir -p "$OUT"
rm -rf "$APP" "$OUT/WorkBuddySkinManager.dmg"

echo "==> 以 Electron 框架为基础创建 .app"
cp -R "$ELECTRON_APP" "$APP"

echo "==> 移除模板自带 default_app（避免与我们的 app 冲突）"
rm -f "$APP/Contents/Resources/default_app.asar" 2>/dev/null || true

echo "==> 先生成示例皮肤 .wbskin（供预装与 dmg 使用）"
node "$PROJ/build-sample-skin.cjs"

echo "==> 放入应用代码到 Contents/Resources/app"
mkdir -p "$APP/Contents/Resources/app"
cp -R "$PROJ/lib"        "$APP/Contents/Resources/app/lib"
cp -R "$PROJ/public"     "$APP/Contents/Resources/app/public"
cp "$PROJ/main.cjs"      "$APP/Contents/Resources/app/main.cjs"
cp "$PROJ/preload.cjs"   "$APP/Contents/Resources/app/preload.cjs"
cp "$PROJ/package.json"  "$APP/Contents/Resources/app/package.json"

# skins 目录：从示例 .wbskin 预解压，使 App 开箱即有内置皮肤
mkdir -p "$APP/Contents/Resources/app/skins"
SEEN=""
if [ -d "$PROJ/build-electron" ]; then
  for wb in "$PROJ/build-electron"/*.wbskin; do
    [ -e "$wb" ] || continue
    tmpd=$(mktemp -d)
    unzip -q "$wb" -d "$tmpd"
    sid=$(node -e "try{console.log(JSON.parse(require('fs').readFileSync('$tmpd/skin.json','utf8')).id)}catch(e){console.log('')}" 2>/dev/null || true)
    if [ -n "$sid" ]; then
      rm -rf "$APP/Contents/Resources/app/skins/$sid"
      mkdir -p "$APP/Contents/Resources/app/skins/$sid"
      cp -R "$tmpd/." "$APP/Contents/Resources/app/skins/$sid/"
      if [[ "$SEEN" != *"|$sid|"* ]]; then
        echo "    预装皮肤：$sid"
        SEEN="${SEEN}|$sid|"
      fi
    fi
    rm -rf "$tmpd"
  done
fi

echo "==> 复制 ws 依赖（CDP 注入所需，Electron 主进程 Node20 无全局 WebSocket）"
mkdir -p "$APP/Contents/Resources/app/node_modules"
cp -R "$PROJ/node_modules/ws" "$APP/Contents/Resources/app/node_modules/ws"

echo "==> 修改 Info.plist"
PLIST="$APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleName $APP_NAME" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName $APP_NAME" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleExecutable Electron" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier com.workbuddy.skinmanager" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion 1.0.0" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString 1.0.0" "$PLIST"
/usr/libexec/PlistBuddy -c "Delete :CFBundleSupportedPlatforms" "$PLIST" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :CFBundleSupportedPlatforms array" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :CFBundleSupportedPlatforms:0 string MacOSX" "$PLIST"
/usr/libexec/PlistBuddy -c "Delete :LSArchitecturePriority" "$PLIST" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :LSArchitecturePriority array" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :LSArchitecturePriority:0 string arm64" "$PLIST"

echo "==> ad-hoc 签名（递归）"
codesign --force --deep --sign - "$APP"

echo "==> 生成 .dmg（标准拖拽安装盘：仅 App + Applications 替身）"
DMG="$OUT/WorkBuddySkinManager.dmg"

# 确保背景图已生成（供 dmgbuild 使用）
python3 "$PROJ/build/dmg-bg/make-bg.py" 2>/dev/null || true

# 使用 dmgbuild 生成标准安装盘：自动设置 .DS_Store、图标视图、背景图、图标位置
rm -f "$DMG"
DMG_APP="$APP" \
  /Users/dreamsoldier/.workbuddy/binaries/python/envs/default/bin/dmgbuild \
  -s "$PROJ/build/dmg-settings.py" \
  "$APP_NAME" \
  "$DMG" >/dev/null 2>&1 || {
    echo "    dmgbuild 失败，回退到无布局 DMG"
    DMG_TMP=$(mktemp -d)
    STAGE="$DMG_TMP/stage"
    mkdir -p "$STAGE"
    cp -R "$APP" "$STAGE/$APP_NAME.app"
    ln -s /Applications "$STAGE/Applications"
    hdiutil create -volname "$APP_NAME" -srcfolder "$STAGE" -ov -format UDZO "$DMG" >/dev/null
    rm -rf "$DMG_TMP"
}

echo "==> 完成"
echo ".app: $APP"
echo ".dmg: $DMG"