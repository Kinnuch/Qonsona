# Preflight runs before the new installer invokes the registered old uninstaller.
# It also replaces the default process killer in the newly generated uninstaller.
!include "TextFunc.nsh"
!macro customCheckAppRunning
  Var /GLOBAL qonPreflightHandle
  Var /GLOBAL qonPreflightExit
  Var /GLOBAL qonPreflightResult
  Var /GLOBAL qonPreflightLog
  Var /GLOBAL qonPreflightMessage
  Var /GLOBAL qonPreflightOldUser
  Var /GLOBAL qonPreflightOldAll
  Var /GLOBAL qonPreflightUninstallUser
  Var /GLOBAL qonPreflightUninstallAll
  Var /GLOBAL qonPreflightCallerPid

  InitPluginsDir
  SetOutPath "$PLUGINSDIR"
  File /oname=qonsona-install-preflight.ps1 "${BUILD_RESOURCES_DIR}\install-preflight.ps1"
  # C# must not resolve the NSIS native System.dll as the managed System.dll reference.
  CreateDirectory "$PLUGINSDIR\qonsona-preflight-work"
  SetOutPath "$PLUGINSDIR\qonsona-preflight-work"

  qon_preflight_retry:
    StrCpy $qonPreflightLog "$TEMP\Qonsona-install-preflight-launch.log"
    ClearErrors
    System::Call 'kernel32::GetCurrentProcessId() i .s'
    Pop $qonPreflightCallerPid
    ReadRegStr $qonPreflightOldUser HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
    ReadRegStr $qonPreflightOldAll HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation
    ReadRegStr $qonPreflightUninstallUser HKCU "${UNINSTALL_REGISTRY_KEY}" UninstallString
    ReadRegStr $qonPreflightUninstallAll HKLM "${UNINSTALL_REGISTRY_KEY}" UninstallString
    ClearErrors
    # UTF-16 lines transport paths as data; no installation path is interpolated into code.
    FileOpen $qonPreflightHandle "$PLUGINSDIR\qonsona-install-request.txt" w
    IfErrors qon_preflight_launch_failed
    FileWriteUTF16LE $qonPreflightHandle "$INSTDIR$\r$\n${APP_EXECUTABLE_FILENAME}$\r$\n${UNINSTALL_FILENAME}$\r$\n$qonPreflightOldUser$\r$\n$qonPreflightOldAll$\r$\n$qonPreflightUninstallUser$\r$\n$qonPreflightUninstallAll$\r$\n"
    !ifdef BUILD_UNINSTALLER
      FileWriteUTF16LE $qonPreflightHandle "uninstaller$\r$\n"
    !else
      FileWriteUTF16LE $qonPreflightHandle "installer$\r$\n"
    !endif
    FileWriteUTF16LE $qonPreflightHandle "$qonPreflightCallerPid$\r$\n"
    # The old updater launches NSIS before finishing its normal save-and-exit path.
    # Only that silent update handoff may wait for the registered old executable.
    !ifdef BUILD_UNINSTALLER
      FileWriteUTF16LE $qonPreflightHandle "reject$\r$\n"
    !else
      ${If} ${Silent}
      ${AndIf} ${isUpdated}
        FileWriteUTF16LE $qonPreflightHandle "wait-updated$\r$\n"
      ${Else}
        FileWriteUTF16LE $qonPreflightHandle "reject$\r$\n"
      ${EndIf}
    !endif
    FileClose $qonPreflightHandle
    IfErrors qon_preflight_launch_failed
    Delete "$PLUGINSDIR\qonsona-install-result.txt"
    ClearErrors
    nsExec::Exec /TIMEOUT=45000 '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "$PLUGINSDIR\qonsona-install-preflight.ps1" -RequestPath "$PLUGINSDIR\qonsona-install-request.txt" -ResultPath "$PLUGINSDIR\qonsona-install-result.txt"'
    Pop $qonPreflightExit
    FileOpen $qonPreflightHandle "$PLUGINSDIR\qonsona-install-result.txt" r
    IfErrors qon_preflight_launch_failed
    # The result includes a UTF-16 BOM; read the numeric status and diagnostic path.
    FileSeek $qonPreflightHandle 2 SET
    FileReadUTF16LE $qonPreflightHandle $qonPreflightResult
    FileReadUTF16LE $qonPreflightHandle $qonPreflightLog
    FileClose $qonPreflightHandle
    ${TrimNewLines} $qonPreflightResult $qonPreflightResult
    ${TrimNewLines} $qonPreflightLog $qonPreflightLog
    ${If} $qonPreflightExit == "0"
    ${AndIf} $qonPreflightResult == "0"
      ClearErrors
      Goto qon_preflight_done
    ${EndIf}
    ${If} $qonPreflightExit == "10"
    ${OrIf} $qonPreflightExit == "12"
      Goto qon_preflight_blocked
    ${EndIf}

  qon_preflight_launch_failed:
    StrCpy $qonPreflightExit "20"
    DetailPrint "Installation preflight could not complete safely. Diagnostic: $qonPreflightLog"
    ClearErrors
    FileOpen $qonPreflightHandle "$TEMP\Qonsona-install-preflight-launch.log" a
    ${IfNot} ${Errors}
      FileWrite $qonPreflightHandle "${PRODUCT_NAME} ${VERSION}: preflight launch/result failed; installation was not started.$\r$\n"
      FileClose $qonPreflightHandle
    ${EndIf}
    ${If} $LANGUAGE == 2052
    ${OrIf} $LANGUAGE == 1028
      StrCpy $qonPreflightMessage "暂时无法安全检查安装目录。请先正常退出所有 ${PRODUCT_NAME} 窗口，再点击「重试」。取消会保留当前安装和学习数据。$\r$\n$\r$\n诊断日志：$qonPreflightLog"
    ${Else}
      StrCpy $qonPreflightMessage "The installation directory could not be checked safely. Please exit all ${PRODUCT_NAME} windows normally, then choose Retry. Cancel preserves the current installation and learning data.$\r$\n$\r$\nDiagnostic log: $qonPreflightLog"
    ${EndIf}
    Goto qon_preflight_decide

  qon_preflight_blocked:
    DetailPrint "Installation files or another application copy are still in use. Diagnostic: $qonPreflightLog"
    ${If} $LANGUAGE == 2052
    ${OrIf} $LANGUAGE == 1028
      StrCpy $qonPreflightMessage "安装文件仍在使用中、没有权限，或另一目录中的同名程序仍在运行。请先正常退出所有 ${PRODUCT_NAME} 窗口，等待保存完成，再点击「重试」。安装程序不会强制关闭应用。$\r$\n$\r$\n取消会保留当前安装和学习数据。诊断日志：$qonPreflightLog"
    ${Else}
      StrCpy $qonPreflightMessage "Installation files are still in use or inaccessible, or another copy is running from a different directory. Please exit all ${PRODUCT_NAME} windows normally, wait for saving to finish, then choose Retry. The installer will not force applications to close.$\r$\n$\r$\nCancel preserves the current installation and learning data. Diagnostic log: $qonPreflightLog"
    ${EndIf}

  qon_preflight_decide:
    ${IfNot} ${Silent}
      MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$qonPreflightMessage" IDRETRY qon_preflight_retry
    ${EndIf}
    SetErrorLevel $qonPreflightExit
    Quit

  qon_preflight_done:
!macroend
