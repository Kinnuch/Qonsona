#!/usr/bin/env bash
# 手动打 Windows 免安装版（绕过 electron-builder 在这台机器上目录改名时的 EPERM，做法同千语集）。
# 产物：dist/win-unpacked/Qonsona.exe；再跑 npm run installer:win 出安装包。
# 前提：已 npm install；electron 二进制已在 node_modules/electron/dist。
set -euo pipefail
cd "$(dirname "$0")/.."
unset ELECTRON_RUN_AS_NODE || true
npx electron-vite build
OUT="${OUT:-dist/win-unpacked}"
rm -rf "$OUT" dist/app-stage
mkdir -p "$OUT" dist/app-stage/node_modules dist/app-stage/resources
cp -r node_modules/electron/dist/. "$OUT/"
cp -r out dist/app-stage/out
# 词典数据库（resources/data）放在 asar 外面：SQLite 读不了 asar 里的文件
cp resources/icon.png dist/app-stage/resources/
if [ -d resources/data ]; then
  mkdir -p "$OUT/resources/data"
  cp -r resources/data/. "$OUT/resources/data/"
else
  echo "错误：缺少 resources/data；发布需要全部八语言的九个数据库（运行 node scripts/release/fetch-data.mjs 获取已验证的数据包）" >&2
  exit 1
fi
# 主进程运行时 require 的依赖（electron-vite 把 dependencies 留在包外），连同它们各自的依赖一起拷
node -e '
const fs = require("fs"), path = require("path")
const seen = new Set()
const walk = (n) => {
  if (seen.has(n)) return
  seen.add(n)
  const pj = require(path.resolve("node_modules", n, "package.json"))
  for (const d of Object.keys(pj.dependencies || {})) walk(d)
}
walk("@electron-toolkit/utils")
walk("kuromoji")
walk("electron-updater")
for (const n of seen)
  fs.cpSync(path.join("node_modules", n), path.join("dist/app-stage/node_modules", n), { recursive: true })
console.log("runtime deps: " + [...seen].join(" "))'
node -e '
const p = require("./package.json");
require("fs").writeFileSync("dist/app-stage/package.json", JSON.stringify({
  name: p.name, productName: process.env.PRODUCT_NAME || "Qonsona", version: p.version, description: p.description,
  main: p.main, author: "Kinnuch", license: "MIT", private: true }, null, 2));'
npx --yes @electron/asar pack dist/app-stage "$OUT/resources/app.asar"
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
