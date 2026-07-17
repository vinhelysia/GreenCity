#Requires -Version 5.1
<#
.SYNOPSIS
  Enable PostGIS extension on the GreenCity database (Windows native).
.EXAMPLE
  $env:PGPASSWORD = '<admin-password>'
  pnpm db:postgis
#>
param(
  [string]$PgBin = $env:PG_BIN,
  [string]$AdminUser = $(if ($env:PGUSER) { $env:PGUSER } else { "postgres" }),
  [string]$AdminPassword = $env:PGPASSWORD,
  [string]$HostName = $(if ($env:PGHOST) { $env:PGHOST } else { "localhost" }),
  [int]$Port = $(if ($env:PGPORT) { [int]$env:PGPORT } else { 5432 }),
  [string]$AppDb = $(if ($env:GREENCITY_DB_NAME) { $env:GREENCITY_DB_NAME } else { "greencity" })
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $ScriptDir "db-common.ps1")

Require-EnvSecret -Name "PGPASSWORD" -Value $AdminPassword
Assert-PgIdentifier -Name $AdminUser -Label "AdminUser"
Assert-PgIdentifier -Name $AppDb -Label "AppDb"

$PgBin = Resolve-PgBin -PgBin $PgBin
$psql = Join-Path $PgBin "psql.exe"
$env:PGPASSWORD = $AdminPassword

Write-Host "Enabling PostGIS on database $AppDb..."

try {
  Invoke-Psql -PsqlPath $psql -Arguments @(
    "-U", $AdminUser, "-h", $HostName, "-p", "$Port", "-d", $AppDb,
    "-v", "ON_ERROR_STOP=1", "-c", "CREATE EXTENSION IF NOT EXISTS postgis;"
  ) -FailureMessage "CREATE EXTENSION postgis failed (is the PostGIS bundle installed?)"
} catch {
  Write-Error @"
Failed to CREATE EXTENSION postgis.

Install the PostGIS bundle for your PG major version, then re-run:

  1) Stack Builder → Spatial Extensions → PostGIS Bundle
     OR https://download.osgeo.org/postgis/windows/
  2) pnpm db:postgis
  3) pnpm db:verify

$_
"@
  exit 1
}

$ver = & $psql -U $AdminUser -h $HostName -p $Port -d $AppDb -tAc "SELECT PostGIS_Version();"
if ($LASTEXITCODE -ne 0) {
  throw "PostGIS_Version() failed (exit $LASTEXITCODE)"
}
if ([string]::IsNullOrWhiteSpace($ver)) {
  throw "PostGIS_Version() returned empty"
}

Write-Host "PostGIS_Version(): $ver"
Write-Host "OK: PostGIS enabled"
