param([switch]$SkipObfuscate)

$ErrorActionPreference = "Stop"
$ROOT      = $PSScriptRoot
$BACKEND   = Join-Path $ROOT "backend"
$FRONTEND  = Join-Path $ROOT "frontend"
$RELEASE   = Join-Path $ROOT "Release_Package"

function Step($n, $msg) { Write-Host "`n=== Step $n/7: $msg ===" -ForegroundColor Cyan }
function OK($msg)        { Write-Host "  OK: $msg" -ForegroundColor Green }
function FAIL($msg)      { Write-Host "  FAIL: $msg" -ForegroundColor Red; exit 1 }
function WARN($msg)      { Write-Host "  WARN: $msg" -ForegroundColor Yellow }

# ── Step 0: Clean Release_Package ─────────────────────────────────────────────
Step 0 "Prepare Release_Package/"
if (Test-Path $RELEASE) { Remove-Item $RELEASE -Recurse -Force }
@("", "app", "app\node_modules", "runtime", "models") | ForEach-Object {
    New-Item -ItemType Directory -Path (Join-Path $RELEASE $_) -Force | Out-Null
}
OK "Directory structure created"

# ── Step 1: Build React frontend ───────────────────────────────────────────────
Step 1 "Build React frontend"
Set-Location $FRONTEND
npm run build
if ($LASTEXITCODE -ne 0) { FAIL "Frontend build failed" }
OK "frontend/dist/ ready"

# ── Step 2: Copy frontend into app/ ───────────────────────────────────────────
Step 2 "Copy frontend dist -> Release_Package/app/frontend-dist/"
Copy-Item -Path (Join-Path $FRONTEND "dist") -Destination (Join-Path $RELEASE "app\frontend-dist") -Recurse
OK "frontend-dist copied"

# ── Step 3: Bundle backend to single ESM file ─────────────────────────────────
Step 3 "Bundle TypeScript -> single ESM JS (tsup)"
Set-Location $BACKEND
npm run build:prod
if ($LASTEXITCODE -ne 0) { FAIL "Backend build failed" }
OK "dist-pkg/index.js ready"

# ── Step 4: Obfuscate (optional) ──────────────────────────────────────────────
if ($SkipObfuscate) {
    Write-Host "`n=== Step 4/7: Obfuscate [SKIPPED - use full build for release] ===" -ForegroundColor Yellow
} else {
    Step 4 "Obfuscate JavaScript"
    npm run build:obfuscate
    if ($LASTEXITCODE -ne 0) { FAIL "Obfuscation failed" }
    OK "Code obfuscated"
}

# ── Step 5: Copy app bundle + dependencies ────────────────────────────────────
Step 5 "Copy app bundle and runtime dependencies"

# Main app bundle
Copy-Item (Join-Path $BACKEND "dist-pkg\index.js") (Join-Path $RELEASE "app\index.js")
# ESM marker - required so Node.js treats index.js as ES module
'{"type":"module"}' | Out-File -FilePath (Join-Path $RELEASE "app\package.json") -Encoding ASCII
OK "index.js + package.json -> app/"

# Copy ALL node_modules to app/ (required since tsup transpiles, doesn't bundle)
# Excludes devDependencies and cache dirs to keep size manageable
Write-Host "  Copying node_modules (this may take 1-2 min)..." -ForegroundColor Gray
$nmSrc = Join-Path $BACKEND "node_modules"
$nmDst = Join-Path $RELEASE "app\node_modules"

# List of devOnly packages to exclude (reduces size)
$devOnlyPkgs = @("tsup", "typescript", "tsx", "esbuild", "@types", "javascript-obfuscator",
                 "@yao-pkg", "pkg", "cross-env", "nodemon", "@swc")

