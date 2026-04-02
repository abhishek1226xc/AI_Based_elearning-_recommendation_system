param(
    [Parameter(Mandatory = $true)]
    [string]$MlDir,

    [int]$MlPort = 8010
)

$ErrorActionPreference = 'Stop'

Set-Location $MlDir
$env:ML_PORT = "$MlPort"

$venvPython = Join-Path $MlDir '.venv\Scripts\python.exe'
if (-not (Test-Path $venvPython)) {
    Write-Host "[INFO] Creating Python virtual environment (first run)..."
    python -m venv (Join-Path $MlDir '.venv')
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create Python virtual environment."
    }

    Write-Host "[INFO] Installing Python dependencies (first run)..."
    & $venvPython -m pip install --upgrade pip
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to upgrade pip."
    }

    & $venvPython -m pip install -r (Join-Path $MlDir 'requirements.txt')
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to install Python dependencies."
    }
}

& $venvPython main.py
