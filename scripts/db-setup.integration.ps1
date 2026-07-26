#Requires -Version 5.1
<#
.SYNOPSIS
  Integration regression tests for db-setup.ps1 against native PostgreSQL.
.DESCRIPTION
  Requires a disposable PostgreSQL instance via PGHOST, PGPORT, PGUSER,
  PGPASSWORD, and optional PG_BIN. Application credentials are generated at
  runtime, never passed on a command line, and the test role/database are removed.
#>

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $ScriptDir "db-common.ps1")

$AdminUser = $(if ($env:PGUSER) { $env:PGUSER } else { "postgres" })
$AdminPassword = $env:PGPASSWORD
$HostName = $(if ($env:PGHOST) { $env:PGHOST } else { "localhost" })
$Port = $(if ($env:PGPORT) { [int]$env:PGPORT } else { 5432 })
Require-EnvSecret -Name "PGPASSWORD" -Value $AdminPassword
Assert-PgIdentifier -Name $AdminUser -Label "AdminUser"

$PgBin = Resolve-PgBin -PgBin $env:PG_BIN
$psql = Join-Path $PgBin "psql.exe"
$id = [guid]::NewGuid().ToString("N").Substring(0, 10)
$AppUser = "gc_setup_test_$id"
$AppDb = "gc_setup_test_$id"
$quotedPassword = "quote_$id' space !@#"
$rotatedPassword = "rotate_$id space !@#$%^&*()-+="
$stdoutPath = Join-Path $env:TEMP "gc-db-setup-$id.stdout.log"
$stderrPath = Join-Path $env:TEMP "gc-db-setup-$id.stderr.log"

function Invoke-ProcessExit {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )
  $process = Start-Process -FilePath $FilePath -ArgumentList $Arguments `
    -NoNewWindow -Wait -PassThru `
    -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
  return $process.ExitCode
}

function Invoke-SetupExit {
  param(
    [string]$AdminSecret,
    [string]$AppSecret,
    [bool]$SupplyAdminSecret = $true,
    [bool]$SupplyAppSecret = $true,
    [string]$Role = $AppUser
  )
  if ($SupplyAdminSecret) { $env:PGPASSWORD = $AdminSecret } else { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
  if ($SupplyAppSecret) { $env:GREENCITY_DB_PASSWORD = $AppSecret } else { Remove-Item Env:GREENCITY_DB_PASSWORD -ErrorAction SilentlyContinue }
  $env:PGUSER = $AdminUser
  $env:PGHOST = $HostName
  $env:PGPORT = "$Port"
  $env:PG_BIN = $PgBin
  $env:GREENCITY_DB_USER = $Role
  $env:GREENCITY_DB_NAME = $AppDb
  return Invoke-ProcessExit -FilePath "powershell.exe" -Arguments @(
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $ScriptDir "db-setup.ps1")
  )
}

function Assert-Equal {
  param([int]$Actual, [int]$Expected, [string]$Message)
  if ($Actual -ne $Expected) {
    $err = if (Test-Path $stderrPath) { Get-Content $stderrPath -Raw } else { "" }
    throw "$Message (exit $Actual, expected $Expected): $err"
  }
}

function Assert-NonZero {
  param([int]$Actual, [string]$Message)
  if ($Actual -eq 0) { throw "$Message (unexpected exit 0)" }
}

function Assert-SecretAbsentFromLogs {
  param([string]$Secret)
  foreach ($path in @($stdoutPath, $stderrPath)) {
    if ((Test-Path $path) -and [IO.File]::ReadAllText($path).Contains($Secret)) {
      throw "db-setup output exposed an application credential"
    }
  }
}

function Test-AppLogin {
  param([string]$Password)
  $env:PGPASSWORD = $Password
  return Invoke-ProcessExit -FilePath $psql -Arguments @(
    "-X", "-h", $HostName, "-p", "$Port", "-U", $AppUser, "-d", $AppDb,
    "-v", "ON_ERROR_STOP=1", "-tAc", "SELECT 1"
  )
}

function Test-AppCanAlterObjects {
  param([string]$Password)
  $env:PGPASSWORD = $Password
  $alterSql = '"ALTER TABLE public.admin_test_table ADD COLUMN extra int; ALTER SEQUENCE public.admin_test_seq RESTART WITH 100;"'
  return Invoke-ProcessExit -FilePath $psql -Arguments @(
    "-X", "-h", $HostName, "-p", "$Port", "-U", $AppUser, "-d", $AppDb,
    "-v", "ON_ERROR_STOP=1", "-c", $alterSql
  )
}

