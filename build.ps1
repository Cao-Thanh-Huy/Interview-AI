# ============================================================
#  build.ps1 - Build IntelliView Desktop App
#
#  Usage:   .\build.ps1
#  Output:  dist-electron\IntelliView Setup X.X.X.exe
#
#  Steps:
#    1. Build frontend (React) with Electron API config
#    2. Build backend (Node.js) to single bundled file
#    3. Bundle Electron app -> .exe installer
# ============================================================
param([switch]$SkipObfuscate = $false)

# Skip code signing (no admin/certificate needed)
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"

$ErrorActionPreference = "Stop"
$ROOT     = $PSScriptRoot
$FRONTEND = Join-Path $ROOT "frontend"
$BACKEND  = Join-Path $ROOT "backend"
$ELECTRON = Join-Path $ROOT "electron"
$OUT      = Join-Path $ROOT "dist-electron"

# --- Helpers ------------------------------------------------------------------
function Step($n, $total, $msg) { Write-Host "`n=== Step $n/$total : $msg ===" -ForegroundColor Cyan }
function OK($msg)   { Write-Host "  [OK] $msg" -ForegroundColor Green }
function FAIL($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red; Set-Location $ROOT; exit 1 }

$StartTime = Get-Date
Write-Host ""
Write-Host "  ======================================" -ForegroundColor Magenta
Write-Host "   IntelliView - Build Pipeline" -ForegroundColor Magenta
Write-Host "  ======================================" -ForegroundColor Magenta
Write-Host "  Started: $($StartTime.ToString('HH:mm:ss'))" -ForegroundColor Gray
Write-Host ""

# -- Step 1: Build Frontend ----------------------------------------------------
Step 1 4 "Build React frontend (Electron mode)"
Set-Location $FRONTEND
npm run build -- --mode electron
if ($LASTEXITCODE -ne 0) { FAIL "Frontend build failed" }
OK "frontend/dist/ ready"

# -- Step 2: Bundle Backend ----------------------------------------------------
Step 2 4 "Bundle backend to single JS file"
Set-Location $BACKEND
npm run build:prod
if ($LASTEXITCODE -ne 0) { FAIL "Backend bundle failed" }
OK "backend/dist-pkg/index.js ready"

# -- Step 3: Obfuscate (optional) ----------------------------------------------
if ($SkipObfuscate) {
    Write-Host "`n=== Step 3/4 : Obfuscate [SKIPPED] ===" -ForegroundColor Yellow
} else {
    Step 3 4 "Obfuscate backend JavaScript"
    npm run build:obfuscate
    if ($LASTEXITCODE -ne 0) { FAIL "Obfuscation failed" }
    OK "Backend code obfuscated"
}

# -- Step 4: Build Electron installer ------------------------------------------
Step 4 4 "Build Electron installer (.exe)"
Set-Location $ELECTRON

# Copy frontend dist into electron resources staging
$stagingFrontend = Join-Path $ELECTRON "resources\frontend-dist"
if (Test-Path $stagingFrontend) { Remove-Item $stagingFrontend -Recurse -Force }
New-Item -ItemType Directory -Path $stagingFrontend -Force | Out-Null
Copy-Item -Path (Join-Path $FRONTEND "dist\*") -Destination $stagingFrontend -Recurse -Force
OK "Frontend dist staged for Electron"

# Copy backend bundle into electron resources staging
$stagingBackend = Join-Path $ELECTRON "resources\app"
if (Test-Path $stagingBackend) { Remove-Item $stagingBackend -Recurse -Force }
New-Item -ItemType Directory -Path $stagingBackend -Force | Out-Null
Copy-Item (Join-Path $BACKEND "dist-pkg\index.js") (Join-Path $stagingBackend "index.js") -Force
'{"type":"module"}' | Out-File -FilePath (Join-Path $stagingBackend "package.json") -Encoding ASCII
OK "Backend bundle staged for Electron"

# Copy node_modules (production deps only)
Write-Host "  Copying node_modules (1-2 min)..." -ForegroundColor Gray
$nmSrc  = Join-Path $BACKEND "node_modules"
$nmDst  = Join-Path $stagingBackend "node_modules"
$devOnly = @("tsup","typescript","tsx","esbuild","@types","javascript-obfuscator","cross-env","nodemon","@swc")
Get-ChildItem $nmSrc | ForEach-Object {
    $skip = $devOnly | Where-Object { $_.Name -like "$_*" }
    if (-not $skip) {
        Copy-Item -Path $_.FullName -Destination (Join-Path $nmDst $_.Name) -Recurse -Force -ErrorAction SilentlyContinue
    }
}
OK "node_modules staged"

# Copy portable Node.js runtime
$runtimeDir = Join-Path $ELECTRON "resources\runtime"
if (-not (Test-Path $runtimeDir)) { New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null }
$nodeCmdInfo = Get-Command node -ErrorAction SilentlyContinue
$nodeExe = if ($nodeCmdInfo) { $nodeCmdInfo.Source } else { $null }
if ($nodeExe -and (Test-Path $nodeExe)) {
    Copy-Item $nodeExe (Join-Path $runtimeDir "node.exe") -Force
    OK "node.exe bundled ($([math]::Round((Get-Item $nodeExe).Length/1MB, 1)) MB)"
} else {
    FAIL "node.exe not found - make sure Node.js is installed"
}

# Run electron-builder
npx electron-builder --win --x64
if ($LASTEXITCODE -ne 0) { FAIL "electron-builder failed" }

# -- Done ----------------------------------------------------------------------
Set-Location $ROOT
$Elapsed = [math]::Round(((Get-Date) - $StartTime).TotalMinutes, 1)

Write-Host ""
Write-Host "  ========================================" -ForegroundColor Green
Write-Host "   BUILD COMPLETE in ${Elapsed} min" -ForegroundColor Green
Write-Host "  ========================================" -ForegroundColor Green
Write-Host ""

if (Test-Path $OUT) {
    Get-ChildItem $OUT -Filter "*.exe" | ForEach-Object {
        $mb = [math]::Round($_.Length / 1MB, 1)
        Write-Host "  OUTPUT: $($_.Name) [$mb MB]" -ForegroundColor White
        Write-Host "  PATH  : $($_.FullName)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "  Giao file .exe cho khach hang de cai dat." -ForegroundColor Yellow
Write-Host "  License: node tools\generate-license.mjs [HWID]" -ForegroundColor Gray
Write-Host ""
