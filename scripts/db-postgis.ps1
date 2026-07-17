#Requires -Version 5.1
<#
.SYNOPSIS
  Enable PostGIS extension on the GreenCity database (Windows native).
.NOTES
  Requires PostGIS binaries installed for your PostgreSQL major version
  (Stack Builder "Spatial Extensions" or OSGeo postgis-bundle zip).
  See README.md "Install PostGIS on Windows".
#>
param(
  [string]$PgBin = $env:PG_BIN,
  [string]$AdminUser = "postgres",
  [string]$AdminPassword = $(if ($env:PGPASSWORD) { $env:PGPASSWORD } else { "postgres" }),
  [string]$HostName = "localhost",
  [int]$Port = 5432,
  [string]$AppDb = "greencity"
)

$ErrorActionPreference = "Stop"

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

$PgBin = Resolve-PgBin
$psql = Join-Path $PgBin "psql.exe"
$env:PGPASSWORD = $AdminPassword

Write-Host "Enabling PostGIS on database $AppDb..."

try {
  & $psql -U $AdminUser -h $HostName -p $Port -d $AppDb -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS postgis;"
} catch {
  Write-Error @"
Failed to CREATE EXTENSION postgis.

PostGIS is not available in this PostgreSQL installation.
Install the PostGIS bundle for your PG major version, then re-run:

  1) Stack Builder → Spatial Extensions → PostGIS Bundle
     OR download https://download.osgeo.org/postgis/windows/ and install
  2) pnpm db:postgis
  3) Verify: pnpm db:verify

Original error: $_
"@
  exit 1
}

$ver = & $psql -U $AdminUser -h $HostName -p $Port -d $AppDb -tAc "SELECT PostGIS_Version();"
Write-Host "PostGIS_Version(): $ver"
Write-Host "OK: PostGIS enabled"