# Separate call on purpose: ALTER TYPE ... ADD VALUE is rejected inside a
# multi-statement transaction block on older servers, and this is exactly what a
# migration does when it extends an enum.
function Test-AppCanAlterEnum {
  param([string]$Password)
  $env:PGPASSWORD = $Password
  return Invoke-ProcessExit -FilePath $psql -Arguments @(
    "-X", "-h", $HostName, "-p", "$Port", "-U", $AppUser, "-d", $AppDb,
    "-v", "ON_ERROR_STOP=1", "-c", '"ALTER TYPE public.admin_test_enum ADD VALUE ''b'';"'
  )
}

# Re-checks alterability after a later setup run. Uses different operations from
# Test-AppCanAlterObjects/Enum so it stays runnable a second time.
function Test-AppCanStillAlter {
  param([string]$Password)
  $env:PGPASSWORD = $Password
  $exit = Invoke-ProcessExit -FilePath $psql -Arguments @(
    "-X", "-h", $HostName, "-p", "$Port", "-U", $AppUser, "-d", $AppDb,
    "-v", "ON_ERROR_STOP=1", "-c",
    '"ALTER TABLE public.admin_test_table ADD COLUMN IF NOT EXISTS extra2 int; ALTER SEQUENCE public.admin_test_seq RESTART WITH 200;"'
  )
  if ($exit -ne 0) { return $exit }
  $env:PGPASSWORD = $Password
  return Invoke-ProcessExit -FilePath $psql -Arguments @(
    "-X", "-h", $HostName, "-p", "$Port", "-U", $AppUser, "-d", $AppDb,
    "-v", "ON_ERROR_STOP=1", "-c", '"ALTER TYPE public.admin_test_enum ADD VALUE IF NOT EXISTS ''c'';"'
  )
}

function Get-AdminScalar {
  param([Parameter(Mandatory = $true)][string]$Sql, [string]$Database = $AppDb)
  $env:PGPASSWORD = $AdminPassword
  $out = & $psql -X -h $HostName -p $Port -U $AdminUser -d $Database -v ON_ERROR_STOP=1 -tAc $Sql
  if ($LASTEXITCODE -ne 0) { throw "admin query failed: $Sql" }
  return ($out | Out-String).Trim()
}

