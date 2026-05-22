@echo off
cd /d "%~dp0.."
powershell -ExecutionPolicy Bypass -File scripts\Fix-Browser-Access.ps1
pause
