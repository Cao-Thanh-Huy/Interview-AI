# start.ps1 - Start backend + frontend (Windows PowerShell)
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

# Check backend/.env
if (-not (Test-Path (Join-Path $ROOT "backend\.env"))) {
    Write-Host ""
    Write-Host "  WARNING: backend\.env not found." -ForegroundColor Yellow
    Write-Host "  Copy .env.example -> backend\.env and fill in your API keys:"
    Write-Host ""
    Write-Host "    Copy-Item .env.example backend\.env"
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

# Run backend + frontend as hidden background processes (no extra windows)
$env:NODE_OPTIONS = '--use-system-ca'

$backendProc = Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoProfile", "-Command", "Set-Location '$backendRoot'; & '$pkgPath' run dev *>> '$ROOT\backend.log' 2>&1" `
    -WindowStyle Hidden -PassThru

Write-Host "  [Backend]  PID $($backendProc.Id)  ->  http://localhost:3001" -ForegroundColor Green
Write-Host "             Logs: $ROOT\backend.log" -ForegroundColor DarkGray

Start-Sleep -Milliseconds 800

$frontendProc = Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoProfile", "-Command", "Set-Location '$frontendRoot'; & '$pkgPath' run dev *>> '$ROOT\frontend.log' 2>&1" `
    -WindowStyle Hidden -PassThru

Write-Host "  [Frontend] PID $($frontendProc.Id)  ->  http://localhost:5173" -ForegroundColor Green
Write-Host "             Logs: $ROOT\frontend.log" -ForegroundColor DarkGray

# Persist PIDs for stop.ps1
@($backendProc.Id, $frontendProc.Id) | Set-Content $PID_FILE

Write-Host ""
Write-Host "  Both running in background (no extra windows)." -ForegroundColor Gray
Write-Host "  Run .\stop.ps1 to stop both." -ForegroundColor Gray
Write-Host ""

# Wait a moment then open browser automatically
Start-Sleep -Seconds 2
Start-Process "http://localhost:5173"
