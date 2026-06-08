@echo off
cd /d "%~dp0.."
echo PDF 교정 개발 서버 시작...
echo.
echo   http://localhost:5173
echo   http://127.0.0.1:5173
echo.
start "" "http://localhost:5173/"
npm run dev
