param([switch]$BackendOnly)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$gcc = 'C:\msys64\ucrt64\bin\gcc.exe'
$pg = 'C:\Program Files\PostgreSQL\18'
# Keep compiler scratch files and npm cache on the project drive.
$buildTemp = Join-Path $root '.local\build-temp'
$npmCache = Join-Path $root '.local\npm-cache'
New-Item -ItemType Directory -Force $buildTemp, $npmCache | Out-Null
$previousEnvironment = @{}
foreach ($name in @('TEMP', 'TMP', 'TMPDIR', 'npm_config_cache', 'PATH')) {
 $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}
try {
 $env:TEMP = $buildTemp
 $env:TMP = $buildTemp
 $env:TMPDIR = $buildTemp
 $env:npm_config_cache = $npmCache
$env:PATH = "C:\msys64\ucrt64\bin;$pg\bin;$env:PATH"
$common = @("$root\backend\src\similarity.c", "$root\backend\src\hashtable.c", "$root\backend\src\linkedlist.c", "$root\backend\src\component.c", "$root\backend\src\queue.c", "$root\backend\src\song.c")
New-Item -ItemType Directory -Force "$root\backend\bin" | Out-Null
& $gcc -std=c11 -Wall -Wextra -Werror -O2 "-I$pg\include" "$root\backend\src\service.c" "$root\backend\src\engine.c" "$root\backend\src\algorithms.c" @common "$pg\lib\libpq.lib" -lm -o "$root\backend\bin\musicstruct.exe"
if ($LASTEXITCODE -ne 0) { throw 'C service build failed' }
& $gcc -std=c11 -Wall -Wextra -Werror -O2 "$root\backend\src\main.c" @common -lm -o "$root\backend\bin\musicstruct-cli.exe"
if ($LASTEXITCODE -ne 0) { throw 'C terminal build failed' }
& $gcc -std=c11 -Wall -Wextra -Werror -O2 "$root\backend\src\audio.c" -lm -o "$root\backend\bin\audio-analyze.exe"
if ($LASTEXITCODE -ne 0) { throw 'Audio analyzer build failed' }
if ($BackendOnly) { return }
Push-Location "$root\frontend"
try {
 if (-not (Test-Path 'node_modules\vite\package.json')) {
  & npm.cmd ci
  if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed' }
 }
 & npm.cmd run build
 if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
} finally { Pop-Location }


} finally {
 foreach ($name in $previousEnvironment.Keys) {
  [Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name], 'Process')
 }
}
