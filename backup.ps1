# backup.ps1 - Database Backup and Restore CLI for Interview Copilot
# Usage:
#   .\backup.ps1          -> Back up memory.db to backend/data/backups/
#   .\backup.ps1 -Restore -> Interactive restore from available backups

param(
    [switch]$Restore
)

$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$DB_DIR = Join-Path $ROOT "backend\data"
$DB_FILE = Join-Path $DB_DIR "memory.db"
$BACKUP_DIR = Join-Path $DB_DIR "backups"

# Ensure backup directory exists
if (-not (Test-Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $BACKUP_DIR | Out-Null
}

if ($Restore.IsPresent) {
    Write-Host ""
    Write-Host "=== DATABASE RESTORE CLI ===" -ForegroundColor Cyan
    Write-Host ""
    
    if (-not (Test-Path $BACKUP_DIR)) {
        Write-Host "ERROR: Backup directory does not exist." -ForegroundColor Red
        exit 1
    }
    
    $backups = Get-ChildItem -Path $BACKUP_DIR -Filter "*.db" | Sort-Object LastWriteTime -Descending
    
    if ($backups.Count -eq 0) {
        Write-Host "No backup files found in $BACKUP_DIR" -ForegroundColor Yellow
        exit 1
    }
    
    Write-Host "Select a backup to restore:" -ForegroundColor White
    for ($i = 0; $i -lt $backups.Count; $i++) {
        $writeTime = $backups[$i].LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
        $sizeKB = [Math]::Round($backups[$i].Length / 1KB, 2)
        Write-Host "  [$($i + 1)] $($backups[$i].Name) ($writeTime) [$sizeKB KB]" -ForegroundColor Gray
    }
    Write-Host ""
    
    $choice = Read-Host "Enter number (1-$($backups.Count)) or press Enter to cancel"
    if (-not $choice) {
        Write-Host "Restore cancelled." -ForegroundColor Yellow
        exit 0
    }
    
    if ($choice -match "^\d+$" -and [int]$choice -ge 1 -and [int]$choice -le $backups.Count) {
        $selectedBackup = $backups[[int]$choice - 1]
        Write-Host ""
        Write-Host "WARNING: This will overwrite your current active database!" -ForegroundColor Yellow
        $confirm = Read-Host "Are you sure you want to restore $($selectedBackup.Name)? (y/N)"
        if ($confirm -eq 'y' -or $confirm -eq 'Y') {
            # Check if database lock files exist
            if (Test-Path "$DB_FILE-wal") {
                Write-Host "WARNING: Server appears to be running. Please stop the server before restoring!" -ForegroundColor Red
                exit 1
            }
            
            # Perform restore
            Copy-Item -Path $selectedBackup.FullName -Destination $DB_FILE -Force
            Write-Host ""
            Write-Host "SUCCESS: Database restored successfully from $($selectedBackup.Name)!" -ForegroundColor Green
            Write-Host ""
        } else {
            Write-Host "Restore cancelled." -ForegroundColor Yellow
        }
    } else {
        Write-Host "Invalid choice. Restore cancelled." -ForegroundColor Red
    }
    exit 0
}

# --- BACKUP MODE ---
Write-Host ""
Write-Host "=== DATABASE BACKUP CLI ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $DB_FILE)) {
    Write-Host "ERROR: Active database not found at $DB_FILE" -ForegroundColor Red
    Write-Host "Please start the application first to initialize the database." -ForegroundColor Yellow
    exit 1
}

# Warning if active WAL file is present (server is running)
if (Test-Path "$DB_FILE-wal") {
    Write-Host "NOTE: Server is currently running. The backup will be taken, but" -ForegroundColor Yellow
    Write-Host "      stopping the server first is recommended to guarantee a clean checkpoint." -ForegroundColor Yellow
    Write-Host ""
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = Join-Path $BACKUP_DIR "memory_$timestamp.db"
$fastBackupFile = Join-Path $DB_DIR "memory.db.bak"

try {
    # 1. Create timestamped backup
    Copy-Item -Path $DB_FILE -Destination $backupFile -Force
    
    # 2. Create/update fast backup (memory.db.bak)
    Copy-Item -Path $DB_FILE -Destination $fastBackupFile -Force
    
    $sizeKB = [Math]::Round((Get-Item $backupFile).Length / 1KB, 2)
    
    Write-Host "SUCCESS: Database backed up successfully!" -ForegroundColor Green
    Write-Host "  -> Timestamped:  backend/data/backups/memory_$timestamp.db ($sizeKB KB)" -ForegroundColor Gray
    Write-Host "  -> Fast Backup:  backend/data/memory.db.bak" -ForegroundColor Gray
    Write-Host ""
    Write-Host "To restore any backup, run: .\backup.ps1 -Restore" -ForegroundColor Cyan
    Write-Host ""
} catch {
    Write-Host "ERROR: Backup failed: $_" -ForegroundColor Red
    exit 1
}
