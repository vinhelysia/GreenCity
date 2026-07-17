#Requires -Version 5.1
<#
.SYNOPSIS
  Verify PostgreSQL connectivity and PostGIS for GreenCity.
.DESCRIPTION
  Requires DATABASE_URL (no embedded default credentials).
#>
param(
  [string]$DatabaseUrl = $env:DATABASE_URL,
  [string]$PgBin = $env:PG_BIN
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $ScriptDir "db-common.ps1")

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
  throw "DATABASE_URL is required (set in repository-root .env; see .env.example placeholders)."
}

# Parse postgresql://user:pass@host:port/db  (password may contain URL-encoded chars)
if ($DatabaseUrl -notmatch '^postgres(?:ql)?://([^:]+):([^@]+)@([^:/]+):(\d+)/([^?]+)') {
  throw "Could not parse DATABASE_URL. Expected postgresql://user:pass@host:port/db"
}
$user = $Matches[1]
$pass = [System.Uri]::UnescapeDataString($Matches[2])
$hostName = $Matches[3]
$port = [int]$Matches[4]
$db = $Matches[5]

Assert-PgIdentifier -Name $user -Label "database user"
Assert-PgIdentifier -Name $db -Label "database name"

$psql = Join-Path (Resolve-PgBin -PgBin $PgBin) "psql.exe"
$env:PGPASSWORD = $pass

Write-Host "=== Connectivity (SELECT 1) ==="
Invoke-Psql -PsqlPath $psql -Arguments @(
  "-U", $user, "-h", $hostName, "-p", "$port", "-d", $db,
  "-v", "ON_ERROR_STOP=1", "-c", "SELECT 1 AS ok;"
) -FailureMessage "PostgreSQL connectivity failed. Is the server running? Is DATABASE_URL correct?"

Write-Host "=== Tables ==="
& $psql -U $user -h $hostName -p $port -d $db -c "\dt"
if ($LASTEXITCODE -ne 0) {
  throw "Listing tables failed (exit $LASTEXITCODE)"
}

Write-Host "=== PostGIS_Version() ==="
Invoke-Psql -PsqlPath $psql -Arguments @(
  "-U", $user, "-h", $hostName, "-p", "$port", "-d", $db,
  "-v", "ON_ERROR_STOP=1", "-c", "SELECT PostGIS_Version();"
) -FailureMessage "PostGIS not available. Run: pnpm db:postgis (after installing PostGIS binaries)."

Write-Host "OK: database connectivity and PostGIS verified"
