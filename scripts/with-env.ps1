#Requires -Version 5.1
<#
.SYNOPSIS
  Load the repository-root .env into the environment, then run one of the db-*.ps1 scripts.
.DESCRIPTION
  The db-*.ps1 scripts read credentials from $env:* inside their param() defaults, and those
  bind before any statement in the script body runs. Dot-sourcing a loader from db-common.ps1
  is therefore too late. Loading .env here, in the parent process before the child script is
  invoked, is the ordering that works without editing the reviewed db scripts.

  Existing environment variables always win, matching dotenv override:false in the API.
  Values are never echoed.

  Takes the script name only — it forwards no arguments, and rejects any that are passed
  rather than silently dropping them. The db scripts are configured through the environment,
  which .env now supplies. To pass parameters explicitly, invoke the db script directly.
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/with-env.ps1 db-verify.ps1
#>
param(
  [Parameter(Mandatory = $true)][string]$Script
)

$ErrorActionPreference = "Stop"

# ponytail: repository-root .env only, no parent-directory lookup — same rule as
# apps/api/src/config/paths.ts. A worktree without its own .env still needs env exported
# manually; copying secrets into worktrees is the wrong upgrade path.
$envPath = Join-Path (Split-Path -Parent $PSScriptRoot) ".env"

if (Test-Path -LiteralPath $envPath) {
  foreach ($line in Get-Content -LiteralPath $envPath) {
    if ($line -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') { continue }
    $name = $Matches[1]
    $value = $Matches[2].Trim()
    if (Test-Path -LiteralPath "env:$name") { continue }
    if ($value -match '^"(.*)"$' -or $value -match "^'(.*)'$") { $value = $Matches[1] }
    Set-Item -LiteralPath "env:$name" -Value $value
  }
}

$target = Join-Path $PSScriptRoot $Script
if (-not (Test-Path -LiteralPath $target)) {
  throw "Script not found: $target"
}

& $target
if ($LASTEXITCODE) { exit $LASTEXITCODE }
