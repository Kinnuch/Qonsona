# Windows 更新验收 / Windows update validation

修改更新交接或安装前检查后，除客户端回归测试，还须验证真实 Electron 与 NSIS 升级。

## 隔离身份

使用独立的 `appId`、产品名、包名、可执行文件名、安装目录和学习数据目录，不创建桌面或开始菜单快捷方式。
测试可执行文件名必须与正式 `Qonsona.exe` 不同；旧 NSIS 卸载器可能按名称停止进程。
两个测试版本必须使用同一个测试身份，且安装前确认它尚未注册。测试包只用于验收，不上传到正式 Release。

## 必须验证的情况

- 两版完整安装包实际升级：在文章写入延迟时触发更新，保存完成之前没有安装器，旧进程真正退出后才开始安装，新版重启后仍能读取原文章。
- 旧 `0.4.1` → 新安装器的首次升级：旧更新器会先启动安装器；新的静默 `--updated` 预检只对已登记原安装目录内、路径与预期可执行文件完全一致的进程，有界等待其正常保存并自然退出，然后重新检查全部进程和文件才可卸载。等待最多 20 秒；超时、其它目录同名实例或其它占用均保留原安装文件。
- 保存失败、取消、助手无法启动与重复点击：窗口继续可用，没有提前退出或重复安装；解除故障后能够重新保存、正常退出。
- 旧保存请求取消后的迟到成功和失败都不能影响新请求。
- 手动安装时目标目录内的程序、拒绝共享删除权限的文件、另一个目录内的同名实例均会阻止卸载；原文件保持，其他实例继续运行。
- 中文、空格、`&` 和超过 260 字符的依赖文件路径。检查使用非破坏性 DELETE 访问句柄与扩展 Win32 路径，不读取学习文件内容。
- 升级前后的正式程序与 ASAR 摘要、正式卸载注册项及原有正式进程均不变；最后只卸载测试身份并关闭自己启动的助手。

PowerShell 预检回归可运行 `node --test scripts/install-preflight.test.mjs`。还应使用系统 `SysWOW64` 的 PowerShell 5.1 验证 NSIS 实际调用的 32 位分支，并实际编译、安装与卸载测试身份，不能只依据脚本解析或 NSIS 编译成功判定通过。

## 下载专项与旧工具的使用边界

修改 `src/main/updater.ts`、`src/main/update.ts`、`scripts/pack-win.sh` 或 `electron-builder.yml` 的更新源配置时，还应保留增量下载、摘要校验及退回整包的专项验证。下面记录原有工具的走法，不能替代上面的保存交接与 NSIS 安全验收。

**现有 `build.sh` 仍把测试程序命名为 `Qonsona.exe`。它只修改包名、appId 和产品名，尚未满足当前要求的独立可执行文件名。正式程序正在运行或已经登记安装时，不可直接安装该脚本生成的测试包。** 关闭正式窗口也不能替代身份隔离；旧卸载器可能按名称处理其它实例。

开始安装前，须在独立验收副本中修正打包的可执行文件名和 `win.executableName`，让两版使用同一个、与正式版不同的测试身份，并同步启动命令、卸载程序名和相关工具里的引用。包名、appId、产品名、缓存和数据目录也须一起核对；若改了这些值，下面的固定名称应相应替换。本说明没有修改 `build.sh`，也不表示原脚本已经安全适配。

正式版的安装目录、卸载注册项、`%APPDATA%\qonsona`、`%LOCALAPPDATA%\qonsona-updater`，以及旧名称对应的 `%APPDATA%\qonlang-study`、`%LOCALAPPDATA%\qonlang-study-updater` 均不用于本专项。不得通过结束正式程序来绕过测试身份问题。

### 下载专项步骤

在独立验收副本的 Git Bash 中操作；`W` 是该副本下的工作目录，旧工具默认为 `dist/update-e2e`。安装步骤只有在上述身份修正及安装前检查完成后才能运行。端口 `8765` 和 `9351` 必须空闲，或先同步修改本机更新源与 CDP 工具的端口；不要接管其它任务的服务或窗口。