try {
  Assert-Equal (Invoke-SetupExit $AdminPassword $quotedPassword) 0 "quoted password setup failed"
  Assert-SecretAbsentFromLogs $quotedPassword
  Assert-Equal (Test-AppLogin $quotedPassword) 0 "quoted password login failed"

  $env:PGPASSWORD = $AdminPassword
  $createSql = '"CREATE SEQUENCE public.admin_test_seq; CREATE TABLE public.admin_test_table (id int DEFAULT nextval(''public.admin_test_seq'')); CREATE TYPE public.admin_test_enum AS ENUM (''a'');"'
  Assert-Equal (Invoke-ProcessExit -FilePath $psql -Arguments @(
    "-X", "-h", $HostName, "-p", "$Port", "-U", $AdminUser, "-d", $AppDb,
    "-v", "ON_ERROR_STOP=1", "-c", $createSql
  )) 0 "admin table/sequence creation failed"

  Assert-Equal (Invoke-SetupExit $AdminPassword $rotatedPassword) 0 "password rotation setup failed"
  Assert-SecretAbsentFromLogs $rotatedPassword
  Assert-Equal (Test-AppLogin $rotatedPassword) 0 "rotated password login failed"
  Assert-Equal (Test-AppCanAlterObjects $rotatedPassword) 0 "app user failed to alter admin-created table/sequence"
  # GRANT never conveys ALTER TYPE, so this fails unless setup moved ownership.
  Assert-Equal (Test-AppCanAlterEnum $rotatedPassword) 0 "app user failed to alter admin-created enum"
  Assert-NonZero (Test-AppLogin $quotedPassword) "old password remained valid after rotation"

  # Setup must claim what the application created and nothing else. PostGIS owns
  # spatial_ref_sys; re-owning it is what this guards against.
  if ((Get-AdminScalar "SELECT count(*) FROM pg_available_extensions WHERE name = 'postgis'") -eq "0") {
    Write-Host "db-setup.integration: postgis unavailable, skipping extension-ownership check"
  } else {
    Assert-Equal (Invoke-ProcessExit -FilePath $psql -Arguments @(
      "-X", "-h", $HostName, "-p", "$Port", "-U", $AdminUser, "-d", $AppDb,
      "-v", "ON_ERROR_STOP=1", "-c", '"CREATE EXTENSION IF NOT EXISTS postgis;"'
    )) 0 "postgis installation failed"

    $ownerSql = "SELECT pg_get_userbyid(c.relowner) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public' WHERE c.relname = 'spatial_ref_sys'"
    $extOwnerSql = "SELECT pg_get_userbyid(extowner) FROM pg_extension WHERE extname = 'postgis'"
    $extOwner = Get-AdminScalar $extOwnerSql
    if ((Get-AdminScalar $ownerSql) -ne $extOwner) {
      throw "spatial_ref_sys was not owned by the postgis extension owner before rerunning setup"
    }

    Assert-Equal (Invoke-SetupExit $AdminPassword $rotatedPassword) 0 "setup rerun with postgis installed failed"

    $ownerAfter = Get-AdminScalar $ownerSql
    if ($ownerAfter -ne $extOwner) {
      throw "db-setup took ownership of the postgis table spatial_ref_sys (now '$ownerAfter', expected '$extOwner')"
    }
    # The application's own objects must still have been claimed on that rerun.
    if ((Get-AdminScalar "SELECT pg_get_userbyid(c.relowner) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public' WHERE c.relname = 'admin_test_table'") -ne $AppUser) {
      throw "db-setup skipped an application table while excluding extension objects"
    }

    # Ownership is not the only way in: default privileges used to hand the app
    # role ALL on every table the admin would create later, PostGIS's included.
    # Reading the catalogue rather than the script proves the effective right.
    $writeAcl = Get-AdminScalar "SELECT bool_or(has_table_privilege('$AppUser', 'public.spatial_ref_sys', p)) FROM unnest(ARRAY['INSERT','UPDATE','DELETE','TRUNCATE']) AS p"
    if ($writeAcl -ne "f") {
      $detail = Get-AdminScalar "SELECT coalesce(array_to_string(c.relacl, ' '), '(default)') FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public' WHERE c.relname = 'spatial_ref_sys'"
      throw "$AppUser holds write privileges on the postgis table spatial_ref_sys (acl: $detail)"
    }

    # And the app role must still be able to alter its own objects afterwards.
    Assert-Equal (Test-AppCanStillAlter $rotatedPassword) 0 "app user lost the ability to alter its objects after the postgis rerun"
  }

  Assert-NonZero (Invoke-SetupExit ([guid]::NewGuid().ToString("N")) $rotatedPassword) "invalid admin authentication succeeded"
  Assert-SecretAbsentFromLogs $rotatedPassword
  Assert-NonZero (Invoke-SetupExit $AdminPassword $rotatedPassword $true $false) "missing application secret succeeded"
  Assert-SecretAbsentFromLogs $rotatedPassword
  Assert-NonZero (Invoke-SetupExit $AdminPassword $rotatedPassword $false $true) "missing admin secret succeeded"
  Assert-SecretAbsentFromLogs $rotatedPassword
  Assert-NonZero (Invoke-SetupExit $AdminPassword $rotatedPassword $true $true "invalid-role") "invalid identifier succeeded"

  Write-Host "db-setup.integration: ok"
} finally {
  $env:PGPASSWORD = $AdminPassword
  $env:PGUSER = $AdminUser
  $env:PGHOST = $HostName
  $env:PGPORT = "$Port"
  Invoke-ProcessExit -FilePath $psql -Arguments @(
    "-X", "-h", $HostName, "-p", "$Port", "-U", $AdminUser, "-d", "postgres",
    "-v", "ON_ERROR_STOP=1", "-c",
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$AppDb' AND pid <> pg_backend_pid();"
  ) | Out-Null
  Invoke-ProcessExit -FilePath $psql -Arguments @(
    "-X", "-h", $HostName, "-p", "$Port", "-U", $AdminUser, "-d", "postgres",
    "-v", "ON_ERROR_STOP=1", "-c", "DROP DATABASE IF EXISTS $AppDb;"
  ) | Out-Null
  Invoke-ProcessExit -FilePath $psql -Arguments @(
    "-X", "-h", $HostName, "-p", "$Port", "-U", $AdminUser, "-d", "postgres",
    "-v", "ON_ERROR_STOP=1", "-c", "DROP ROLE IF EXISTS $AppUser;"
  ) | Out-Null
  Remove-Item $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue
  Remove-Item Env:GREENCITY_DB_PASSWORD -ErrorAction SilentlyContinue
}