#Requires -Version 5.1
<#
.SYNOPSIS
  Create local PostgreSQL role + database for GreenCity (Windows native).
.DESCRIPTION
  Does NOT require Docker. Credentials MUST be supplied via environment
  (or secure parameters) — no insecure default passwords.
.EXAMPLE
  $env:PGPASSWORD = '<admin-password>'
  $env:GREENCITY_DB_PASSWORD = '<app-password>'
  pnpm db:setup
#>
param(
  [string]$PgBin = $env:PG_BIN,
  [string]$AdminUser = $(if ($env:PGUSER) { $env:PGUSER } else { "postgres" }),
  [string]$AdminPassword = $env:PGPASSWORD,
  [string]$HostName = $(if ($env:PGHOST) { $env:PGHOST } else { "localhost" }),
  [int]$Port = $(if ($env:PGPORT) { [int]$env:PGPORT } else { 5432 }),
  [string]$AppUser = $(if ($env:GREENCITY_DB_USER) { $env:GREENCITY_DB_USER } else { "greencity" }),
  [string]$AppPassword = $env:GREENCITY_DB_PASSWORD,
  [string]$AppDb = $(if ($env:GREENCITY_DB_NAME) { $env:GREENCITY_DB_NAME } else { "greencity" })
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $ScriptDir "db-common.ps1")

Require-EnvSecret -Name "PGPASSWORD" -Value $AdminPassword
Require-EnvSecret -Name "GREENCITY_DB_PASSWORD" -Value $AppPassword
Assert-PgIdentifier -Name $AdminUser -Label "AdminUser"
Assert-PgIdentifier -Name $AppUser -Label "AppUser"
Assert-PgIdentifier -Name $AppDb -Label "AppDb"

$PgBin = Resolve-PgBin -PgBin $PgBin
$psql = Join-Path $PgBin "psql.exe"
$env:PGPASSWORD = $AdminPassword

Write-Host "Using psql: $psql"
Write-Host "Creating role/database if needed (host=$HostName port=$Port user=$AppUser db=$AppDb)..."

# Test admin auth first — must non-zero on failure
Invoke-Psql -PsqlPath $psql -Arguments @(
  "-U", $AdminUser, "-h", $HostName, "-p", "$Port",
  "-v", "ON_ERROR_STOP=1", "-tAc", "SELECT 1"
) -FailureMessage "Admin authentication or connectivity failed. Check PGPASSWORD / PGUSER / host."

$env:GREENCITY_DB_USER = $AppUser
$env:GREENCITY_DB_PASSWORD = $AppPassword
$reconcileRoleSql = @"
\set ON_ERROR_STOP on
\getenv app_user GREENCITY_DB_USER
\getenv app_password GREENCITY_DB_PASSWORD
SELECT format('CREATE ROLE %I LOGIN', :'app_user')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'app_user')
\gexec
SELECT format('ALTER ROLE %I LOGIN PASSWORD %L', :'app_user', :'app_password')
\gexec
"@

Invoke-Psql -PsqlPath $psql -Arguments @(
  "-U", $AdminUser, "-h", $HostName, "-p", "$Port", "-d", "postgres",
  "-X", "-v", "ON_ERROR_STOP=1", "-f", "-"
) -InputSql $reconcileRoleSql -FailureMessage "Failed to reconcile application role"

$exists = & $psql -U $AdminUser -h $HostName -p $Port -tAc "SELECT 1 FROM pg_database WHERE datname='$AppDb'"
if ($LASTEXITCODE -ne 0) {
  throw "Failed to query databases (exit $LASTEXITCODE)"
}

if ($exists -ne "1") {
  Invoke-Psql -PsqlPath $psql -Arguments @(
    "-U", $AdminUser, "-h", $HostName, "-p", "$Port",
    "-v", "ON_ERROR_STOP=1", "-c", "CREATE DATABASE $AppDb OWNER $AppUser;"
  ) -FailureMessage "Failed to create database"
  Write-Host "Created database $AppDb"
} else {
  Write-Host "Database $AppDb already exists"
}

$grantSql = @"
ALTER DATABASE $AppDb OWNER TO $AppUser;
GRANT ALL ON SCHEMA public TO $AppUser;
ALTER SCHEMA public OWNER TO $AppUser;
"@

Invoke-Psql -PsqlPath $psql -Arguments @(
  "-U", $AdminUser, "-h", $HostName, "-p", "$Port", "-d", $AppDb,
  "-v", "ON_ERROR_STOP=1", "-c", $grantSql
) -FailureMessage "Failed to grant privileges"

$env:PGPASSWORD = $AppPassword
try {
  Invoke-Psql -PsqlPath $psql -Arguments @(
    "-U", $AppUser, "-h", $HostName, "-p", "$Port", "-d", $AppDb,
    "-X", "-v", "ON_ERROR_STOP=1", "-tAc", "SELECT 1"
  ) -FailureMessage "Application role verification failed"
} finally {
  $env:PGPASSWORD = $AdminPassword
}

Write-Host "OK: database ready. Next: pnpm db:postgis  then  pnpm db:migrate"
