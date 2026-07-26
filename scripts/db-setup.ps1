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

# Ownership, not blanket grants. `GRANT ALL ON ALL TABLES IN SCHEMA public`
# reaches PostGIS's own tables (spatial_ref_sys) as well as ours, and the
# default-privilege grants that used to live here did the same thing to every
# table the admin role would create later — including the extension's, on the
# next PostGIS upgrade. Transferring ownership of the objects we actually
# created gives the app role everything it needs.
#
# The REVOKEs are not decoration: they undo the defaults an earlier version of
# this script installed, so rerunning setup repairs an already-affected
# database. Revoking a default that was never granted is a no-op, so this stays
# idempotent.
$grantSql = @"
ALTER DATABASE $AppDb OWNER TO $AppUser;
GRANT ALL ON SCHEMA public TO $AppUser;
ALTER SCHEMA public OWNER TO $AppUser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM $AppUser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM $AppUser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TYPES FROM $AppUser;
DO `$body`$
DECLARE
  r RECORD;
BEGIN
  -- Tables (incl. partitioned) and sequences. The pg_depend deptype='e' test
  -- is what keeps extension-owned objects out: re-owning spatial_ref_sys
  -- breaks the assumption that PostGIS owns its own catalogue, and a later
  -- extension upgrade may refuse to touch it.
  FOR r IN (
    SELECT c.relname, c.relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    WHERE c.relkind IN ('r', 'p', 'S')
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.objid = c.oid
          AND d.classid = 'pg_class'::regclass
          AND d.deptype = 'e'
      )
  ) LOOP
    IF r.relkind = 'S' THEN
      EXECUTE format('ALTER SEQUENCE public.%I OWNER TO %I', r.relname, '$AppUser');
    ELSE
      EXECUTE format('ALTER TABLE public.%I OWNER TO %I', r.relname, '$AppUser');
    END IF;
  END LOOP;

  -- Enum types. A migration applied by the admin role leaves its enums owned by
  -- admin, and GRANT never conveys ALTER TYPE, so the next migration that adds
  -- a value fails for the app role unless ownership moves too.
  FOR r IN (
    SELECT t.typname
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace AND n.nspname = 'public'
    WHERE t.typtype = 'e'
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.objid = t.oid
          AND d.classid = 'pg_type'::regclass
          AND d.deptype = 'e'
      )
  ) LOOP
    EXECUTE format('ALTER TYPE public.%I OWNER TO %I', r.typname, '$AppUser');
  END LOOP;
END `$body`$;
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