1. **准备两个版本及更新源。** 旧入口是 `bash scripts/update-e2e/build.sh`，生成 `9.0.0`、`9.0.1`，产物分别在 `W/out-9.0.0`、`W/out-9.0.1`，本机更新源在 `W/feed`。脚本会临时修改 `package.json` 并在结束时恢复；仅在副本中使用，先核对备份及最终还原。确认新旧两版 `.blockmap`、新版安装包与 `latest.yml` 齐全，`latest.yml` 的版本、文件名、大小及 sha512 与新版安装包一致。
2. **准备增量下载的旧包基线。** 确认测试身份尚未登记后，将修正身份的 `9.0.0` 静默安装到 `W/inst`。`/D=<W 的 Windows 绝对路径>\inst` 必须使用反斜杠并放在命令末尾。核对测试卸载注册项、版本和安装位置；`UninstallString` 可能在引号路径后附带 `/currentuser`，不能把整串当作文件名。旧工具的缓存是 `%LOCALAPPDATA%\qonsona-updatetest-updater\installer.exe`，须与 `9.0.0` 安装包相同；`node scripts/update-e2e/check.mjs sha <文件>` 输出与 `latest.yml` 相同格式的 sha512（base64）。这是后续增量拼接的基线。
3. **启动本机更新源。** `node scripts/update-e2e/server.mjs W/feed W/server.log` 仅监听 `127.0.0.1:8765`，支持单段 Range 并记录请求状态、范围和响应字节数。测试包的 `app-update.yml` 使用本机 generic 更新源、`useMultipleRangeRequest: false` 和测试专属缓存目录。
4. **启动并确认测试窗口。** 清除继承的 `ELECTRON_RUN_AS_NODE`，从 `W/inst` 启动已核对的独立测试可执行文件，带 `--remote-debugging-port=9351`。先通过 `app:info` 核对版本及数据目录：原测试包名对应 `%APPDATA%\qonsona-updatetest`，不能指向正式数据。若使用显式 `--user-data-dir`，还须确认安装后重启沿用同一测试数据位置。`cdp.mjs` 使用 `UT_PORT`，默认 `9351`；连接前确认该端口属于自己启动的测试实例。
5. **逐轮下载并比较结果。** 每轮使用 `bash scripts/update-e2e/round.sh <标签> [W]`。它调用 `download.js` 中的 `app:downloadUpdate`，记录收到的进度、下载路径及 `update.log`，并与 `W/out-9.0.1` 的原安装包逐字节比较。每轮仅清理自己测试缓存的 `pending`、`current.blockmap`、测试安装包临时文件及日志，保留旧 `installer.exe` 基线：前一次成功下载留下的 `current.blockmap` 会影响下一轮旧版比对。

   - 正常源：应看到增量 Range / `206` 响应，并记录实际下载量和整包大小的比例；不能仅凭下载量较小判定成功，完整文件必须相同。
   - 篡改分段：以 `UT_MODE=corrupt-ranges` 重启自己拥有的本机更新源。服务仅破坏 `.exe` 的 `206` 响应，完整 `200` 响应保持原样；拼接 sha512 校验失败后应退回整包，最终逐字节相同。
   - 缺少旧 blockmap：暂时移走 `W/feed` 中 `9.0.0` 的 `.blockmap`，记录 `404` 和退回整包结果；最终文件仍须相同。
   - 缺少 `latest.yml`：暂时移走该文件，验证 electron-updater 无法走增量时，自有下载流程将整包放到 `%TEMP%\qonsona-update`；最终文件仍须相同。

   使用 `node scripts/update-e2e/check.mjs served W/server.log <测试安装包名>` 汇总响应字节数及状态次数。每轮结束后恢复移走的测试文件；异常源只停止和重启自己创建的服务，最后恢复正常模式。

