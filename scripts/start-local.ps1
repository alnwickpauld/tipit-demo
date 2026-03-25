$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$nodeDir = Join-Path $root ".tools\node"
$pgsqlBin = Join-Path $root ".tools\pgsql\bin"
$dataDir = Join-Path $root ".postgres-data"
$postgresLog = Join-Path $root ".postgres.log"

if (!(Test-Path $nodeDir)) {
  throw "Portable Node.js was not found in .tools\node."
}

if (!(Test-Path $pgsqlBin)) {
  throw "Portable PostgreSQL was not found in .tools\pgsql."
}

$env:Path = "$nodeDir;$pgsqlBin;$env:Path"

$ready = & (Join-Path $pgsqlBin "pg_isready.exe") -h 127.0.0.1 -p 5433 2>$null
if ($LASTEXITCODE -ne 0) {
  & (Join-Path $pgsqlBin "pg_ctl.exe") -D $dataDir -l $postgresLog start | Out-Null
  Start-Sleep -Seconds 3
}

Push-Location $root
try {
  & (Join-Path $nodeDir "npm.cmd") run dev
}
finally {
  Pop-Location
}
