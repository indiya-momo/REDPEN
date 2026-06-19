# 오픈베타 1일 1회 — Firestore DB + Rules 배포
# 사전: firebase login (Google 계정, indiya-757ba 프로젝트 권한)
# Usage: powershell -ExecutionPolicy Bypass -File scripts/Deploy-FirestoreBetaQuota.ps1

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$Firebase = 'npx --yes firebase-tools@14.2.1'
$Project = 'indiya-757ba'
$Location = 'asia-northeast3'

Write-Host "== Firebase 로그인 확인 ==" -ForegroundColor Cyan
& $Firebase login:list 2>&1 | Out-Host
$loginList = & $Firebase login:list 2>&1 | Out-String
if ($loginList -match 'No authorized accounts') {
  Write-Host "로그인이 필요합니다. 브라우저가 열리면 Google 계정으로 로그인하세요." -ForegroundColor Yellow
  & $Firebase login
}

Write-Host "`n== Firestore 데이터베이스 확인 ==" -ForegroundColor Cyan
$dbList = & $Firebase firestore:databases:list --project $Project 2>&1 | Out-String
Write-Host $dbList
if ($dbList -notmatch '\(default\)' -and $dbList -notmatch 'READY') {
  Write-Host "기본 DB 생성 중 (location: $Location) ..." -ForegroundColor Yellow
  & $Firebase firestore:databases:create '(default)' --location $Location --project $Project
}

Write-Host "`n== Firestore Rules 배포 ==" -ForegroundColor Cyan
& $Firebase deploy --only firestore:rules --project $Project

Write-Host "`n완료. Console: https://console.firebase.google.com/project/$Project/firestore/rules" -ForegroundColor Green
