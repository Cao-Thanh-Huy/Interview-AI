# stop.ps1 - Stop backend + frontend (Windows PowerShell)
$ROOT     = Split-Path -Parent $MyInvocation.MyCommand.Path
$PID_FILE = Join-Path $ROOT ".pids"

Write-Host ""
Write-Host "Stopping Interview Copilot..." -ForegroundColor Yellow

# --- 1. PID-based stop (if .pids exists) ---
if (Test-Path $PID_FILE) {
    # Parse .pids — each line may be "wrapperPid:nodePid" or just "pid"
    function Get-AllPids([string]$record) {
        return $record.Split(':') | Where-Object { $_ -match "^\d+$" } | ForEach-Object { [int]$_ }
    }

    $lines = Get-Content $PID_FILE
    $backendPids  = Get-AllPids $lines[0]
    $frontendPids = if ($lines.Count -gt 1) { Get-AllPids $lines[1] } else { @() }

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
} else {
    Write-Host "  [--] Backend already stopped" -ForegroundColor Gray
    Write-Host "  [--] Frontend already stopped" -ForegroundColor Gray
}

# --- 2. Fallback: always kill any orphaned processes still holding ports 3001 / 5173 ---
foreach ($port in @(3001, 5173)) {
    $portPid = (netstat -ano 2>$null | Select-String ":$port\s" | Select-String "LISTENING" | ForEach-Object {
        ($_ -split "\s+")[-1]
    } | Select-Object -First 1)
    if ($portPid -and $portPid -match "^\d+$") {
        $proc = Get-Process -Id ([int]$portPid) -ErrorAction SilentlyContinue
        if ($proc) {
            taskkill /F /T /PID ([int]$portPid) 2>&1 | Out-Null
            Write-Host "  [OK] Cleaned up orphaned process on port $port (PID $portPid)" -ForegroundColor DarkYellow
        }
    }
}

Write-Host ""