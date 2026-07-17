#Requires -Version 5.1
<#
.SYNOPSIS
  Create local PostgreSQL role + database for GreenCity (Windows native).
.DESCRIPTION
  Does NOT require Docker. Uses psql against a local PostgreSQL install.
  Defaults match .env.example (user/db greencity, password greencity).
#>
param(
  [string]$PgBin = $env:PG_BIN,
  [string]$AdminUser = "postgres",
  [string]$AdminPassword = $(if ($env:PGPASSWORD) { $env:PGPASSWORD } else { "postgres" }),
  [string]$HostName = "localhost",
  [int]$Port = 5432,
  [string]$AppUser = "greencity",
  [string]$AppPassword = "greencity",
  [string]$AppDb = "greencity"
)

$ErrorActionPreference = "Stop"

function Resolve-PgBin {
  if ($PgBin -and (Test-Path (Join-Path $PgBin "psql.exe"))) { return $PgBin }
  $candidates = @(
    "C:\Program Files\PostgreSQL\16\bin",
    "C:\Program Files\PostgreSQL\17\bin",
    "C:\Program Files\PostgreSQL\15\bin",
    "C:\Program Files\PostgreSQL\18\bin"
  )
  foreach ($c in $candidates) {
    if (Test-Path (Join-Path $c "psql.exe")) { return $c }
  }
  throw "psql.exe not found. Install PostgreSQL and set -PgBin or PG_BIN to its bin folder."
}

$PgBin = Resolve-PgBin
$psql = Join-Path $PgBin "psql.exe"
$env:PGPASSWORD = $AdminPassword

Write-Host "Using psql: $psql"
Write-Host "Creating role/database if needed (host=$HostName port=$Port)..."

& $psql -U $AdminUser -h $HostName -p $Port -v ON_ERROR_STOP=1 -c @"
DO `$`$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$AppUser') THEN
    CREATE ROLE $AppUser LOGIN PASSWORD '$AppPassword';
  END IF;
END
`$`$;
"@

$exists = & $psql -U $AdminUser -h $HostName -p $Port -tAc "SELECT 1 FROM pg_database WHERE datname='$AppDb'"
if ($exists -ne "1") {
  & $psql -U $AdminUser -h $HostName -p $Port -v ON_ERROR_STOP=1 -c "CREATE DATABASE $AppDb OWNER $AppUser;"
  Write-Host "Created database $AppDb"
} else {
  Write-Host "Database $AppDb already exists"
}

& $psql -U $AdminUser -h $HostName -p $Port -d $AppDb -v ON_ERROR_STOP=1 -c @"
ALTER DATABASE $AppDb OWNER TO $AppUser;
GRANT ALL ON SCHEMA public TO $AppUser;
ALTER SCHEMA public OWNER TO $AppUser;
"@

Write-Host "OK: database ready. Next: pnpm db:postgis  then  pnpm db:migrate"
