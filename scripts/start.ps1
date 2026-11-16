param([switch]$SkipBuild)
$ErrorActionPreference='Stop'
if (-not $SkipBuild) { & "$PSScriptRoot\build.ps1" }
& node "$PSScriptRoot\run-local.mjs"
if ($LASTEXITCODE -ne 0) { throw 'MusicStruct could not start. See the message above.' }
