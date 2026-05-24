# start.ps1 - Start backend + frontend (Windows PowerShell)
$ErrorActionPreference = "Stop"
$ROOT     = Split-Path -Parent $MyInvocation.MyCommand.Path
$PID_FILE = Join-Path $ROOT ".pids"

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
        taskkill /F /T /PID ([int]$id) 2>&1 | Out-Null
    }
    Remove-Item $PID_FILE -Force
}

Write-Host ""
Write-Host "Starting Interview Copilot..." -ForegroundColor Cyan
Write-Host ""

$backendRoot  = Join-Path $ROOT "backend"
$frontendRoot = Join-Path $ROOT "frontend"

# Start backend in a new PowerShell window
# NODE_OPTIONS=--use-system-ca trusts the OS certificate store (needed behind corporate proxies)
$backendCmd  = "`$env:NODE_OPTIONS='--use-system-ca'; Set-Location '$backendRoot'; npm run dev"
$backendProc = Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoExit", "-Command", $backendCmd `
    -PassThru

Write-Host "  [Backend]  PID $($backendProc.Id)  ->  http://localhost:3001" -ForegroundColor Green

Start-Sleep -Milliseconds 500

# Start frontend in a new PowerShell window
$frontendCmd  = "`$env:NODE_OPTIONS='--use-system-ca'; Set-Location '$frontendRoot'; npm run dev"
$frontendProc = Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoExit", "-Command", $frontendCmd `
    -PassThru

Write-Host "  [Frontend] PID $($frontendProc.Id)  ->  http://localhost:5173" -ForegroundColor Green

# Persist PIDs for stop.ps1
@($backendProc.Id, $frontendProc.Id) | Set-Content $PID_FILE

Write-Host ""
Write-Host "  Two windows opened - backend + frontend running." -ForegroundColor Gray
Write-Host "  Run .\stop.ps1 to stop both." -ForegroundColor Gray
Write-Host ""
