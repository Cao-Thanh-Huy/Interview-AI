# start.ps1 - Start backend + frontend (Windows PowerShell)
# Usage: .\start.ps1           -> local only (localhost)
#        .\start.ps1 --share   -> expose on LAN so other devices can connect
param([switch]$Share)
$ErrorActionPreference = "Stop"
$ROOT     = Split-Path -Parent $MyInvocation.MyCommand.Path
$PID_FILE = Join-Path $ROOT ".pids"

# Self-healing: Detect if Node.js/npm is missing from PATH and locate WinGet or standard installations
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    $wingetNodeDir = Get-ChildItem -Path "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Filter "node-*" -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.PSIsContainer -and (Test-Path (Join-Path $_.FullName "npm.cmd")) } |
        Select-Object -First 1

    if ($wingetNodeDir) {
        $env:PATH = "$($wingetNodeDir.FullName);$env:PATH"
        Write-Host "Self-healed: Prepend Node.js WinGet directory to PATH: $($wingetNodeDir.FullName)" -ForegroundColor Green
    } elseif (Test-Path "C:\Program Files\nodejs") {
        $env:PATH = "C:\Program Files\nodejs;$env:PATH"
        Write-Host "Self-healed: Prepend standard Node.js directory to PATH: C:\Program Files\nodejs" -ForegroundColor Green
    }
}

# Check root .env
if (-not (Test-Path (Join-Path $ROOT ".env"))) {
    Write-Host ""
    Write-Host "  WARNING: .env not found." -ForegroundColor Yellow
    Write-Host "  Copy .env.example -> .env and fill in your API keys:"
    Write-Host ""
    Write-Host "    Copy-Item .env.example .env"
    Write-Host ""
    exit 1
}

# Kill previous session if .pids exists
if (Test-Path $PID_FILE) {
    Write-Host "WARNING: Found existing .pids - stopping previous session first..." -ForegroundColor Yellow
    $rawPids = (Get-Content $PID_FILE) -join " " -split "\s+" | Where-Object { $_ -match "^\d+$" }
    foreach ($id in $rawPids) {
        if ($id -and (Get-Process -Id ([int]$id) -ErrorAction SilentlyContinue)) {
            try { taskkill /F /T /PID ([int]$id) 2>&1 | Out-Null } catch {}
        }
    }
    Remove-Item $PID_FILE -Force
    Start-Sleep -Milliseconds 500
}

# Nuclear pre-start cleanup: kill ALL node.exe + any port holders
# This ensures clean state even after crash/zombie scenarios
foreach ($port in @(3001, 5173)) {
    $portPid = (netstat -ano 2>$null | Select-String ":$port\s" | Select-String "LISTENING" | ForEach-Object {
        ($_ -split "\s+")[-1]
    } | Select-Object -First 1)
    if ($portPid -and $portPid -match "^\d+$") {
        taskkill /F /PID ([int]$portPid) 2>&1 | Out-Null
    }
}
Start-Sleep -Milliseconds 300


# Dynamically detect active package manager (pnpm, yarn, or npm)
$pkgManager = "npm"
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    $pkgManager = "pnpm"
} elseif (Get-Command yarn -ErrorAction SilentlyContinue) {
    $pkgManager = "yarn"
}

# Resolve absolute path of npm/node
$pkgPath = $pkgManager
try {
    $paths = where.exe $pkgManager 2>$null
    if ($paths) { $pkgPath = $paths[0].Trim() }
    else {
        $resolvedCmd = Get-Command $pkgManager -ErrorAction SilentlyContinue
        if ($resolvedCmd) { $pkgPath = if ($resolvedCmd.Source) { $resolvedCmd.Source } else { $resolvedCmd.Definition } }
    }
} catch {
    $resolvedCmd = Get-Command $pkgManager -ErrorAction SilentlyContinue
    if ($resolvedCmd) { $pkgPath = if ($resolvedCmd.Source) { $resolvedCmd.Source } else { $resolvedCmd.Definition } }
}

Write-Host "Detected package manager: $pkgManager (Executable: $pkgPath)" -ForegroundColor Gray
Write-Host ""
Write-Host "Starting IntelliView..." -ForegroundColor Cyan
Write-Host ""

$backendRoot  = Join-Path $ROOT "backend"
$frontendRoot = Join-Path $ROOT "frontend"

