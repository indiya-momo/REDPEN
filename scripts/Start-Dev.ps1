# PDF 교정 — 개발 서버 + 기본 브라우저 열기
$ErrorActionPreference = 'SilentlyContinue'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

Write-Host "기존 5173 포트 프로세스 정리..."
Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "  http://localhost:5173"
Write-Host "  http://127.0.0.1:5173"
Write-Host ""

Start-Process "http://127.0.0.1:5173/"
npm run dev
