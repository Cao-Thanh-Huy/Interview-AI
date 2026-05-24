# stop.ps1 - Stop backend + frontend (Windows PowerShell)
$ROOT     = Split-Path -Parent $MyInvocation.MyCommand.Path
$PID_FILE = Join-Path $ROOT ".pids"

if (-not (Test-Path $PID_FILE)) {
    Write-Host "Nothing to stop (.pids not found)." -ForegroundColor Gray
    exit 0
}

$ids        = Get-Content $PID_FILE
$backendId  = [int]$ids[0]
$frontendId = [int]$ids[1]

Write-Host ""
Write-Host "Stopping Interview Copilot..." -ForegroundColor Yellow

foreach ($entry in @(@{Id=$backendId; Name="Backend"}, @{Id=$frontendId; Name="Frontend"})) {
    $proc = Get-Process -Id $entry.Id -ErrorAction SilentlyContinue
    if ($proc) {
        taskkill /F /T /PID $entry.Id 2>&1 | Out-Null
        Write-Host "  [OK] $($entry.Name) stopped (PID $($entry.Id))" -ForegroundColor Green
    } else {
        Write-Host "  [--] $($entry.Name) already stopped" -ForegroundColor Gray
    }
}

Remove-Item $PID_FILE -Force
Write-Host ""