6. **验证安装交接。** 再完成一轮正常下载后，才可使用 `node scripts/update-e2e/cdp.mjs scripts/update-e2e/install.js` 触发安装。此阶段必须满足本文的保存、真实父进程退出、安装器启动和重启顺序，并补测失败与取消。核对测试注册版本变为 `9.0.1`、`node scripts/update-e2e/check.mjs tree W/app-9.0.1 W/inst` 的逐文件 sha256 比较只有预期卸载程序差异，以及测试缓存 `installer.exe` 已换成新版。新版应正常重启并读取之前保存的测试文章。
7. **收尾并核对正式安装未变。** 正常关闭自己的测试窗口，等待其保存和助手退出，再运行已核对路径的测试卸载程序。只清理自己拥有的注册身份、缓存、学习数据和工作目录；不按可执行文件名批量结束进程。`%TEMP%\qonsona-update` 由正式版共享，只能删除自己的测试文件；目录为空且确认无人使用时才可移除。最后对比正式安装、注册项、更新缓存和原有进程的前后快照。

### 历史下载与升级实测

以下是旧流程当时的结果，保留作为下载机制的历史记录，不证明旧测试身份或旧安装顺序符合当前安全要求。

| 日期       |                          正常轮下载量 |     当时整包大小 | 结果                                                                                                                                          |
| ---------- | ------------------------------------: | ---------------: | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-24 | 1,324,676 字节（约 0.8%，9 个 `206`） | 156,791,502 字节 | 正常及三种退回整包情况均逐字节相同；测试注册版本为 `9.0.1`、安装树一致，程序重启。                                                            |
| 2026-10-09 | 1,272,283 字节（约 0.8%，8 个 `206`） | 163,902,774 字节 | 改名 Qonsona 后复测；篡改分段、缺少旧 blockmap 和缺少 `latest.yml` 均退回完整且相同的安装包。安装树仅多卸载程序，缓存换成 `9.0.1`，程序重启。 |

## Implementation boundaries

Use a separate application ID, package name, product, executable, installation and learning-data directory. Disable shortcuts and never publish validation packages. Both versions share that testing identity. A distinct executable name protects real applications from legacy NSIS name-based process handling.

Run the real Electron → saved renderer/main writes → external helper → exited parent → NSIS → restarted application flow. Verify delayed and failed saves, cancellation, repeated requests, helper startup failure and stale replies. Verify busy files and other copies preserve the installation and unrelated processes, including Unicode, spaces, ampersands and long dependency filenames.

Also verify the first hop from the original `0.4.1` updater, which starts NSIS before exiting. Only silent `--updated` installers may wait up to 20 seconds for processes whose executable path exactly matches the registered old installation's executable to exit naturally after saving. Recheck all processes and files before uninstalling. Timeout, a same-name copy elsewhere, or any other blocker preserves the original installation files.

Run `node --test scripts/install-preflight.test.mjs`, test both 64-bit and NSIS's 32-bit Windows PowerShell, and exercise compiled installers and uninstallers. Snapshot the formal installation and registration before and after. Uninstall only the owned test identity.

The helper uses a captured process handle rather than polling a reusable PID. On Windows, ordinary libuv children belong to a parent job; `unref()` alone does not preserve them after parent exit. The hidden system launcher and its protocol require a real parent-exit test. NSIS PowerShell must not compile .NET code from a directory containing the native plugin `System.dll`; use an empty temporary working directory or explicit trusted .NET references.

The older download tools still provide single-range `206` logging, sha512/blockmap validation, byte-for-byte checks and full-download fallback scenarios. However, `build.sh` still produces `Qonsona.exe`; do not install its output when the formal application is running or registered. First adapt the executable and complete test identity in a separate checkout, then verify ownership before using its installation steps. The historical download results above do not replace the current save-handoff and installer-safety requirements. Cleanup must target owned test files, services and processes only; never terminate the formal application to make a test proceed.
