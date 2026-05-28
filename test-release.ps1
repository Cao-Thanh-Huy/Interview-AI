Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
Start-Sleep 2

# Start app (PORT defaults to 3001 from backend; no .env needed to launch)
$p = Start-Process "Release_Package\runtime\node.exe" `
    -ArgumentList "--use-system-ca", "app\index.js" `
    -WorkingDirectory "$PWD\Release_Package" `
    -PassThru
Write-Host "App PID: $($p.Id), waiting 22s..."
Start-Sleep 22

function TestApi($method, $url, $body, $label, $expectCode) {
    Write-Host "`n--- $label ---"
    try {
        if ($body) {
            $r = Invoke-WebRequest $url -Method $method -Body $body -ContentType "application/json" -UseBasicParsing
        } else {
            $r = Invoke-WebRequest $url -Method $method -UseBasicParsing
        }
        $icon = if ($r.StatusCode -eq $expectCode) { "PASS" } else { "WARN" }
        Write-Host "$icon HTTP $($r.StatusCode): $($r.Content.Substring(0,[Math]::Min(200,$r.Content.Length)))"
        return $r
    } catch [System.Net.WebException] {
        $resp = $_.Exception.Response
        if ($resp) {
            $code = [int]$resp.StatusCode
            $stream = New-Object System.IO.StreamReader($resp.GetResponseStream())
            $rbody = $stream.ReadToEnd()
            $icon = if ($code -eq $expectCode) { "PASS" } else { "FAIL" }
            Write-Host "$icon HTTP ${code}: ${rbody}"
        } else {
            Write-Host "FAIL: $($_.Exception.Message)"
        }
        return $null
    }
}

# TEST 1: Unlicensed (expect 403)
TestApi "GET" "http://localhost:3001/api/license/status" $null "TEST 1 - Unlicensed status (expect 403)" 403

# TEST 2: Generate key
Write-Host "`n--- TEST 2 - Generate license key ---"
$raw = node "tools/generate-license.mjs" "HWID-7BD0-9B7F" 2>&1
$raw | ForEach-Object { Write-Host "  $_" }
$key = ($raw -join "") -replace ".*?(ey[A-Za-z0-9_\-]{20,}\.[a-f0-9]{20,}).*", '$1'
Write-Host "Extracted key: $key"

# TEST 3: Activate (expect 200)
$activateBody = '{"key":"' + $key + '"}'
TestApi "POST" "http://localhost:3001/api/license/activate" $activateBody "TEST 3 - Activate license (expect 200)" 200

# TEST 4: Licensed (expect 200)
TestApi "GET" "http://localhost:3001/api/license/status" $null "TEST 4 - Licensed status (expect 200)" 200

# TEST 5: Frontend
Write-Host "`n--- TEST 5 - Frontend served ---"
try {
    $r5 = Invoke-WebRequest "http://localhost:3001/" -UseBasicParsing
    Write-Host "PASS HTTP $($r5.StatusCode): $($r5.Content.Substring(0,[Math]::Min(80,$r5.Content.Length)))"
} catch {
    Write-Host "FAIL: $($_.Exception.Message)"
}

Write-Host "`n=== ALL TESTS DONE ==="
Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
Write-Host "App stopped."
