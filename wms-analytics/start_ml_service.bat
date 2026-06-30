@echo off
echo ====================================
echo  WMS ML Prediction Service Launcher
echo ====================================
echo.

cd /d "%~dp0"

echo Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.8 or higher
    pause
    exit /b 1
)

echo Python found!
echo.

echo Checking required packages...
pip show flask >nul 2>&1
if errorlevel 1 (
    echo Installing required packages...
    pip install -r requirements.txt
) else (
    echo Packages already installed
)

echo.
echo Checking for trained models...
if not exist "model1_price_prediction_BEST.pkl" (
    echo WARNING: Price prediction model not found!
    echo Please run price_prediction.ipynb to train the model
)
if not exist "model2_profit_classification_BEST.pkl" (
    echo WARNING: Profit classification model not found!
    echo Please run profit_classification.ipynb to train the model
)
if not exist "model3_storage_duration_BEST.pkl" (
    echo WARNING: Storage duration model not found!
    echo Please run storage_duration.ipynb to train the model
)

echo.
echo ====================================
echo  Starting ML API Service...
echo  Server will run on http://localhost:8050
echo ====================================
echo.
echo Press Ctrl+C to stop the service
echo.

python ml_api_service.py

pause