Get-ChildItem $nmSrc | ForEach-Object {
    $pkgName = $_.Name
    $skip = $devOnlyPkgs | Where-Object { $pkgName -like "$_*" }
    if (-not $skip) {
        $dst = Join-Path $nmDst $pkgName
        Copy-Item -Path $_.FullName -Destination $dst -Recurse -Force -ErrorAction SilentlyContinue
    }
}
# Also copy scoped packages (@scope/pkg)
Get-ChildItem $nmSrc -Directory | Where-Object { $_.Name.StartsWith("@") } | ForEach-Object {
    $scopeName = $_.Name
    $skipScope = $devOnlyPkgs | Where-Object { $scopeName -like "$_*" }
    if (-not $skipScope) {
        Get-ChildItem $_.FullName | ForEach-Object {
            # Already copied by the parent directory copy above - this is handled
        }
    }
}
OK "node_modules -> app/node_modules/ (production deps)"

# ── Step 6: Bundle portable Node.js runtime ──────────────────────────────────
Step 6 "Bundle portable Node.js runtime"
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
$nodePath = if ($nodeCmd) { $nodeCmd.Source } else { $null }
if ($nodePath -and (Test-Path $nodePath)) {
    Copy-Item $nodePath (Join-Path $RELEASE "runtime\node.exe")
    $sizeMB = [math]::Round((Get-Item $nodePath).Length / 1MB, 1)
    OK "node.exe ($sizeMB MB) -> runtime/"
} else {
    FAIL "node.exe not found. Make sure Node.js is installed."
}

# ── Step 7: Create launchers and config files ─────────────────────────────────
Step 7 "Create launchers and config files"

# Hidden launcher VBScript (no console window popup)
$vbs = @'
Set WshShell = CreateObject("WScript.Shell")
appDir = WScript.ScriptFullName
appDir = Left(appDir, InStrRev(appDir, "\"))

' Start backend silently
WshShell.Run Chr(34) & appDir & "runtime\node.exe" & Chr(34) & " --use-system-ca " & Chr(34) & appDir & "app\index.js" & Chr(34), 0, False

' Wait 3 seconds for backend to start
WScript.Sleep 3000

' Open browser
WshShell.Run "http://localhost:3001", 1, False
'@
$vbs | Out-File -FilePath (Join-Path $RELEASE "InterviewAI.vbs") -Encoding ASCII
OK "InterviewAI.vbs (silent launcher) -> Release_Package/"

# Also a visible .bat for debugging (shows console output)
$bat = "@echo off`r`necho Starting Interview AI...`r`n`"%~dp0runtime\node.exe`" --use-system-ca `"%~dp0app\index.js`"`r`npause"
$bat | Out-File -FilePath (Join-Path $RELEASE "InterviewAI_Debug.bat") -Encoding ASCII
OK "InterviewAI_Debug.bat (visible console) -> Release_Package/"


# Empty license.key
"" | Out-File -FilePath (Join-Path $RELEASE "license.key") -Encoding UTF8 -NoNewline
OK "license.key (empty) -> Release_Package/"

# README
"Interview AI - Quick Start`n`n1. Double-click InterviewAI.vbs to launch`n2. Browser opens at http://localhost:3001`n3. Enter License Key to activate`n4. Enter your Groq + Deepgram API keys in Settings tab`n`nNote: InterviewAI_Debug.bat shows the console for troubleshooting." |
    Out-File -FilePath (Join-Path $RELEASE "README.txt") -Encoding UTF8
OK "README.txt -> Release_Package/"

# ── Summary ───────────────────────────────────────────────────────────────────
Set-Location $ROOT
$total = (Get-ChildItem $RELEASE -Recurse | Measure-Object -Property Length -Sum).Sum
$mb = [math]::Round($total / 1MB, 1)

Write-Host "`n========================================" -ForegroundColor Magenta
Write-Host "  BUILD COMPLETE - $mb MB total" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""
Get-ChildItem $RELEASE | ForEach-Object {
    $sz = if ($_.PSIsContainer) { "dir" } else { "$([math]::Round($_.Length/1KB))KB" }
    Write-Host "  $($_.Name)  [$sz]" -ForegroundColor Gray
}
Write-Host ""
Write-Host "  TEST: double-click Release_Package\InterviewAI_Debug.bat (shows console)" -ForegroundColor Yellow
Write-Host "  NEXT: Open Inno Setup -> installer\InterviewAI_Setup.iss -> Compile" -ForegroundColor Yellow
Write-Host ""
