param(
  [Parameter(Mandatory = $true)][string]$RequestPath,
  [Parameter(Mandatory = $true)][string]$ResultPath
)

# Only metadata and non-mutating DELETE-access handles are inspected. No learning file is read.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$code = 20
$stage = 'request'
$checkedFiles = 0
$maximumWaitMs = 20000
$timer = [Diagnostics.Stopwatch]::StartNew()
$logPath = Join-Path ([IO.Path]::GetTempPath()) ('Qonsona-install-' + [guid]::NewGuid().ToString('N') + '.log')
$report = [ordered]@{
  schema = 1
  checkedAt = [DateTime]::UtcNow.ToString('o')
  code = 20
  stage = 'request'
  directories = @()
  processes = @()
  files = @()
  checkedFiles = 0
  waitedMs = 0
}

function Normalize-InstallDirectory([string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value) -or -not [IO.Path]::IsPathRooted($Value)) {
    throw [ArgumentException]::new('Absolute installation directory required')
  }
  if ($Value.IndexOfAny([char[]]"`r`n`0`"<>|*?") -ge 0) {
    throw [ArgumentException]::new('Invalid installation directory')
  }
  $full = [IO.Path]::GetFullPath($Value).TrimEnd([char[]]'\/')
  $root = [IO.Path]::GetPathRoot($full).TrimEnd([char[]]'\/')
  if ($full -eq $root -or $full.Length -le $root.Length) {
    throw [ArgumentException]::new('A drive or share root is not an installation directory')
  }
  foreach ($segment in $full.Substring($root.Length).Split([char[]]'\/')) {
    if ($segment.EndsWith('.') -or $segment.EndsWith(' ')) {
      throw [ArgumentException]::new('Ambiguous Windows path')
    }
  }
  return $full
}

