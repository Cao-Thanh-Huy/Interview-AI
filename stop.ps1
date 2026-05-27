# stop.ps1 - Stop backend + frontend (Windows PowerShell)
$ROOT     = Split-Path -Parent $MyInvocation.MyCommand.Path
$PID_FILE = Join-Path $ROOT ".pids"

if (-not (Test-Path $PID_FILE)) {
    Write-Host "Nothing to stop (.pids not found)." -ForegroundColor Gray
    exit 0
}

# Parse .pids — each line may be "wrapperPid:nodePid" or just "pid"
function Get-AllPids([string]$record) {
    return $record.Split(':') | Where-Object { $_ -match "^\d+$" } | ForEach-Object { [int]$_ }
}

$lines = Get-Content $PID_FILE
$backendPids  = Get-AllPids $lines[0]
$frontendPids = Get-AllPids $lines[1]

Write-Host ""
Write-Host "Stopping Interview Copilot..." -ForegroundColor Yellow

foreach ($entry in @(@{Ids=$backendPids; Name="Backend"}, @{Ids=$frontendPids; Name="Frontend"})) {
    $killed = $false
    foreach ($id in $entry.Ids) {
        $proc = Get-Process -Id $id -ErrorAction SilentlyContinue
        if ($proc) {
            taskkill /F /T /PID $id 2>&1 | Out-Null
            if (-not $killed) {
                Write-Host "  [OK] $($entry.Name) stopped (PID $id)" -ForegroundColor Green
                $killed = $true
            }
        }
    }
    if (-not $killed) {
        Write-Host "  [--] $($entry.Name) already stopped" -ForegroundColor Gray
    }
}

Remove-Item $PID_FILE -Force
Write-Host ""