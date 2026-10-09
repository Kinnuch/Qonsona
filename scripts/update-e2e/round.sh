#!/usr/bin/env bash
# 一轮下载验收：清掉两处下载缓存（连同 current.blockmap）与服务端日志，在装好的测试版里调 app:downloadUpdate，
# 报服务端发了多少字节、update.log 的走法、下到的文件跟 9.0.1 安装包是否逐字节一样。
# 用法：bash scripts/update-e2e/round.sh <标签> [工作目录，默认 dist/update-e2e]
HERE=$(cd "$(dirname "$0")" && pwd)
LABEL="$1"
WORK="${2:-$HERE/../../dist/update-e2e}"
NAME=QonsonaUpdateTest-9.0.1-setup.exe
L=$(cygpath -u "$LOCALAPPDATA")
R=$(cygpath -u "$APPDATA")
CACHE="$L/qonsona-updatetest-updater"
FULL="$L/Temp/qonsona-update/$NAME"
LOG="$R/qonsona-updatetest/update.log"
# 上一轮成功后 electron-updater 会把新版的 blockmap 存成 current.blockmap，下一轮拿它当旧版比对就拼错了（再退回整包）
rm -rf "$CACHE/pending"
rm -f "$CACHE/current.blockmap" "$FULL" "$LOG"
: > "$WORK/server.log"
OUT=$(node "$HERE/cdp.mjs" "$HERE/download.js" 2>&1 | tr -s '[:space:]' ' ')
echo "== $LABEL"
echo "result: $(echo "$OUT" | cut -c1-400)"
echo "served: $(node "$HERE/check.mjs" served "$WORK/server.log" "$NAME")"
echo "update.log: $(tr -s '[:space:]' ' ' < "$LOG" 2>/dev/null | cut -c1-900)"
for F in "$CACHE/pending/$NAME" "$FULL"; do
  [ -f "$F" ] || continue
  if cmp -s "$F" "$WORK/out-9.0.1/$NAME"; then echo "identical: yes ($F)"; else echo "identical: NO ($F)"; fi
done
