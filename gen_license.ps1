# ============================================================
#  gen_license.ps1 - Interview AI License Key Generator
#
#  Usage (interactive):
#    .\gen_license.ps1
#
#  Usage (non-interactive):
#    .\gen_license.ps1 -HWID "HWID-7BD0-9B7F" -Expires 24h
#    .\gen_license.ps1 -HWID "HWID-7BD0-9B7F" -Expires 1week
#    .\gen_license.ps1 -HWID "HWID-7BD0-9B7F" -Expires 1year
#    .\gen_license.ps1 -HWID "HWID-7BD0-9B7F" -Expires never
#    .\gen_license.ps1 -HWID "HWID-7BD0-9B7F" -Expires 90      # custom days
# ============================================================
param(
    [string]$HWID    = "",
    [string]$Expires = ""   # 24h | 1week | 1year | never | <number of days>
)

$ErrorActionPreference = "Stop"
$ROOT = $PSScriptRoot

# -- Find Node.js (portable runtime first, then system) ------------------------
$portableNode = Join-Path $ROOT "Release_Package\runtime\node.exe"
if (Test-Path $portableNode) {
    $NODE = $portableNode
} elseif (Get-Command node -ErrorAction SilentlyContinue) {
    $NODE = "node"
} else {
    Write-Host "`n[FAIL] Node.js not found." -ForegroundColor Red
    Write-Host "  Run build.ps1 first, or install Node.js from https://nodejs.org" -ForegroundColor Yellow
    exit 1
}

$GENERATOR = Join-Path $ROOT "tools\generate-license.mjs"
if (-not (Test-Path $GENERATOR)) {
    Write-Host "`n[FAIL] tools\generate-license.mjs not found." -ForegroundColor Red
    exit 1
}

# -- Helper: resolve -Expires string to days -----------------------------------
function Resolve-Days([string]$exp) {
    switch -Regex ($exp.Trim().ToLower()) {
        "^24h$"          { return 1 }
        "^1week$|^7d$"   { return 7 }
        "^1year$|^365d$" { return 365 }
        "^never$"        { return 36135 }
        "^\d+$"          { $d = [int]$exp; if ($d -ge 1 -and $d -le 36500) { return $d } }
    }
    return -1
}

# -- Banner --------------------------------------------------------------------
Clear-Host
Write-Host ""
Write-Host "  +--------------------------------------------------+" -ForegroundColor Cyan
Write-Host "  |      Interview AI - License Key Generator        |" -ForegroundColor Cyan
Write-Host "  +--------------------------------------------------+" -ForegroundColor Cyan
Write-Host ""

# -- Get HWID ------------------------------------------------------------------
if (-not $HWID) {
    Write-Host "  Enter customer HWID (format: HWID-XXXX-XXXX):" -ForegroundColor Yellow
    Write-Host "  > " -ForegroundColor Gray -NoNewline
    $HWID = Read-Host
}
$HWID = $HWID.Trim()
if (-not $HWID.StartsWith("HWID-")) {
    Write-Host "`n  [FAIL] HWID must start with 'HWID-'" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "  HWID: " -NoNewline -ForegroundColor Gray
Write-Host $HWID -ForegroundColor Magenta

# -- Resolve expiry (from param or interactive menu) ---------------------------
$days  = -1
$label = ""

if ($Expires) {
    $days = Resolve-Days $Expires
    if ($days -lt 0) {
        Write-Host "`n  [FAIL] Invalid -Expires value: '$Expires'" -ForegroundColor Red
        Write-Host "  Valid options: 24h, 1week, 1year, never, or a number of days (1-36500)" -ForegroundColor Yellow
        exit 1
    }
    $label = switch ($days) {
        1     { "24 hours (1 day)" }
        7     { "7 days (1 week)" }
        365   { "365 days (1 year)" }
        36135 { "Never (99 years)" }
        default { "$days days" }
    }
} else {
    Write-Host ""
    Write-Host "  Select license duration:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "    [1]  24 hours    - Quick demo / trial" -ForegroundColor White
    Write-Host "    [2]  7 days      - 1 week trial" -ForegroundColor White
    Write-Host "    [3]  365 days    - 1 year (standard)" -ForegroundColor White
    Write-Host "    [4]  Never       - Lifetime (99 years)" -ForegroundColor White
    Write-Host "    [5]  Custom      - Enter number of days" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  Choice (1-5): " -ForegroundColor Yellow -NoNewline
    $choice = Read-Host

    switch ($choice.Trim()) {
        "1" { $days = 1;      $label = "24 hours (1 day)" }
        "2" { $days = 7;      $label = "7 days (1 week)" }
        "3" { $days = 365;    $label = "365 days (1 year)" }
        "4" { $days = 36135;  $label = "Never (99 years)" }
        "5" {
            Write-Host "  Number of days: " -ForegroundColor Yellow -NoNewline
            $days = [int](Read-Host)
            $label = "$days days"
            if ($days -lt 1 -or $days -gt 36500) {
                Write-Host "`n  [FAIL] Days must be between 1 and 36500" -ForegroundColor Red
                exit 1
            }
        }
        default {
            Write-Host "`n  [FAIL] Invalid choice (enter 1-5)" -ForegroundColor Red
            exit 1
        }
    }
}

# -- Confirm -------------------------------------------------------------------
Write-Host ""
Write-Host "  +--------------------------------------------------+" -ForegroundColor DarkGray
Write-Host "  |  HWID:    $($HWID.PadRight(40))|" -ForegroundColor White
Write-Host "  |  Expires: $($label.PadRight(40))|" -ForegroundColor White
Write-Host "  +--------------------------------------------------+" -ForegroundColor DarkGray

# Skip confirm if non-interactive (Expires param was passed)
if (-not $Expires) {
    Write-Host ""
    Write-Host "  Generate key? (Enter = Yes / N = Cancel): " -ForegroundColor Yellow -NoNewline
    $confirm = Read-Host
    if ($confirm.Trim().ToUpper() -eq "N") {
        Write-Host "`n  Cancelled." -ForegroundColor Gray
        exit 0
    }
}

# -- Generate ------------------------------------------------------------------
Write-Host ""
Write-Host "  Generating license key..." -ForegroundColor Cyan

& $NODE $GENERATOR $HWID $days

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n  [FAIL] Key generation failed." -ForegroundColor Red
    exit 1
}

# -- Auto-copy to clipboard ----------------------------------------------------
$keyLine = (& $NODE $GENERATOR $HWID $days 2>$null) | Where-Object {
    $_ -match '^[A-Za-z0-9+/=]+\.[a-f0-9]+$'
} | Select-Object -First 1

if ($keyLine) {
    $keyLine | Set-Clipboard
    Write-Host "  Copied to clipboard automatically!" -ForegroundColor Green
}

Write-Host ""
if (-not $Expires) {
    Write-Host "  Press any key to exit..." -ForegroundColor DarkGray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
