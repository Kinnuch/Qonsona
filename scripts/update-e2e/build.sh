#!/usr/bin/env bash
# 增量更新验收第一步：用另一个身份（包名 qonsona-updatetest、appId、产品名、不建快捷方式）
# 打 9.0.0 与 9.0.1 两个安装包，再拼出本机更新源 feed/。装上去、更新都碰不到装着的 Qonsona。
# 用法（Git Bash，仓库根目录）：bash scripts/update-e2e/build.sh [工作目录，默认 dist/update-e2e]
set -euo pipefail
cd "$(dirname "$0")/../.."
mkdir -p "${1:-dist/update-e2e}"
# electron-builder 与 NSIS 要 Windows 形式的绝对路径
WORK=$(cd "${1:-dist/update-e2e}" && pwd -W)
unset ELECTRON_RUN_AS_NODE || true

# 仓库可能还没提交：package.json 先备份、结束时拷回。上次没拷回就先停下，免得把测试身份当成原件备份
if grep -q '"name": "qonsona-updatetest"' package.json; then
  echo "package.json 还是测试身份（上次没还原？）：先把 $WORK/package.json.bak 拷回来"
  exit 1
fi
cp package.json "$WORK/package.json.bak"
trap 'cp "$WORK/package.json.bak" package.json' EXIT

build() {
  local V=$1
  node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync("package.json","utf8"));p.name="qonsona-updatetest";p.version=process.argv[1];fs.writeFileSync("package.json",JSON.stringify(p,null,2)+"\n")' "$V"
  PRODUCT_NAME=QonsonaUpdateTest OUT="$WORK/app-$V" bash scripts/pack-win.sh
  # 更新源指向本机的测试服务；跟 GitHub 一样只发单段 Range
  cat > "$WORK/app-$V/resources/app-update.yml" <<'YML'
provider: generic
url: http://127.0.0.1:8765/
useMultipleRangeRequest: false
updaterCacheDirName: qonsona-updatetest-updater
YML
  ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/ \
    npx electron-builder --win nsis --prepackaged "$WORK/app-$V" --publish never \
    -c.appId=io.github.kinnuch.qonsona.updatetest \
    -c.productName=QonsonaUpdateTest \
    -c.nsis.shortcutName=QonsonaUpdateTest \
    -c.nsis.uninstallDisplayName=QonsonaUpdateTest \
    -c.nsis.createDesktopShortcut=false \
    -c.nsis.createStartMenuShortcut=false \
    '-c.nsis.artifactName=QonsonaUpdateTest-${version}-setup.${ext}' \
    "-c.directories.output=$WORK/out-$V"
}

build 9.0.0
build 9.0.1

# 更新源：9.0.1 的安装包、latest.yml、新旧两版的 .blockmap
rm -rf "$WORK/feed"
mkdir -p "$WORK/feed"
cp "$WORK/out-9.0.1/latest.yml" \
  "$WORK/out-9.0.1/QonsonaUpdateTest-9.0.1-setup.exe" \
  "$WORK/out-9.0.1/QonsonaUpdateTest-9.0.1-setup.exe.blockmap" \
  "$WORK/out-9.0.0/QonsonaUpdateTest-9.0.0-setup.exe.blockmap" \
  "$WORK/feed/"
ls -la "$WORK/feed"
echo "BUILD-DONE: $WORK"
