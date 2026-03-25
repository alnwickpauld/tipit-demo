$ErrorActionPreference = "SilentlyContinue"

$root = Split-Path -Parent $PSScriptRoot
$pgsqlBin = Join-Path $root ".tools\pgsql\bin"
$dataDir = Join-Path $root ".postgres-data"

Get-Process node | Where-Object { $_.Path -like "*Tipit*" } | Stop-Process -Force

if (Test-Path $pgsqlBin) {
  & (Join-Path $pgsqlBin "pg_ctl.exe") -D $dataDir stop | Out-Null
}
