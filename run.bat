@echo off
setlocal
echo ========================================================
echo     Starting AI E-Learning Recommendation System...
echo ========================================================
echo.

set "APP_DIR=%~dp0AI_Based_elearning-_recommendation_system-main"
set "PYTHON_ML_DIR=%APP_DIR%\python-ml"
set "PYTHON_REQ_FILE=%PYTHON_ML_DIR%\requirements.txt"
set "ML_START_SCRIPT=%~dp0start-ml.ps1"
set "ML_PORT=8010"
set "ML_URL=http://127.0.0.1:%ML_PORT%"
set "DB_FILE=%APP_DIR%\data\elearning.db"

if not exist "%APP_DIR%\package.json" (
	echo [ERROR] Project package.json not found in "%APP_DIR%"
	exit /b 1
)

if not exist "%PYTHON_ML_DIR%\main.py" (
	echo [ERROR] Python ML service entrypoint not found in "%PYTHON_ML_DIR%"
	exit /b 1
)

if not exist "%PYTHON_REQ_FILE%" (
	echo [ERROR] Python requirements.txt not found in "%PYTHON_ML_DIR%"
	exit /b 1
)

if not exist "%ML_START_SCRIPT%" (
	echo [ERROR] ML launcher script not found at "%ML_START_SCRIPT%"
	exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
	echo [ERROR] npm is not installed or not in PATH.
	exit /b 1
)

where python >nul 2>nul
if errorlevel 1 (
	echo [ERROR] Python is not installed or not in PATH.
	exit /b 1
)

pushd "%APP_DIR%"

if not exist "%APP_DIR%\node_modules" (
	echo [INFO] Installing Node dependencies ^(first run^)...
	npm install
	if errorlevel 1 (
		echo [ERROR] Failed to install Node dependencies.
		popd
		exit /b 1
	)
)

if not exist "%DB_FILE%" (
	echo [INFO] Initializing database ^(first run^)...
	npm run db:init
	if errorlevel 1 (
		echo [ERROR] Failed to initialize database.
		popd
		exit /b 1
	)
	echo [INFO] Seeding database ^(first run^)...
	npm run seed
	if errorlevel 1 (
		echo [ERROR] Failed to seed database.
		popd
		exit /b 1
	)
)

popd

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
