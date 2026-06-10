# PostHog 베타 대시보드 생성 (붙여넣기 실수 방지)
# 1) $env:POSTHOG_PERSONAL_API_KEY="phx_…"
# 2) .\scripts\Setup-PostHogBeta.ps1

$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

if (-not $env:POSTHOG_PERSONAL_API_KEY) {
  Write-Host '[Setup-PostHogBeta] POSTHOG_PERSONAL_API_KEY 가 없습니다.'
  Write-Host '  $env:POSTHOG_PERSONAL_API_KEY="phx_…" 를 먼저 실행하세요.'
  exit 1
}

if (-not $env:POSTHOG_HOST) {
  $env:POSTHOG_HOST = 'https://us.posthog.com'
}
if (-not $env:POSTHOG_PROJECT_ID) {
  $env:POSTHOG_PROJECT_ID = '442380'
}

npm run posthog:setup-beta
