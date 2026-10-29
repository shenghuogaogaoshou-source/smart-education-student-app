@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title 智芽 · 完整演示

if not exist "%~dp0launcher\start.ps1" (
  echo [错误] 启动器文件不完整，请重新解压完整演示包。
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0launcher\start.ps1"
set "ZHIYA_EXIT_CODE=%ERRORLEVEL%"
if not "%ZHIYA_EXIT_CODE%"=="0" (
  echo.
  echo [错误] 智芽启动失败，请查看上方提示。
  pause
)
exit /b %ZHIYA_EXIT_CODE%

