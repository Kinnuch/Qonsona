import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { createServer, type Socket } from 'node:net'
import { tmpdir } from 'node:os'
import { isAbsolute, join } from 'node:path'

// No path, argument or user text is interpolated into PowerShell source. Payloads travel over a pipe.
// Opening Handle before acknowledging readiness pins this process identity against PID reuse.
export const WINDOWS_HANDOFF_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$parent = $null
$cfg = $null
function Report([string] $phase, [string] $errorText = '') {
  $report = @{ phase = $phase; token = $cfg.token; at = [DateTime]::UtcNow.ToString('o') }
  if ($errorText) { $report.error = $errorText }
  $json = ConvertTo-Json -Compress $report
  if ($cfg.log) { [IO.File]::WriteAllText($cfg.log, $json, (New-Object Text.UTF8Encoding($false))) }
  # Once the parent is gone its protocol pipes are closed; status still reaches the disk log.
  if (!$parent -or !$parent.HasExited) {
    $writer.WriteLine($json)
  }
}
try {
  $line = $reader.ReadLine()
  if (!$line -or $line.Length -gt 5000) { throw 'Invalid installer handoff payload.' }
  $cfg = ConvertFrom-Json $line
  if ($cfg.token -notmatch '^[0-9a-f-]{36}$' -or [int]$cfg.parent -le 0) { throw 'Invalid installer handoff identity.' }
  if (![IO.Path]::IsPathRooted($cfg.installer) -or ![IO.File]::Exists($cfg.installer) -or [IO.Path]::GetExtension($cfg.installer) -ne '.exe') { throw 'The downloaded installer is unavailable.' }
  if (![IO.Path]::IsPathRooted($cfg.log)) { throw 'Invalid handoff log path.' }
  $parent = [Diagnostics.Process]::GetProcessById([int]$cfg.parent)
  $handle = $parent.Handle
  if ($parent.HasExited) { throw 'The application exited before the handoff was ready.' }
  $waitSource = @'
using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
public static class QonsonaUpdateWait {
  public static bool ExitOrCancel(Process parent, TextReader input, int timeout) {
    Task<bool> exited = Task.Factory.StartNew(() => parent.WaitForExit(timeout));
    // Console.In is a synchronized reader whose ReadLineAsync can itself block on .NET Framework.
    Task<string> command = Task.Factory.StartNew(() => input.ReadLine());
    Task.WaitAny(exited, command);
    // Pipe EOF is expected during normal app shutdown; only an explicit message cancels.
    if (command.IsCompleted && command.Result != null) return false;
    return exited.GetAwaiter().GetResult();
  }
}
'@
  Add-Type -TypeDefinition $waitSource -ReferencedAssemblies @([Diagnostics.Process].Assembly.Location, [Threading.Tasks.Task].Assembly.Location)
  Report 'ready'
  if ($reader.ReadLine() -ne ('commit:' + $cfg.token)) { throw 'The installer handoff was canceled.' }
  Report 'armed'
  if (![QonsonaUpdateWait]::ExitOrCancel($parent, $reader, 120000)) { throw 'The application did not exit, or the update was canceled. The installer was not started.' }
  Report 'parent-exited'
  $arguments = @('--updated')
  if ($cfg.installed -eq $true) { $arguments = @('--updated', '/S', '--force-run') }
  $start = @{ FilePath = $cfg.installer; ArgumentList = $arguments; WorkingDirectory = [IO.Path]::GetTempPath(); PassThru = $true }
  if ($cfg.installed -eq $true) { $start.WindowStyle = 'Hidden' }
  $installer = Start-Process @start
  if (!$installer) { throw 'The installer could not be started.' }
  Report 'installer-started'
} catch {
  try { Report 'failed' $_.Exception.Message } catch {}
  exit 1
} finally {
  if ($parent) { $parent.Dispose() }
}
`

export interface InstallerHandoff {
  commit(): Promise<void>
  cancel(): void
}

/** The helper is a system executable, outside the application being replaced. */
export async function prepareWindowsInstaller(
  installer: string,
  installed: boolean,
  log: string,
  onFailure: (error: Error) => void,
  readyTimeoutMs = 15_000
): Promise<InstallerHandoff> {
  if (!isAbsolute(installer) || !existsSync(installer) || !/\.exe$/i.test(installer))
    return Promise.reject(new Error('The downloaded installer is unavailable. Download it again.'))
  const root = process.env.SystemRoot ?? process.env.WINDIR ?? 'C:\\Windows'
  if (!isAbsolute(root) || /["^&|<>%!\r\n]/.test(root))
    return Promise.reject(new Error('The Windows system directory is unavailable.'))
  const powershell = join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  const token = randomUUID()
  const pipeName = `qonsona-update-${process.pid}-${token}`
  return new Promise((resolve, reject) => {
    // libuv puts ordinary Windows children in a kill-on-close Job. A detached cmd escapes
    // that Job, while allowing PowerShell to initialize normally (direct detached PowerShell
    // exits without executing). This fixed command contains only a validated system path
    // and base64 of a short static loader (cmd has an 8191-character limit). Detached
    // processes have no usable console streams, so the protocol uses a random named pipe.
    const loader = `$ProgressPreference='SilentlyContinue'; $pipe=New-Object IO.Pipes.NamedPipeClientStream('.', $env:QONSONA_UPDATE_PIPE, [IO.Pipes.PipeDirection]::InOut); $pipe.Connect(10000); $reader=New-Object IO.StreamReader($pipe,(New-Object Text.UTF8Encoding($false))); $writer=New-Object IO.StreamWriter($pipe,(New-Object Text.UTF8Encoding($false))); $writer.AutoFlush=$true; try { $source=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($reader.ReadLine())); & ([scriptblock]::Create($source)) } finally { $pipe.Dispose() }`
    const command = `"${powershell}" -NoLogo -NoProfile -NonInteractive -EncodedCommand ${Buffer.from(loader, 'utf16le').toString('base64')}`
    let child: ReturnType<typeof spawn> | null = null
    let socket: Socket | null = null
    const server = createServer()
    let phase: 'starting' | 'ready' | 'committing' | 'armed' | 'canceled' | 'failed' = 'starting'
    let buffer = ''
    let commitResolve: (() => void) | null = null
    let commitReject: ((error: Error) => void) | null = null
    let timer = setTimeout(
      () =>
        fail(new Error('The update helper did not become ready. The application remains open.')),
      readyTimeoutMs
    )
    const detach = (): void => {
      child?.unref()
      server.unref()
      socket?.unref()
    }
    const cancel = (): void => {
      if (phase === 'canceled' || phase === 'failed') return
      phase = 'canceled'
      clearTimeout(timer)
      socket?.end(`cancel:${token}\n`)
      if (server.listening) server.close()
      detach()
    }
    const fail = (error: Error): void => {
      if (phase === 'canceled' || phase === 'failed') return
      const previous = phase
      cancel()
      phase = 'failed'
      reject(error)
      commitReject?.(error)
      if (previous !== 'starting') onFailure(error)
    }
    const onData = (chunk: Buffer): void => {
      if (phase === 'canceled' || phase === 'failed') return
      buffer += chunk.toString('utf8')
      if (buffer.length > 16_384)
        return fail(new Error('The update helper returned an invalid response.'))
      let end: number
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end).trim()
        buffer = buffer.slice(end + 1)
        try {
          const report = JSON.parse(line) as { token?: string; phase?: string; error?: string }
          if (report.token !== token) continue
          if (report.phase === 'failed')
            return fail(new Error(report.error ?? 'The update helper failed.'))
          if (report.phase === 'ready' && phase === 'starting') {
            phase = 'ready'
            clearTimeout(timer)
            resolve({
              cancel,
              commit: () => {
                if (phase !== 'ready')
                  return Promise.reject(new Error('The update handoff is no longer ready.'))
                phase = 'committing'
                return new Promise<void>((yes, no) => {
                  commitResolve = yes
                  commitReject = no
                  timer = setTimeout(
                    () => fail(new Error('The update helper did not acknowledge the handoff.')),
                    readyTimeoutMs
                  )
                  socket?.write(`commit:${token}\n`)
                })
              }
            })
          } else if (report.phase === 'armed' && phase === 'committing') {
            phase = 'armed'
            clearTimeout(timer)
            detach()
            commitResolve?.()
          }
        } catch {
          // PowerShell startup warnings are not an acknowledgment.
        }
      }
    }
    server.once('error', (error) => fail(error))
    server.on('connection', (connection) => {
      if (socket || phase !== 'starting') {
        connection.destroy()
        return
      }
      socket = connection
      server.close()
      connection.on('error', (error) => fail(error))
      connection.on('data', onData)
      connection.write(
        Buffer.from(WINDOWS_HANDOFF_SCRIPT, 'utf8').toString('base64') +
          '\n' +
          JSON.stringify({ token, parent: process.pid, installer, installed, log }) +
          '\n'
      )
    })
    server.listen(`\\\\.\\pipe\\${pipeName}`, () => {
      if (phase !== 'starting') {
        server.close()
        return
      }
      try {
        child = spawn(join(root, 'System32', 'cmd.exe'), ['/d', '/s', '/c', `"${command}"`], {
          cwd: tmpdir(),
          detached: true,
          windowsHide: true,
          windowsVerbatimArguments: true,
          stdio: 'ignore',
          env: { ...process.env, QONSONA_UPDATE_PIPE: pipeName }
        })
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)))
        return
      }
      child.once('error', (error) => fail(error))
      child.once('exit', (code) => {
        if (phase !== 'canceled' && phase !== 'failed')
          fail(
            new Error(
              `The update helper exited before completing the update (${code ?? 'unknown'}).`
            )
          )
        socket?.destroy()
      })
    })
  })
}
