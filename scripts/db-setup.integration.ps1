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
  if ($Actual -ne $Expected) { throw "$Message (exit $Actual, expected $Expected)" }
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

try {
  Assert-Equal (Invoke-SetupExit $AdminPassword $quotedPassword) 0 "quoted password setup failed"
  Assert-SecretAbsentFromLogs $quotedPassword
  Assert-Equal (Test-AppLogin $quotedPassword) 0 "quoted password login failed"

  Assert-Equal (Invoke-SetupExit $AdminPassword $rotatedPassword) 0 "password rotation setup failed"
  Assert-SecretAbsentFromLogs $rotatedPassword
  Assert-Equal (Test-AppLogin $rotatedPassword) 0 "rotated password login failed"
  Assert-NonZero (Test-AppLogin $quotedPassword) "old password remained valid after rotation"

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