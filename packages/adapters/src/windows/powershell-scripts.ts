import { ActiveWindowInfo, NowPlayingInfo } from '../index';

/**
 * Windows platform commands + payload parsers.
 *
 * All three probes shell out to `powershell.exe` (via the shared
 * `CommandRunner`) which P/Invokes the Win32/WinRT surface and prints a
 * single line of JSON. Keeping the scripts as string literals makes the
 * adapter fully unit-testable on any host with a fake `CommandRunner`.
 *
 * The scripts are written for Windows PowerShell 5.1+ (present on every
 * supported Windows 10/11) and PowerShell 7 (`pwsh`). They were not executed
 * on this Linux development box — see ADR-007 for the verification story.
 */

export const POWERSHELL_EXE = 'powershell.exe';

/**
 * Foreground window → `{ "title": string, "processName": string }`.
 * Both fields are empty when no window is focused.
 */
export const ACTIVE_WINDOW_POWERSHELL = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class StaWin32 {
  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
'@
$hwnd = [StaWin32]::GetForegroundWindow()
$title = ''
$processName = ''
if ($hwnd -ne [IntPtr]::Zero) {
  $buffer = New-Object System.Text.StringBuilder 512
  [void][StaWin32]::GetWindowText($hwnd, $buffer, $buffer.Capacity)
  $title = $buffer.ToString()
  $pidValue = [uint32]0
  [void][StaWin32]::GetWindowThreadProcessId($hwnd, [ref]$pidValue)
  $proc = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
  if ($proc) { $processName = $proc.ProcessName }
}
@{ title = $title; processName = $processName } | ConvertTo-Json -Compress
`;

/**
 * Last user input → `{ "idleMs": number }` (-1 when the probe fails).
 */
export const IDLE_MILLIS_POWERSHELL = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class StaInput {
  [StructLayout(LayoutKind.Sequential)]
  public struct LastInputInfo {
    public uint cbSize;
    public uint dwTime;
  }
  [DllImport("user32.dll")]
  public static extern bool GetLastInputInfo(ref LastInputInfo plii);
  [DllImport("kernel32.dll")]
  public static extern uint GetTickCount();
}
'@
$info = New-Object StaInput+LastInputInfo
$type = $info.GetType()
$info.cbSize = [System.Runtime.InteropServices.Marshal]::SizeOf([type]::GetType($type.FullName))
$idleMs = -1
if ([StaInput]::GetLastInputInfo([ref]$info)) {
  $idleMs = [StaInput]::GetTickCount() - $info.dwTime
}
@{ idleMs = $idleMs } | ConvertTo-Json -Compress
`;

/**
 * SMTC current media session →
 * `{ "hasMedia": bool, "title", "artist", "sourceApp", "durationSeconds" }`.
 *
 * Windows.Media.Control (SMTC) is only reachable through WinRT projections;
 * PowerShell 7 and Windows PowerShell 5.1 can both consume it via the
 * WindowsRuntimeSystemExtensions.AsTask bridge below.
 */
export const NOW_PLAYING_POWERSHELL = `
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskBase = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1'
})
function Await($winRtTask, [type]$resultType) {
  $asTask = $asTaskBase.MakeGenericMethod($resultType)
  $netTask = $asTask.Invoke($null, @($winRtTask))
  $netTask.Wait(-1) | Out-Null
  $netTask.Result
}
[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media, ContentType = WindowsRuntime] | Out-Null
$managerAsync = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()
$manager = Await $managerAsync ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
$hasMedia = $false
$title = ''
$artist = ''
$sourceApp = ''
$durationSeconds = 0
if ($null -ne $manager) {
  $session = $manager.GetCurrentSession()
  if ($null -ne $session) {
    $propsAsync = $session.TryGetMediaPropertiesAsync()
    $props = Await $propsAsync ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
    if ($null -ne $props) {
      $hasMedia = $true
      $title = [string]$props.Title
      $artist = [string]$props.Artist
      $sourceApp = [string]$session.SourceAppUserModelId
      $durationSeconds = [int]$props.TotalDuration.TotalSeconds
    }
  }
}
@{ hasMedia = $hasMedia; title = $title; artist = $artist; sourceApp = $sourceApp; durationSeconds = $durationSeconds } | ConvertTo-Json -Compress
`;

/** Builds the arg vector for a `powershell.exe -Command` invocation. */
export function powershellCommandArgs(script: string): string[] {
  return ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script];
}

function parseJsonRecord(stdout: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(stdout.trim());
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

/**
 * Parses the active-window JSON. Returns `null` (no window) when parsing
 * fails or both fields are empty.
 */
export function parseActiveWindowOutput(stdout: string): ActiveWindowInfo | null {
  const record = parseJsonRecord(stdout);
  if (!record) return null;
  const title = stringField(record, 'title');
  const processName = stringField(record, 'processName');
  if (title === '' && processName === '') return null;
  return {
    title: title !== '' ? title : processName,
    processName: processName !== '' ? processName : title,
  };
}

/** Parses the idle-milliseconds JSON. Returns -1 (unknown) on any failure. */
export function parseIdleMillisOutput(stdout: string): number {
  const record = parseJsonRecord(stdout);
  if (!record) return -1;
  const idleMs = Number(record['idleMs']);
  return Number.isFinite(idleMs) ? idleMs : -1;
}

/**
 * Parses the SMTC now-playing JSON. Returns `null` when there is no media
 * session, nothing is playing, or parsing fails.
 */
export function parseNowPlayingOutput(stdout: string): NowPlayingInfo | null {
  const record = parseJsonRecord(stdout);
  if (!record) return null;
  if (record['hasMedia'] === false) return null;

  const trackTitle = stringField(record, 'title');
  if (trackTitle === '') return null;

  const durationSeconds = Number(record['durationSeconds']);
  return {
    trackTitle,
    artist: stringField(record, 'artist') || 'Unknown Artist',
    sourceApp: stringField(record, 'sourceApp') || 'unknown',
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : 0,
  };
}
