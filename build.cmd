@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  py -3 -m venv .venv
  if errorlevel 1 goto :error
)

".venv\Scripts\python.exe" -m pip install --disable-pip-version-check -r requirements.txt
if errorlevel 1 goto :error

".venv\Scripts\python.exe" build_recipe_book.py
if errorlevel 1 goto :error

echo.
echo Recipe book built successfully.
echo Open the outputs folder to view the PDF.
exit /b 0

:error
echo.
echo Build failed. Review the message above.
exit /b 1
