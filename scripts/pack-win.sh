#!/usr/bin/env bash
# 手动打 Windows 免安装版（绕过 electron-builder 在这台机器上目录改名时的 EPERM，做法同千语集）。
# 产物：dist/win-unpacked/Qonsona.exe；再跑 npm run installer:win 出安装包。
# 前提：已 npm install；electron 二进制已在 node_modules/electron/dist。
set -euo pipefail
cd "$(dirname "$0")/.."
unset ELECTRON_RUN_AS_NODE || true
unset VITE_QON_TEST_MODE QON_TEST_MODE || true
npx electron-vite build
OUT="${OUT:-dist/win-unpacked}"
# OUT 可以避开用户仍在运行的旧包；递归清理前先约束为当前仓库的 dist 子目录。
node --input-type=module - "$OUT" <<'JS'
import { resolve, relative, isAbsolute } from 'node:path'
const root = resolve('dist')
for (const candidate of [process.argv[2], 'dist/app-stage']) {
  const target = resolve(candidate), path = relative(root, target)
  if (!path || path === '..' || path.startsWith('..' + '/') || path.startsWith('..' + '\\') || isAbsolute(path))
    throw new Error('All cleanup targets must be child directories of this checkout dist/')
}
if (resolve(process.argv[2]) === resolve('dist/app-stage'))
  throw new Error('OUT must differ from the temporary app-stage directory')
JS
rm -rf "$OUT" dist/app-stage
mkdir -p "$OUT" dist/app-stage/node_modules dist/app-stage/resources
cp -r node_modules/electron/dist/. "$OUT/"
cp -r out dist/app-stage/out
# 词典数据库（resources/data）放在 asar 外面：SQLite 读不了 asar 里的文件
cp resources/icon.png dist/app-stage/resources/
mkdir -p "$OUT/resources/speech"
cp -r resources/speech/. "$OUT/resources/speech/"
if [ -d resources/data ]; then
  mkdir -p "$OUT/resources/data"
  cp -r resources/data/. "$OUT/resources/data/"
else
  echo "错误：缺少 resources/data；发布需要全部十一项数据库（运行 node scripts/release/fetch-data.mjs 获取已验证的数据包）" >&2
  exit 1
fi
# 主进程运行时 require 的依赖（electron-vite 把 dependencies 留在包外），连同它们各自的依赖一起拷
node scripts/release/pack-runtime.mjs copy dist/app-stage
node -e '
const p = require("./package.json");
require("fs").writeFileSync("dist/app-stage/package.json", JSON.stringify({
  name: p.name, productName: process.env.PRODUCT_NAME || "Qonsona", version: p.version, description: p.description,
  main: p.main, author: "Kinnuch", license: "MIT", private: true }, null, 2));'
node scripts/release/pack-runtime.mjs asar dist/app-stage "$OUT/resources/app.asar"
rm -f "$OUT/resources/default_app.asar"
# 应用内增量更新读这个文件（electron-builder 自己打包时会生成同样一份；--prepackaged 不会，所以这里写）。
# 仓库名跟 src/main/update.ts、electron-builder.yml 的 publish 一致
cat > "$OUT/resources/app-update.yml" <<'YML'
owner: Kinnuch
repo: Qonsona
provider: github
releaseType: release
updaterCacheDirName: qonsona-updater
YML
mv -f "$OUT/electron.exe" "$OUT/Qonsona.exe"
# 给 exe 写入图标与版本信息（rcedit 随 electron-winstaller 附带）
RCEDIT=node_modules/electron-winstaller/vendor/rcedit.exe
if [ -f "$RCEDIT" ]; then
  VER=$(node -p 'require("./package.json").version')
  "$RCEDIT" "$OUT/Qonsona.exe" --set-icon build/icon.ico --set-version-string ProductName "Qonsona" --set-version-string FileDescription "Qonsona" --set-version-string CompanyName Kinnuch --set-version-string LegalCopyright "MIT" --set-file-version "$VER" --set-product-version "$VER" || echo "rcedit failed (icon not embedded)"
fi
rm -rf dist/app-stage
echo "done: $OUT/Qonsona.exe"
