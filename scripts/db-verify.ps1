#Requires -Version 5.1
<#
.SYNOPSIS
  Verify PostgreSQL connectivity and PostGIS for GreenCity.
#>
param(
  [string]$DatabaseUrl = $env:DATABASE_URL,
  [string]$PgBin = $env:PG_BIN
)

$ErrorActionPreference = "Stop"

if (-not $DatabaseUrl) {
  $DatabaseUrl = "postgresql://greencity:greencity@localhost:5432/greencity?schema=public"
  Write-Host "DATABASE_URL not set; using default: $DatabaseUrl"
}

function Resolve-PgBin {
  if ($PgBin -and (Test-Path (Join-Path $PgBin "psql.exe"))) { return $PgBin }
  foreach ($c in @(
      "C:\Program Files\PostgreSQL\16\bin",
      "C:\Program Files\PostgreSQL\17\bin",
      "C:\Program Files\PostgreSQL\15\bin",
      "C:\Program Files\PostgreSQL\18\bin"
    )) {
    if (Test-Path (Join-Path $c "psql.exe")) { return $c }
  }
  throw "psql.exe not found. Set -PgBin or PG_BIN."
}

# Parse postgresql://user:pass@host:port/db
if ($DatabaseUrl -notmatch '^postgres(?:ql)?://([^:]+):([^@]+)@([^:/]+):(\d+)/([^?]+)') {
  throw "Could not parse DATABASE_URL. Expected postgresql://user:pass@host:port/db"
}
$user = $Matches[1]
$pass = $Matches[2]
$hostName = $Matches[3]
$port = [int]$Matches[4]
$db = $Matches[5]

$psql = Join-Path (Resolve-PgBin) "psql.exe"
$env:PGPASSWORD = $pass

Write-Host "=== Connectivity (SELECT 1) ==="
& $psql -U $user -h $hostName -p $port -d $db -v ON_ERROR_STOP=1 -c "SELECT 1 AS ok;"
if ($LASTEXITCODE -ne 0) {
  throw "PostgreSQL connectivity failed. Is the server running? Is DATABASE_URL correct?"
}

Write-Host "=== Tables ==="
& $psql -U $user -h $hostName -p $port -d $db -c "\dt"

Write-Host "=== PostGIS_Version() ==="
& $psql -U $user -h $hostName -p $port -d $db -v ON_ERROR_STOP=1 -c "SELECT PostGIS_Version();"
if ($LASTEXITCODE -ne 0) {
  throw "PostGIS not available. Run: pnpm db:postgis (after installing PostGIS binaries)."
}

Write-Host "OK: database connectivity and PostGIS verified"
