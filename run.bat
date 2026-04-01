@echo off
setlocal
echo ========================================================
echo     Starting AI E-Learning Recommendation System...
echo ========================================================
echo.

set "APP_DIR=%~dp0AI_Based_elearning-_recommendation_system-main"
set "PYTHON_ML_DIR=%APP_DIR%\python-ml"
set "ML_START_SCRIPT=%~dp0start-ml.ps1"
set "ML_PORT=8010"
set "ML_URL=http://127.0.0.1:%ML_PORT%"

if not exist "%APP_DIR%\package.json" (
	echo [ERROR] Project package.json not found in "%APP_DIR%"
	exit /b 1
)

if not exist "%PYTHON_ML_DIR%\main.py" (
	echo [ERROR] Python ML service entrypoint not found in "%PYTHON_ML_DIR%"
	exit /b 1
)

if not exist "%ML_START_SCRIPT%" (
	echo [ERROR] ML launcher script not found at "%ML_START_SCRIPT%"
	exit /b 1
)

netstat -ano | findstr ":%ML_PORT%" >nul
if errorlevel 1 (
	echo [INFO] Starting Python ML microservice on port %ML_PORT%...
	start "Python ML Service" powershell -NoExit -ExecutionPolicy Bypass -File "%ML_START_SCRIPT%" -MlDir "%PYTHON_ML_DIR%" -MlPort %ML_PORT%
	rem Give the ML process a moment to bind and print startup logs.
	timeout /t 2 /nobreak >nul
) else (
	echo [INFO] Python ML microservice already running on port %ML_PORT%.
)

pushd "%APP_DIR%"

set "PYTHON_ML_URL=%ML_URL%"

echo [INFO] Starting Node development server on port 3000...
echo [INFO] Using ML endpoint %PYTHON_ML_URL%
npm run dev
set "EXIT_CODE=%ERRORLEVEL%"

popd
exit /b %EXIT_CODE%
