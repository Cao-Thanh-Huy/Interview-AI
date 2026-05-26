# start.ps1 - Start backend + frontend (Windows PowerShell)
# Usage: .\start.ps1           -> local only (localhost)
#        .\start.ps1 --share   -> expose on LAN so other devices can connect
param([switch]$Share)
$ErrorActionPreference = "Stop"
$ROOT     = Split-Path -Parent $MyInvocation.MyCommand.Path
$PID_FILE = Join-Path $ROOT ".pids"

# Self-healing: Detect if Node.js/npm is missing from PATH and locate WinGet or standard installations
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    # Check 1: WinGet default packages directory
    $wingetNodeDir = Get-ChildItem -Path "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Filter "node-*" -Recurse -ErrorAction SilentlyContinue | 
        Where-Object { $_.PSIsContainer -and (Test-Path (Join-Path $_.FullName "npm.cmd")) } |
        Select-Object -First 1
    
    if ($wingetNodeDir) {
        $env:PATH = "$($wingetNodeDir.FullName);$env:PATH"
        Write-Host "Self-healed: Prepend Node.js WinGet directory to PATH: $($wingetNodeDir.FullName)" -ForegroundColor Green
    } elseif (Test-Path "C:\Program Files\nodejs") {
        # Check 2: Standard Node directory
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
    # Support both newline-separated (ps1 format) and space-separated (bash format)
    $rawPids = (Get-Content $PID_FILE) -join " " -split "\s+" | Where-Object { $_ -match "^\d+$" }
    foreach ($id in $rawPids) {
        if ($id -and (Get-Process -Id ([int]$id) -ErrorAction SilentlyContinue)) {
            try {
                taskkill /F /T /PID ([int]$id) 2>&1 | Out-Null
            } catch {}
        }
    }
    Remove-Item $PID_FILE -Force
}

# Dynamically detect active package manager (pnpm, yarn, or npm)
$pkgManager = "npm"
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    $pkgManager = "pnpm"
} elseif (Get-Command yarn -ErrorAction SilentlyContinue) {
    $pkgManager = "yarn"
}

# Resolve the absolute path of the package manager to bypass child shell PATH limitations
$pkgPath = $pkgManager
try {
    $paths = where.exe $pkgManager 2>$null
    if ($paths) {
        $pkgPath = $paths[0].Trim()
    } else {
        $resolvedCmd = Get-Command $pkgManager -ErrorAction SilentlyContinue
        if ($resolvedCmd) {
            if ($resolvedCmd.Path) {
                $pkgPath = $resolvedCmd.Path
            } elseif ($resolvedCmd.Definition) {
                $pkgPath = $resolvedCmd.Definition
            } elseif ($resolvedCmd.Source) {
                $pkgPath = $resolvedCmd.Source
            }
        }
    }
} catch {
    $resolvedCmd = Get-Command $pkgManager -ErrorAction SilentlyContinue
    if ($resolvedCmd) {
        if ($resolvedCmd.Path) {
            $pkgPath = $resolvedCmd.Path
        } elseif ($resolvedCmd.Definition) {
            $pkgPath = $resolvedCmd.Definition
        }
    }
}

Write-Host "Detected package manager: $pkgManager (Executable: $pkgPath)" -ForegroundColor Gray
Write-Host ""
Write-Host "Starting Interview Copilot..." -ForegroundColor Cyan
Write-Host ""

$backendRoot  = Join-Path $ROOT "backend"
$frontendRoot = Join-Path $ROOT "frontend"

# --- Share mode: expose on LAN ---
$shareMode = $Share.IsPresent
$lanIp     = $null
if ($shareMode) {
    # Detect real LAN IP — exclude virtual adapters (WSL, Hyper-V vEthernet, Docker, VMware host-only)
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
        Write-Host "  Other devices can use: https://$lanIp`:5173" -ForegroundColor Cyan
        Write-Host ""
        # Open Windows Firewall for ports 5173 (frontend) and 3001 (backend)
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

# Run backend + frontend: invoke node.exe directly — skips npm → cmd.exe chain, no CMD windows
# stop.ps1 uses "taskkill /T /PID" so killing the parent PS PID also kills node children
$env:NODE_OPTIONS = '--use-system-ca'

function Start-NodeHidden {
    param([string]$WorkDir, [string]$NodeBin, [string]$NodeArgs, [string]$LogFile, [hashtable]$ExtraEnv = @{})
    # Encode the PS command as UTF-16LE base64 (-EncodedCommand) to avoid all quoting issues
    $envLines = ($ExtraEnv.GetEnumerator() | ForEach-Object { "`$env:$($_.Key)='$($_.Value)'" }) -join '; '
    if ($envLines) { $envLines += '; ' }
    $psCmd   = "${envLines}`$env:NODE_OPTIONS='--use-system-ca'; node `"$NodeBin`" $NodeArgs *>> `"$LogFile`""
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($psCmd))

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName               = "powershell.exe"
    $psi.Arguments              = "-NoProfile -NonInteractive -EncodedCommand $encoded"
    $psi.WorkingDirectory       = $WorkDir
    $psi.UseShellExecute        = $false
    $psi.CreateNoWindow         = $true
    $psi.RedirectStandardOutput = $true   # pipe must exist so grandchildren don't allocate a new console
    $psi.RedirectStandardError  = $true

    $p = New-Object System.Diagnostics.Process
    $p.StartInfo = $psi
    $null = $p.Start()
    $null = $p.StandardOutput.ReadToEndAsync()  # drain async (pipe stays empty; inner PS writes to file)
    $null = $p.StandardError.ReadToEndAsync()
    return $p
}

$tsxCli  = "$backendRoot\node_modules\tsx\dist\cli.mjs"
$viteBin = "$frontendRoot\node_modules\vite\bin\vite.js"

$beEnv = if ($shareMode -and $lanIp) { @{ SHARE_HOST = $lanIp } } else { @{} }
$backendProc = Start-NodeHidden `
    -WorkDir  $backendRoot `
    -NodeBin  $tsxCli `
    -NodeArgs "watch src/index.ts" `
    -LogFile  "$ROOT\backend.log" `
    -ExtraEnv $beEnv
Write-Host "  [Backend]  PID $($backendProc.Id)  ->  http://localhost:3001" -ForegroundColor Green
Write-Host "             Logs: $ROOT\backend.log" -ForegroundColor DarkGray

Start-Sleep -Milliseconds 800

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

# Persist PIDs for stop.ps1 (taskkill /F /T kills entire tree incl. node.exe children)
@($backendProc.Id, $frontendProc.Id) | Set-Content $PID_FILE

Write-Host ""
Write-Host "  Both running in background (no extra windows)." -ForegroundColor Gray
Write-Host "  Run .\stop.ps1 to stop both." -ForegroundColor Gray
if ($shareMode -and $lanIp) {
    Write-Host ""
    Write-Host "  Share link for other LAN devices:" -ForegroundColor Cyan
    Write-Host "  https://$lanIp`:5173" -ForegroundColor White
}
Write-Host ""

# Wait a moment then open browser automatically
Start-Sleep -Seconds 2
$openUrl = if ($shareMode -and $lanIp) { "https://$lanIp`:5173" } else { "http://localhost:5173" }
Start-Process $openUrl