function Test-WithinDirectory([string]$File, [string]$Directory) {
  $full = [IO.Path]::GetFullPath($File)
  return $full.StartsWith($Directory + '\', [StringComparison]::OrdinalIgnoreCase)
}

function Get-Win32FilePath([string]$Value) {
  # The native API does not inherit .NET's long-path support. Keep logs in the original form.
  $separator = [string][char]92
  $extendedPrefix = $separator + $separator + '?' + $separator
  if ($Value.StartsWith($extendedPrefix, [StringComparison]::Ordinal)) { return $Value }
  if ($Value.StartsWith($separator + $separator, [StringComparison]::Ordinal)) {
    return $extendedPrefix + 'UNC' + $separator + $Value.Substring(2)
  }
  return $extendedPrefix + $Value
}

function Assert-TimeBudget {
  if ($timer.ElapsedMilliseconds -gt 30000) {
    throw [TimeoutException]::new('Installation inspection exceeded its time budget')
  }
}

function Get-BlockingProcesses {
  Assert-TimeBudget
  # Bound a repeated CIM query by the remaining inspection budget.
  $querySeconds = [int][Math]::Max(1, [Math]::Min(10, [Math]::Floor((30000 - $timer.ElapsedMilliseconds) / 1000)))
  # CIM reads executable paths across 32/64-bit boundaries; MainModule cannot do that reliably.
  $processes = @(Get-CimInstance -ClassName Win32_Process -OperationTimeoutSec $querySeconds -ErrorAction Stop)
  $blocked = [Collections.Generic.List[object]]::new()
  foreach ($process in $processes) {
    Assert-TimeBudget
    # In-place /_?= uninstalls legitimately inspect their own still-loaded executable.
    if ($lines[7] -eq 'uninstaller' -and [int]$process.ProcessId -eq $callerPid) { continue }
    $nameMatches = [string]::Equals([string]$process.Name, $executable, [StringComparison]::OrdinalIgnoreCase)
    $path = [string]$process.ExecutablePath
    if ([string]::IsNullOrWhiteSpace($path)) {
      if ($nameMatches) { throw [InvalidOperationException]::new('A matching executable path could not be inspected') }
      continue
    }
    $within = $false
    foreach ($directory in $directories) {
      if (Test-WithinDirectory $path $directory) { $within = $true; break }
    }
    if ($within -or $nameMatches) {
      $blocked.Add([pscustomobject]@{
        pid = [int]$process.ProcessId
        executable = [IO.Path]::GetFileName($path)
        withinInstallation = $within
        nameMatches = $nameMatches
        path = [IO.Path]::GetFullPath($path)
        createdAt = $process.CreationDate
      })
    }
  }
  Assert-TimeBudget
  return ,$blocked
}

try {
  $lines = [IO.File]::ReadAllLines($RequestPath, [Text.Encoding]::Unicode)
  if ($lines.Count -ne 10) { throw [ArgumentException]::new('Invalid inspection request') }
  $executable = $lines[1]
  $uninstaller = $lines[2]
  foreach ($name in @($executable, $uninstaller)) {
    if ([string]::IsNullOrWhiteSpace($name) -or [IO.Path]::GetFileName($name) -ne $name -or
        $name.IndexOfAny([IO.Path]::GetInvalidFileNameChars()) -ge 0 -or -not $name.EndsWith('.exe', [StringComparison]::OrdinalIgnoreCase)) {
      throw [ArgumentException]::new('Invalid executable name')
    }
  }
  if ($lines[7] -notin @('installer', 'uninstaller')) { throw [ArgumentException]::new('Invalid inspection mode') }
  if ($lines[9] -notin @('reject', 'wait-updated') -or ($lines[7] -eq 'uninstaller' -and $lines[9] -ne 'reject')) {
    throw [ArgumentException]::new('Invalid update wait mode')
  }
  $callerPid = 0
  if (-not [int]::TryParse($lines[8], [ref]$callerPid) -or $callerPid -le 0) { throw [ArgumentException]::new('Invalid caller process') }
  $directories = [Collections.Generic.List[string]]::new()
  $registeredDirectories = [Collections.Generic.List[string]]::new()
  $selected = Normalize-InstallDirectory $lines[0]
  $directories.Add($selected)
  if ($lines[7] -eq 'installer') {
    # A changed destination still uninstalls the registered old installation first.
    foreach ($index in @(3, 4)) {
      $value = $lines[$index]
      if ([string]::IsNullOrWhiteSpace($value)) {
        $command = $lines[$index + 2]
        if (-not [string]::IsNullOrWhiteSpace($command)) {
          if ($command -notmatch '^"([^"\r\n]+\.exe)"(?:\s.*)?$') {
            throw [ArgumentException]::new('Invalid registered uninstaller path')
          }
          $value = [IO.Path]::GetDirectoryName($Matches[1])
        }
      }
      if (-not [string]::IsNullOrWhiteSpace($value)) {
        $directory = Normalize-InstallDirectory $value
        if (-not ($registeredDirectories | Where-Object { [string]::Equals($_, $directory, [StringComparison]::OrdinalIgnoreCase) })) {
          $registeredDirectories.Add($directory)
        }
        if (-not ($directories | Where-Object { [string]::Equals($_, $directory, [StringComparison]::OrdinalIgnoreCase) })) {
          $directories.Add($directory)
        }
      }
    }
  }
  $report.directories = @($directories.ToArray())
  $stage = 'process-enumeration'
  $blockedProcesses = Get-BlockingProcesses
  if ($lines[9] -eq 'wait-updated' -and $blockedProcesses.Count -gt 0) {
    $allEligible = $true
    foreach ($process in $blockedProcesses) {
      # A selected destination alone does not authorize waiting: require the registered old root.
      $registeredExecutable = $false
      foreach ($directory in $registeredDirectories) {
        if ([string]::Equals($process.path, (Join-Path $directory $executable), [StringComparison]::OrdinalIgnoreCase)) {
          $registeredExecutable = $true; break
        }
      }
      if (-not $process.nameMatches -or -not $registeredExecutable) { $allEligible = $false; break }
    }
    # Reject other copies or other programs before waiting for any candidate.
    if ($allEligible) {
      $stage = 'process-wait'
      $handles = [Collections.Generic.List[Diagnostics.Process]]::new()
      $waitStarted = $timer.ElapsedMilliseconds
      try {
        foreach ($process in $blockedProcesses) {
          Assert-TimeBudget
          $candidate = $null
          try { $candidate = [Diagnostics.Process]::GetProcessById($process.pid) }
          catch [ArgumentException] { continue } # Already exited: the fresh snapshot below still checks its replacement.
          try {
            # Cache a real process handle before waiting. PID reuse cannot change this handle's target.
            $null = $candidate.Handle
            $createdAt = ([DateTime]$process.createdAt).ToUniversalTime()
            if ([Math]::Abs(($candidate.StartTime.ToUniversalTime() - $createdAt).TotalMilliseconds) -gt 1) {
              throw [InvalidOperationException]::new('Process identity changed during inspection')
            }
            $handles.Add($candidate)
            $candidate = $null
          } finally {
            if ($null -ne $candidate) { $candidate.Dispose() }
          }
        }
        # Reserve at least five seconds for the second snapshot and file inspection.
        $deadline = [Math]::Min($waitStarted + $maximumWaitMs, 25000)
        foreach ($candidate in $handles) {
          $remaining = [int][Math]::Max(0, $deadline - $timer.ElapsedMilliseconds)
          $null = $candidate.WaitForExit($remaining)
        }
      } finally {
        $report.waitedMs = $timer.ElapsedMilliseconds - $waitStarted
        foreach ($candidate in $handles) { $candidate.Dispose() }
      }
      $stage = 'process-enumeration'
      $blockedProcesses = Get-BlockingProcesses
    }
  }
  if ($blockedProcesses.Count -gt 0) {
    # Keep diagnostics free of arbitrary process command lines and external executable paths.
    $report.processes = @($blockedProcesses | ForEach-Object {
      [ordered]@{ pid = $_.pid; executable = $_.executable; withinInstallation = $_.withinInstallation }
    })
    $code = 10
  } else {
    $stage = 'file-access'
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class QonsonaInstallAccess {
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern IntPtr CreateFileW(string name, uint access, uint share, IntPtr security, uint creation, uint flags, IntPtr template);
  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern bool CloseHandle(IntPtr handle);
}
'@
    $blockedFiles = [Collections.Generic.List[object]]::new()
    foreach ($directory in $directories) {
      Assert-TimeBudget
      if (-not [IO.Directory]::Exists($directory)) {
        # Exists also returns false on errors. GetAttributes distinguishes genuinely absent paths.
        try {
          $attributes = [IO.File]::GetAttributes($directory)
          throw [IOException]::new('Installation path is not a directory')
        } catch [IO.FileNotFoundException] { continue }
        catch [IO.DirectoryNotFoundException] { continue }
      }
      $rootInfo = [IO.DirectoryInfo]::new($directory)
      if (($rootInfo.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw [IOException]::new('Linked installation directories are not supported by inspection')
      }
      $queue = [Collections.Generic.Queue[IO.DirectoryInfo]]::new()
      $queue.Enqueue($rootInfo)
      while ($queue.Count -gt 0) {
        Assert-TimeBudget
        foreach ($entry in $queue.Dequeue().GetFileSystemInfos()) {
          Assert-TimeBudget
          if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw [IOException]::new('Linked installation entries cannot be inspected safely')
          }
          if ($entry -is [IO.DirectoryInfo]) { $queue.Enqueue($entry); continue }
          $checkedFiles++
          if ($checkedFiles -gt 50000) { throw [IOException]::new('Installation inspection entry limit exceeded') }
          if ($lines[7] -eq 'uninstaller' -and [string]::Equals($entry.FullName, (Join-Path $selected $uninstaller), [StringComparison]::OrdinalIgnoreCase)) { continue }
          # DELETE access tests the right needed for Rename; sharing all rights changes no files.
          $handle = [QonsonaInstallAccess]::CreateFileW((Get-Win32FilePath $entry.FullName), 0x10000, 7, [IntPtr]::Zero, 3, 0x80, [IntPtr]::Zero)
          if ($handle -eq [IntPtr]::new(-1)) {
            $nativeError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
            if ($blockedFiles.Count -lt 8) {
              $blockedFiles.Add([ordered]@{
                file = $entry.FullName.Substring($directory.Length + 1)
                nativeError = $nativeError
              })
            }
          } else {
            if (-not [QonsonaInstallAccess]::CloseHandle($handle)) {
              throw [IOException]::new('Inspection handle could not be closed')
            }
          }
        }
      }
    }
    $report.files = @($blockedFiles.ToArray())
    $code = if ($blockedFiles.Count -gt 0) { 12 } else { 0 }
  }
} catch {
  # Record types/stages rather than arbitrary exception text or process command lines.
  $report.failureType = $_.Exception.GetType().FullName
  $report.failureId = $_.FullyQualifiedErrorId
  $code = 20
} finally {
  $report.code = $code
  $report.stage = $stage
  $report.checkedFiles = $checkedFiles
  $report.elapsedMs = $timer.ElapsedMilliseconds
  try {
    [IO.File]::WriteAllText($logPath, ($report | ConvertTo-Json -Depth 5), [Text.UTF8Encoding]::new($false))
    [IO.File]::WriteAllText($ResultPath, ($code.ToString() + "`r`n" + $logPath + "`r`n"), [Text.UnicodeEncoding]::new($false, $true))
  } catch { $code = 20 }
}
exit $code
