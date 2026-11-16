$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$pg='C:\Program Files\PostgreSQL\18\bin'
$env:PATH="C:\msys64\ucrt64\bin;$pg;$env:PATH"
$testPort=if($env:MUSICSTRUCT_TEST_PORT){$env:MUSICSTRUCT_TEST_PORT}else{'55432'}
$sources=Get-ChildItem "$root\backend\src\*.c" | Where-Object { $_.Name -notin @('main.c','service.c','engine.c','audio.c') } | ForEach-Object FullName
& 'C:\msys64\ucrt64\bin\gcc.exe' -std=c11 -Wall -Wextra -Werror "$root\tests\backend.c" @sources -lm -o "$root\backend\bin\backend-test.exe"
if ($LASTEXITCODE -ne 0) { throw 'Test compilation failed' }
& "$root\backend\bin\backend-test.exe"
if ($LASTEXITCODE -ne 0) { throw 'Backend regression failed' }
$testName='musicstruct_test_'+[guid]::NewGuid().ToString('N')
& "$pg\createdb.exe" -h 127.0.0.1 -p $testPort -U musicstruct $testName
if ($LASTEXITCODE -ne 0) { throw 'Start the local database before running integration tests' }
$prior=$env:MUSICSTRUCT_DATABASE_URL
try {
 $env:MUSICSTRUCT_DATABASE_URL="host=127.0.0.1 port=$testPort user=musicstruct dbname=$testName connect_timeout=5"
 & node "$root\tests\integration.mjs"
 if ($LASTEXITCODE -ne 0) { throw 'Integration tests failed' }
} finally {
 $env:MUSICSTRUCT_DATABASE_URL=$prior
 & "$pg\dropdb.exe" -h 127.0.0.1 -p $testPort -U musicstruct $testName
}
