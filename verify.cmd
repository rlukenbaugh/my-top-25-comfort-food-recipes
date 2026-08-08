@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo Run build.cmd first so the project environment is available.
  exit /b 1
)

".venv\Scripts\python.exe" verify_book.py
exit /b %errorlevel%