# --- Share mode: expose on LAN ---
$shareMode = $Share.IsPresent
$lanIp     = $null
if ($shareMode) {
    $lanIp = (Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object {
            $_.IPAddress -notlike '127.*' -and
            $_.IPAddress -notlike '169.254.*' -and
            $_.InterfaceAlias -notlike '*vEthernet*' -and
            $_.InterfaceAlias -notlike '*Loopback*' -and
            $_.InterfaceAlias -notlike '*Virtual*'
        } |
        Sort-Object InterfaceIndex | Select-Object -First 1).IPAddress
    if ($lanIp) {
        Write-Host "  [Share mode] LAN IP detected: $lanIp" -ForegroundColor Cyan
        Write-Host "  Other devices can use: http://$lanIp`:5173" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  [Share mode] Configuring Windows Firewall..." -ForegroundColor Gray
        $fwRules = @(
            @{ Name = "Interview Copilot Frontend (5173)"; Port = 5173 },
            @{ Name = "Interview Copilot Backend (3001)";  Port = 3001 }
        )
        foreach ($rule in $fwRules) {
            $existing = Get-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue
            if (-not $existing) {
                New-NetFirewallRule -DisplayName $rule.Name -Direction Inbound `
                    -Protocol TCP -LocalPort $rule.Port -Action Allow -Profile Any `
                    -ErrorAction SilentlyContinue | Out-Null
                Write-Host "    + Firewall rule added for port $($rule.Port)" -ForegroundColor Gray
            } else {
                Write-Host "    = Firewall rule already exists for port $($rule.Port)" -ForegroundColor DarkGray
            }
        }
        Write-Host ""
    } else {
        Write-Host "  [Share mode] WARNING: Could not detect LAN IP." -ForegroundColor Yellow
    }
}

$env:NODE_OPTIONS = '--use-system-ca'

$tsxCli  = "$backendRoot\node_modules\tsx\dist\cli.mjs"
$viteBin = "$frontendRoot\node_modules\vite\bin\vite.js"

# ============================================================
# Spawn strategy:
#   - Inner powershell wrapper runs node and pipes output to log
#   - Wrapper stays alive as long as node is alive (no ReadToEnd drain)
#   - We save the WRAPPER PID; taskkill /F /T kills wrapper + node tree
#   - After spawning, we wait 1s then find the actual node.exe child PID
#     to also record it (belt-and-suspenders: if wrapper exits early,
#     we can still kill node directly).
# ============================================================
function Start-NodeHidden {
    param(
        [string]$WorkDir,
        [string]$NodeBin,
        [string]$NodeArgs,
        [string]$LogFile,
        [hashtable]$ExtraEnv = @{}
    )

    $envLines = ($ExtraEnv.GetEnumerator() | ForEach-Object { "`$env:$($_.Key)='$($_.Value)'" }) -join '; '
    if ($envLines) { $envLines += '; ' }

    $psCmd   = "${envLines}`$env:NODE_OPTIONS='--use-system-ca'; node `"$NodeBin`" $NodeArgs *> `"$LogFile`""
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($psCmd))

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName               = "powershell.exe"
    $psi.Arguments              = "-NoProfile -NonInteractive -EncodedCommand $encoded"
    $psi.WorkingDirectory       = $WorkDir
    $psi.UseShellExecute        = $false
    $psi.CreateNoWindow         = $true
    $psi.RedirectStandardOutput = $false
    $psi.RedirectStandardError  = $false

    $p = New-Object System.Diagnostics.Process
    $p.StartInfo = $psi
    $null = $p.Start()
    return $p
}




# --- Start Backend ---
$beEnv = if ($shareMode -and $lanIp) { @{ SHARE_HOST = $lanIp } } else { @{} }
$backendProc = Start-NodeHidden `
    -WorkDir  $backendRoot `
    -NodeBin  $tsxCli `
    -NodeArgs "src/index.ts" `
    -LogFile  "$ROOT\backend.log" `
    -ExtraEnv $beEnv

Write-Host "  [Backend]  PID $($backendProc.Id)  ->  http://localhost:3001" -ForegroundColor Green
Write-Host "             Logs: $ROOT\backend.log" -ForegroundColor DarkGray

Start-Sleep -Milliseconds 800

# --- Start Frontend ---
$viteArgs = if ($shareMode) { "--host" } else { "" }
$feEnv    = if ($shareMode) { @{ VITE_HTTPS = '1' } } else { @{} }
$frontendProc = Start-NodeHidden `
    -WorkDir  $frontendRoot `
    -NodeBin  $viteBin `
    -NodeArgs $viteArgs `
    -LogFile  "$ROOT\frontend.log" `
    -ExtraEnv $feEnv

