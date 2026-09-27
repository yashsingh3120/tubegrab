@echo off
title TubeGrab - YouTube Video Downloader
echo ==============================================================
echo  Starting TubeGrab Server...
echo ==============================================================
cd /d "%~dp0"

IF EXIST ".venv\Scripts\python.exe" (
    start http://127.0.0.1:5000
    ".venv\Scripts\python.exe" app.py
) ELSE (
    echo [ERROR] Virtual environment not found. Please run:
    echo python -m venv .venv
    echo .venv\Scripts\pip install -r requirements.txt
    pause
)
