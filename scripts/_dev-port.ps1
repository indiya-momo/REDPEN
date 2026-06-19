function Get-DevPortFromEnv {
  param([string]$ProjectRoot)
  $port = 5173
  $path = Join-Path $ProjectRoot '.env.local'
  if (Test-Path $path) {
    foreach ($line in Get-Content $path) {
      if ($line -match '^\s*DEV_PORT\s*=\s*(\d+)\s*$') {
        return [int]$Matches[1]
      }
    }
  }
  return $port
}
