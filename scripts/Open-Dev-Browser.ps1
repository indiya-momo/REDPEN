# dev 서버만 브라우저에서 연다 — 서버는 건드리지 않음
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
. (Join-Path $PSScriptRoot '_dev-port.ps1')

$port = Get-DevPortFromEnv $root
$urls = @(
  "http://127.0.0.1:$port/",
  "http://localhost:$port/"
)

$ok = $false
foreach ($url in $urls) {
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5
    if ($r.StatusCode -eq 200) {
      $ok = $true
      break
    }
  } catch {
    continue
  }
}

if (-not $ok) {
  Write-Host ""
  Write-Host "${port}에서 dev가 응답하지 않습니다. 먼저 새 터미널에서:"
  Write-Host "  npm run start:win"
  Write-Host ""
  exit 1
}

$openUrl = "http://127.0.0.1:$port/"
Write-Host "브라우저 열기: $openUrl"
Start-Process $openUrl
