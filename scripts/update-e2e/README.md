# 增量更新的端到端验收

改了更新相关的代码（`src/main/updater.ts`、`src/main/update.ts`、`scripts/pack-win.sh`、
`electron-builder.yml` 的 publish）都要做一遍。做法照千语集。

全程用另一个身份：包名 `qonsona-updatetest`、appId `io.github.kinnuch.qonsona.updatetest`、
产品名 QonsonaUpdateTest、不建快捷方式，装在工作目录里。装着的 Qonsona（注册表项、
`%APPDATA%\qonsona`、`%LOCALAPPDATA%\qonsona-updater`），连同改名前装的 Qonlang Study（`%APPDATA%\qonlang-study`、
`%LOCALAPPDATA%\qonlang-study-updater`）一概不碰。
测试版的可执行文件也叫 `Qonsona.exe`：停进程要按路径过滤，别按名字杀。
（NSIS 安装包自己关进程时按安装目录找，不会误关装着的那份。）

下面在 Git Bash 里、仓库根目录下做；`W` 是工作目录，默认 `dist/update-e2e`。

1. **打两个版本**：`bash scripts/update-e2e/build.sh`。package.json 临时改成测试身份，结束时拷回
   （上次没拷回时脚本会先停下）。产物在 `W/out-9.0.0`、`W/out-9.0.1`，本机更新源在 `W/feed`。
2. **静默装 9.0.0**：`W/out-9.0.0/QonsonaUpdateTest-9.0.0-setup.exe /S /D=<W 的 Windows 路径>\inst`。
   核对 `%LOCALAPPDATA%\qonsona-updatetest-updater\installer.exe` 跟 9.0.0 安装包一样
   （`node scripts/update-e2e/check.mjs sha <文件>` 比两边）——增量拿它当旧版。
3. **起更新源**：`node scripts/update-e2e/server.mjs W/feed W/server.log`（只认单段 Range，跟 GitHub 一样）。
4. **起测试版**：`env -u ELECTRON_RUN_AS_NODE W/inst/Qonsona.exe --remote-debugging-port=9351`
   （从 PowerShell 起会带上 `ELECTRON_RUN_AS_NODE`，程序当成 Node 跑、马上退出）。
5. **各轮下载**，每轮 `bash scripts/update-e2e/round.sh <标签>`：
   - 正常：只下变了的块（约 1%，9 个 206），逐字节一样；
   - 篡改分段：`UT_MODE=corrupt-ranges` 重起更新源 → sha512 对不上 → 整包，逐字节一样；
   - 旧 blockmap 不在：把 `W/feed` 里 9.0.0 的 `.blockmap` 挪走 → 404 → 整包；
   - latest.yml 不在：把它挪走 → electron-updater 走不了 → 程序自己整包下到 `%TEMP%\qonsona-update`。

   跑完把挪走的挪回来，更新源改回正常。

6. **安装**：再跑一轮正常的，然后 `node scripts/update-e2e/cdp.mjs scripts/update-e2e/install.js`。
   程序退出，静默装好后自己重开。核对：HKCU 下测试版的 `DisplayVersion` 是 9.0.1；
   `node scripts/update-e2e/check.mjs tree W/app-9.0.1 W/inst` 只多一个卸载程序；
   updater 缓存里的 `installer.exe` 换成了 9.0.1 的安装包（下次增量拿它当旧版）。
7. **收尾**：按路径停掉 `W\inst` 下的进程和更新源；`W/inst/Uninstall Qonsona.exe /S`；
   删 `%LOCALAPPDATA%\qonsona-updatetest-updater`、`%APPDATA%\qonsona-updatetest`、
   `%TEMP%\qonsona-update`（空了才删；装着的正式版整包下载也用这个目录）；
   确认装着的 Qonsona 的注册表项、安装目录、updater 缓存都没动过；`W` 整个删掉（约 1.3 GB）。

2026-09-24 第一次做：正常一轮下了 1,324,676 字节（安装包 156,791,502 字节的 0.8%），
三种退回整包的情况都逐字节一样；装好后注册表是 9.0.1、安装目录跟 9.0.1 一致、程序自己重开了。
2026-10-09 改名 Qonsona 后再做一遍：正常一轮下了 1,272,283 字节（安装包 163,902,774 字节的 0.8%，8 个 206），
篡改分段、旧 blockmap 不在、latest.yml 不在三种都退回整包且逐字节一样；装好后注册表是 9.0.1、安装目录跟 9.0.1
一致（只多卸载程序）、updater 缓存换成 9.0.1 的安装包、程序自己重开了。
