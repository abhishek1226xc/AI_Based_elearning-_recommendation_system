param(
    [Parameter(Mandatory = $true)]
    [string]$MlDir,

    [int]$MlPort = 8010
)

$ErrorActionPreference = 'Stop'

Set-Location $MlDir
$env:ML_PORT = "$MlPort"

$venvPython = Join-Path $MlDir '.venv\Scripts\python.exe'
if (Test-Path $venvPython) {
    & $venvPython main.py
} else {
    python main.py
}
