[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [string]$Service = 'api',
  [string]$Environment = 'production',
  [string]$BundleDir = '.tmp-railway-api-bundle',
  [switch]$PrepareOnly
)

$ErrorActionPreference = 'Stop'

if (Test-Path Env:RAILWAY_API_TOKEN) {
  $token = $env:RAILWAY_API_TOKEN
  $authVariable = 'RAILWAY_API_TOKEN'
} elseif (Test-Path Env:RAILWAY_TOKEN) {
  $token = $env:RAILWAY_TOKEN
  $authVariable = 'RAILWAY_TOKEN'
} else {
  throw 'Set RAILWAY_API_TOKEN or RAILWAY_TOKEN before deploying.'
}

$prepareScript = Join-Path $PSScriptRoot 'prepare-railway-api-bundle.ps1'
& $prepareScript -BundleDir $BundleDir

if ($PrepareOnly) {
  return
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$bundlePath = Join-Path $repoRoot $BundleDir
$previousApiToken = $env:RAILWAY_API_TOKEN
$previousToken = $env:RAILWAY_TOKEN
$hadApiToken = Test-Path Env:RAILWAY_API_TOKEN
$hadToken = Test-Path Env:RAILWAY_TOKEN

if ($authVariable -eq 'RAILWAY_API_TOKEN') {
  $env:RAILWAY_API_TOKEN = $token
  Remove-Item Env:RAILWAY_TOKEN -ErrorAction SilentlyContinue
} else {
  $env:RAILWAY_TOKEN = $token
  Remove-Item Env:RAILWAY_API_TOKEN -ErrorAction SilentlyContinue
}

Push-Location $bundlePath

try {
  npx @railway/cli up . --path-as-root -p $ProjectId -e $Environment -s $Service --ci
} finally {
  Pop-Location

  if ($hadApiToken) {
    $env:RAILWAY_API_TOKEN = $previousApiToken
  } else {
    Remove-Item Env:RAILWAY_API_TOKEN -ErrorAction SilentlyContinue
  }

  if ($hadToken) {
    $env:RAILWAY_TOKEN = $previousToken
  } else {
    Remove-Item Env:RAILWAY_TOKEN -ErrorAction SilentlyContinue
  }
}
