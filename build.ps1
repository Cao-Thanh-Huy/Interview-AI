# ============================================================
#  build.ps1 — One-click build pipeline for Interview AI
#
#  Usage:   .\build.ps1
#  Output:  installer\output\InterviewAI_Setup_v1.0.0.exe
#
#  Steps:
#    1. Build frontend + backend + obfuscate → Release_Package/
#    2. Compile Inno Setup → Setup .exe
# ============================================================
param([switch]$SkipObfuscate)

$ErrorActionPreference = "Stop"
$ROOT   = $PSScriptRoot
$ISS    = Join-Path $ROOT "installer\InterviewAI_Setup.iss"
$OUTPUT = Join-Path $ROOT "installer\output\InterviewAI_Setup_v1.0.0.exe"

# Auto-detect Inno Setup (registry → common paths)
$ISCC = (Get-ItemProperty "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*" -ErrorAction SilentlyContinue |
         Where-Object { $_.DisplayName -like "*Inno Setup*" } |
         Select-Object -First 1).InstallLocation
if ($ISCC) { $ISCC = Join-Path $ISCC "ISCC.exe" }

if (-not $ISCC -or -not (Test-Path $ISCC)) {
    $ISCC = @(
        "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe",
        "$env:ProgramFiles\Inno Setup 6\ISCC.exe",
        "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1
}

function Banner($msg) { Write-Host "`n$('=' * 60)`n  $msg`n$('=' * 60)" -ForegroundColor Cyan }
function OK($msg)     { Write-Host "  [OK] $msg" -ForegroundColor Green }
function FAIL($msg)   { Write-Host "`n  [FAIL] $msg" -ForegroundColor Red; exit 1 }

$StartTime = Get-Date
Banner "Interview AI — Build Pipeline"
Write-Host "  Started: $($StartTime.ToString('HH:mm:ss'))" -ForegroundColor Gray

# ── Check prerequisites ────────────────────────────────────────────────────────
if (-not (Test-Path $ISCC)) {
    FAIL "Inno Setup not found at: $ISCC`n  Install via: winget install JRSoftware.InnoSetup"
}

# ── Step 1: Build Release_Package ─────────────────────────────────────────────
Banner "Step 1/2: Building Release Package"

$buildArgs = @()
if ($SkipObfuscate) { $buildArgs += "-SkipObfuscate" }

& powershell -ExecutionPolicy Bypass -File (Join-Path $ROOT "build-release.ps1") @buildArgs
if ($LASTEXITCODE -ne 0) { FAIL "build-release.ps1 failed (exit $LASTEXITCODE)" }

OK "Release_Package ready"

# ── Step 2: Compile Inno Setup installer ──────────────────────────────────────
Banner "Step 2/2: Compiling Installer (.exe)"

# Remove old output to avoid file-lock issues
if (Test-Path $OUTPUT) {
    Remove-Item $OUTPUT -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

New-Item -ItemType Directory -Path (Join-Path $ROOT "installer\output") -Force | Out-Null

Write-Host "  Compressing 478 MB → ~88 MB (LZMA2), please wait..." -ForegroundColor Gray
& $ISCC $ISS | Where-Object { $_ -match "Compress|Successful|Error|Warning" -and $_ -notmatch "Compress:" }

if ($LASTEXITCODE -ne 0) { FAIL "ISCC compile failed (exit $LASTEXITCODE)" }

# ── Done ──────────────────────────────────────────────────────────────────────
$Elapsed = [math]::Round(((Get-Date) - $StartTime).TotalMinutes, 1)
$SizeMB  = [math]::Round((Get-Item $OUTPUT).Length / 1MB, 1)

Write-Host ""
Write-Host "$('=' * 60)" -ForegroundColor Green
Write-Host "  BUILD COMPLETE in ${Elapsed} min" -ForegroundColor Green
Write-Host "" -ForegroundColor Green
Write-Host "  Output: installer\output\InterviewAI_Setup_v1.0.0.exe" -ForegroundColor White
Write-Host "  Size:   ${SizeMB} MB" -ForegroundColor White
Write-Host "" -ForegroundColor Green
Write-Host "  Next steps:" -ForegroundColor Yellow
Write-Host "    1. Test: double-click Release_Package\InterviewAI_Debug.bat" -ForegroundColor Gray
Write-Host "    2. Ship: installer\output\InterviewAI_Setup_v1.0.0.exe" -ForegroundColor Gray
Write-Host "    3. License: node tools/generate-license.mjs <HWID>" -ForegroundColor Gray
Write-Host "$('=' * 60)" -ForegroundColor Green
