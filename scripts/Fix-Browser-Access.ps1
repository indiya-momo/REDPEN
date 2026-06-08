# 외부 브라우저(Chrome/Edge)에서 localhost 접속이 안 될 때
# 관리자 권한 없이도 시도 가능 — 방화벽 규칙은 관리자일 때만 추가됩니다.
$ErrorActionPreference = 'SilentlyContinue'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$port = 8080

Write-Host "포트 $port 정리..."
Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 1

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator
)
if ($isAdmin) {
  netsh advfirewall firewall delete rule name="PDF Proofread Dev" 2>$null | Out-Null
  netsh advfirewall firewall add rule name="PDF Proofread Dev" dir=in action=allow protocol=TCP localport=5173,8080,4173 | Out-Null
  Write-Host "방화벽 규칙 추가됨 (5173, 8080, 4173)"
} else {
  Write-Host "방화벽: 관리자 PowerShell에서 이 스크립트를 다시 실행하면 자동 허용 규칙을 넣습니다."
}

if (-not (Test-Path "dist\index.html")) {
  Write-Host "빌드 중..."
  npm run build
  if ($LASTEXITCODE -ne 0) { exit 1 }
}

Write-Host ""
Write-Host "브라우저에서 이 주소를 여세요:"
Write-Host "  http://127.0.0.1:$port/"
Write-Host "  http://localhost:$port/"
Write-Host ""
Write-Host "Chrome이 안 되면: 설정 > 시스템 > 프록시 끄기, 또는 localhost 예외"
Write-Host ""

Start-Process "http://localhost:$port/"
npx --yes vite preview --host --port $port --strictPort
