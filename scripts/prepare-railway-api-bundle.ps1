[CmdletBinding()]
param(
  [string]$BundleDir = '.tmp-railway-api-bundle'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$bundlePath = Join-Path $repoRoot $BundleDir

if (Test-Path $bundlePath) {
  Remove-Item -Path $bundlePath -Recurse -Force
}

New-Item -ItemType Directory -Path $bundlePath -Force | Out-Null

$filesToCopy = @(
  '.railwayignore',
  'Dockerfile.api',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'railway.json',
  'tsconfig.base.json'
)

foreach ($relativePath in $filesToCopy) {
  $sourcePath = Join-Path $repoRoot $relativePath
  $destinationPath = Join-Path $bundlePath $relativePath
  $destinationParent = Split-Path -Parent $destinationPath

  if ($destinationParent -and -not (Test-Path $destinationParent)) {
    New-Item -ItemType Directory -Path $destinationParent -Force | Out-Null
  }

  Copy-Item -Path $sourcePath -Destination $destinationPath -Force
}

$directoriesToCopy = @(
  'apps/api',
  'packages/shared',
  'packages/prompts'
)

$excludedDirectories = @(
  'node_modules',
  'dist',
  '.next',
  '.turbo',
  '.pnpm-store',
  'coverage'
)

$excludedFiles = @(
  '.env',
  '.env.local',
  '*.log',
  'dev.db'
)

foreach ($relativePath in $directoriesToCopy) {
  $sourcePath = Join-Path $repoRoot $relativePath
  $destinationPath = Join-Path $bundlePath $relativePath

  New-Item -ItemType Directory -Path $destinationPath -Force | Out-Null

  $robocopyArgs = @(
    $sourcePath,
    $destinationPath,
    '/E',
    '/NFL',
    '/NDL',
    '/NJH',
    '/NJS',
    '/NC',
    '/NS'
  )

  foreach ($directoryName in $excludedDirectories) {
    $robocopyArgs += '/XD'
    $robocopyArgs += $directoryName
  }

  foreach ($filePattern in $excludedFiles) {
    $robocopyArgs += '/XF'
    $robocopyArgs += $filePattern
  }

  & robocopy @robocopyArgs | Out-Null

  if ($LASTEXITCODE -gt 7) {
    throw "robocopy failed for $relativePath with exit code $LASTEXITCODE"
  }
}

Write-Host "Prepared Railway API bundle at $bundlePath"