Write-Host "  [Frontend] PID $($frontendProc.Id)  ->  http://localhost:5173" -ForegroundColor Green
Write-Host "             Logs: $ROOT\frontend.log" -ForegroundColor DarkGray

# Wait for node children to spawn, then record their real PIDs
Start-Sleep -Milliseconds 1500

# Find actual node.exe children of each wrapper
$beNodeChild = Get-CimInstance Win32_Process |
    Where-Object { $_.Name -eq "node.exe" -and $_.ParentProcessId -eq $backendProc.Id } |
    Select-Object -First 1
$beNodePid = if ($beNodeChild) { $beNodeChild.ProcessId } else { $null }

$feNodeChild = Get-CimInstance Win32_Process |
    Where-Object { $_.Name -eq "node.exe" -and $_.ParentProcessId -eq $frontendProc.Id } |
    Select-Object -First 1
$feNodePid = if ($feNodeChild) { $feNodeChild.ProcessId } else { $null }

# Save: prefer real node PID, fallback to wrapper PID
# Format: "wrapperPid:nodePid" — stop.ps1 kills both
$beRecord = if ($beNodePid) { "$($backendProc.Id):$beNodePid" } else { "$($backendProc.Id)" }
$feRecord = if ($feNodePid) { "$($frontendProc.Id):$feNodePid" } else { "$($frontendProc.Id)" }
@($beRecord, $feRecord) | Set-Content $PID_FILE

Write-Host ""
Write-Host "  Both running in background (no extra windows)." -ForegroundColor Gray
Write-Host "  Run .\stop.ps1 to stop both." -ForegroundColor Gray
if ($shareMode -and $lanIp) {
    Write-Host ""
    Write-Host "  Share link for other LAN devices:" -ForegroundColor Cyan
    Write-Host "  http://$lanIp`:5173" -ForegroundColor White
}
Write-Host ""

# Wait for backend to be ready (TCP check on :3001, up to 15s) then launch Electron
Write-Host "  Waiting for backend to start..." -ForegroundColor Gray
$backendReady = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Milliseconds 500
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect("127.0.0.1", 3001)
        $tcp.Close()
        $backendReady = $true
        break
    } catch {}
}
if ($backendReady) {
    Write-Host "  Backend ready." -ForegroundColor DarkGray
} else {
    Write-Host "  Backend not ready yet, launching Electron anyway..." -ForegroundColor Yellow
}

# Also give Vite a moment
Start-Sleep -Seconds 1

Write-Host "  Launching Electron window..." -ForegroundColor Cyan

$electronBin = Join-Path $ROOT "electron\node_modules\electron\dist\electron.exe"
$electronDir  = Join-Path $ROOT "electron"

if (Test-Path $electronBin) {
    # Clear NODE_OPTIONS — Electron's embedded Node does not support --use-system-ca
    $savedNodeOptions = $env:NODE_OPTIONS
    $env:NODE_OPTIONS  = ''
    $env:INTELLIVIEW_DEV = '1'

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName         = $electronBin
    $psi.Arguments        = "."
    $psi.WorkingDirectory = $electronDir
    $psi.UseShellExecute  = $false
    $psi.CreateNoWindow   = $false
    $eProc = New-Object System.Diagnostics.Process
    $eProc.StartInfo = $psi
    $null = $eProc.Start()

    # Restore NODE_OPTIONS for anything else in this session
    $env:NODE_OPTIONS = $savedNodeOptions

    # Add electron PID to .pids so stop.ps1 can kill it too
    Add-Content $PID_FILE $eProc.Id
    Write-Host "  [Electron]  PID $($eProc.Id)" -ForegroundColor Green
} else {
    Write-Host "  [Electron] Binary not found - opening browser fallback" -ForegroundColor Yellow
    $openUrl = if ($shareMode -and $lanIp) { "http://$lanIp`:5173" } else { "http://localhost:5173" }
    Start-Process $openUrl
}

Write-Host ""
Write-Host "  Close the IntelliView window or run .\stop.ps1 to stop everything." -ForegroundColor Gray
Write-Host ""
