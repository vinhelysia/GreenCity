#Requires -Version 5.1
# Shared helpers for GreenCity native PostgreSQL scripts (sourced by other scripts).

function Resolve-PgBin {
  param([string]$PgBin)
  if ($PgBin -and (Test-Path (Join-Path $PgBin "psql.exe"))) { return $PgBin }
  foreach ($c in @(
      "C:\Program Files\PostgreSQL\16\bin",
      "C:\Program Files\PostgreSQL\17\bin",
      "C:\Program Files\PostgreSQL\15\bin",
      "C:\Program Files\PostgreSQL\18\bin"
    )) {
    if (Test-Path (Join-Path $c "psql.exe")) { return $c }
  }
  throw "psql.exe not found. Install PostgreSQL and set -PgBin or PG_BIN."
}

function Assert-PgIdentifier {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [string]$Label = "identifier"
  )
  if ($Name -notmatch '^[A-Za-z_][A-Za-z0-9_]{0,62}$') {
    throw "Invalid $Label '$Name'. Use letters, digits, underscore; start with letter/underscore."
  }
}

function Invoke-Psql {
  param(
    [Parameter(Mandatory = $true)][string]$PsqlPath,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [string]$FailureMessage = "psql failed",
    [string]$InputSql
  )

  if ($PSBoundParameters.ContainsKey("InputSql")) {
    $InputSql | & $PsqlPath @Arguments
  } else {
    & $PsqlPath @Arguments
  }

  if ($LASTEXITCODE -ne 0) {
    throw "$FailureMessage (exit $LASTEXITCODE)"
  }
}

function Require-EnvSecret {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Value
  )
  if ([string]::IsNullOrWhiteSpace($Value)) {
    throw "Missing required credential: set $Name (do not pass secrets on the command line when avoidable)."
  }
}
