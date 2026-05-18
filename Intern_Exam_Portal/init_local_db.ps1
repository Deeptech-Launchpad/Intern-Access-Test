#Requires -Version 5.1
<#
.SYNOPSIS
    Provision the local PostgreSQL role and database for InternAssess.

.DESCRIPTION
    Reads DB_USER / DB_PASSWORD / DB_NAME / DB_HOST / DB_PORT from backend/.env
    and creates the matching role and database on the local Postgres instance.
    Idempotent — safe to re-run; existing role/db are left alone (password is
    refreshed to match .env). Schema-level grants are applied so PG 15+ works
    out of the box.

.PARAMETER PostgresPassword
    Postgres superuser password. If omitted, you'll be prompted.

.EXAMPLE
    .\init_local_db.ps1
    .\init_local_db.ps1 -PostgresPassword "mySuperuserPwd"
#>

param(
    [string]$PostgresPassword
)

$ErrorActionPreference = 'Stop'

# ── Locate .env ──────────────────────────────────────────────────────────────
$envFile = Join-Path $PSScriptRoot "backend\.env"
if (-not (Test-Path $envFile)) {
    Write-Host "ERROR: Cannot find $envFile" -ForegroundColor Red
    exit 1
}

# ── Parse .env ───────────────────────────────────────────────────────────────
$envVars = @{}
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#=][^=]*)=(.*)$') {
        $envVars[$matches[1].Trim()] = $matches[2].Trim()
    }
}

$dbHost = $envVars['DB_HOST']
$dbPort = $envVars['DB_PORT']
$dbUser = $envVars['DB_USER']
$dbPass = $envVars['DB_PASSWORD']
$dbName = $envVars['DB_NAME']

foreach ($pair in @(@('DB_HOST',$dbHost), @('DB_PORT',$dbPort), @('DB_USER',$dbUser), @('DB_PASSWORD',$dbPass), @('DB_NAME',$dbName))) {
    if ([string]::IsNullOrWhiteSpace($pair[1])) {
        Write-Host "ERROR: $($pair[0]) missing from .env" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "InternAssess - Local Database Bootstrap" -ForegroundColor Cyan
Write-Host "----------------------------------------"
Write-Host "  Host : $dbHost`:$dbPort"
Write-Host "  User : $dbUser"
Write-Host "  DB   : $dbName"
Write-Host ""

# ── Check psql is on PATH ────────────────────────────────────────────────────
$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
    Write-Host "ERROR: psql not found in PATH." -ForegroundColor Red
    Write-Host "       Install PostgreSQL from https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
    Write-Host "       and ensure C:\Program Files\PostgreSQL\<ver>\bin is on PATH." -ForegroundColor Yellow
    exit 1
}

# ── Get postgres superuser password ──────────────────────────────────────────
if (-not $PostgresPassword) {
    $secure = Read-Host "Enter postgres superuser password" -AsSecureString
    $PostgresPassword = [System.Net.NetworkCredential]::new('', $secure).Password
}
$env:PGPASSWORD = $PostgresPassword

# ── Helper: run psql, fail on error, return stdout ───────────────────────────
function Invoke-Psql {
    param(
        [Parameter(Mandatory)] [string]$Database,
        [Parameter(Mandatory)] [string]$Sql,
        [switch]$Quiet
    )
    $args = @('-h', $dbHost, '-p', $dbPort, '-U', 'postgres', '-d', $Database,
              '-v', 'ON_ERROR_STOP=1', '-tAc', $Sql)
    $out = & psql @args 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: psql failed:" -ForegroundColor Red
        Write-Host $out -ForegroundColor Red
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
        exit 1
    }
    if (-not $Quiet -and $out) { Write-Host $out -ForegroundColor DarkGray }
    return $out
}

# ── 1. Role ──────────────────────────────────────────────────────────────────
$dbPassEscaped = $dbPass.Replace("'", "''")
$userExists = Invoke-Psql -Database 'postgres' -Quiet `
    -Sql "SELECT 1 FROM pg_roles WHERE rolname='$dbUser';"

if ("$userExists".Trim() -eq '1') {
    Invoke-Psql -Database 'postgres' -Quiet `
        -Sql "ALTER ROLE $dbUser WITH LOGIN PASSWORD '$dbPassEscaped';"
    Write-Host "[OK] Role '$dbUser' already exists - password synced" -ForegroundColor Green
} else {
    Invoke-Psql -Database 'postgres' -Quiet `
        -Sql "CREATE ROLE $dbUser LOGIN PASSWORD '$dbPassEscaped';"
    Write-Host "[OK] Role '$dbUser' created" -ForegroundColor Green
}

# ── 2. Database ──────────────────────────────────────────────────────────────
$dbExists = Invoke-Psql -Database 'postgres' -Quiet `
    -Sql "SELECT 1 FROM pg_database WHERE datname='$dbName';"

if ("$dbExists".Trim() -eq '1') {
    Write-Host "[OK] Database '$dbName' already exists" -ForegroundColor Green
} else {
    Invoke-Psql -Database 'postgres' -Quiet `
        -Sql "CREATE DATABASE $dbName OWNER $dbUser;"
    Write-Host "[OK] Database '$dbName' created" -ForegroundColor Green
}

# ── 3. Grants (PG 15+ needs explicit schema-level grants) ────────────────────
Invoke-Psql -Database 'postgres' -Quiet `
    -Sql "GRANT ALL PRIVILEGES ON DATABASE $dbName TO $dbUser;"
Invoke-Psql -Database $dbName -Quiet `
    -Sql "GRANT ALL ON SCHEMA public TO $dbUser; ALTER SCHEMA public OWNER TO $dbUser;"
Write-Host "[OK] Privileges granted on '$dbName' / schema public" -ForegroundColor Green

# ── 4. Smoke-test: connect as the new role ───────────────────────────────────
$env:PGPASSWORD = $dbPass
$ping = & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -tAc "SELECT 'pong';" 2>&1
if ($LASTEXITCODE -eq 0 -and "$ping".Trim() -eq 'pong') {
    Write-Host "[OK] Smoke-test passed - '$dbUser' can connect to '$dbName'" -ForegroundColor Green
} else {
    Write-Host "WARNING: smoke-test failed:" -ForegroundColor Yellow
    Write-Host $ping -ForegroundColor Yellow
}

Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Done. Tables will auto-create on first backend start." -ForegroundColor Cyan
Write-Host "Next:  cd backend ; python main.py" -ForegroundColor Cyan
Write-Host ""
