@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title 智芽 · 完整演示

echo.
echo ==========================================
echo   智芽 · AI 数智教育学生端
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 Node.js，请先安装 Node.js 24 或兼容版本。
  pause
  exit /b 1
)

where py >nul 2>nul
if errorlevel 1 (
  where python >nul 2>nul
  if errorlevel 1 (
    echo [错误] 未找到 Python 3，请先安装 Python 3.12 或兼容版本。
    pause
    exit /b 1
  )
)

if not exist "server\.env.local" (
  if exist "server\.env.example" copy /y "server\.env.example" "server\.env.local" >nul
)
if not exist "apps\brain-film\.env" (
  if exist "apps\brain-film\.env.example" copy /y "apps\brain-film\.env.example" "apps\brain-film\.env" >nul
)
if not exist "apps\brain-film\data" mkdir "apps\brain-film\data"

if not exist "node_modules" (
  echo [1/2] 首次运行，正在安装依赖...
  call npm ci --no-audit --no-fund
  if errorlevel 1 (
    echo [错误] 依赖安装失败，请检查网络后重新运行。
    pause
    exit /b 1
  )
)

echo [2/2] 正在启动主应用、两款游戏和 AI 服务...
echo 页面就绪后会自动打开浏览器，请不要关闭本窗口。
echo.

if not defined ZHIYA_NO_BROWSER start "" powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0open-browser.ps1"

call npm run dev
if errorlevel 1 (
  echo.
  echo [错误] 智芽启动失败，请查看上方日志。
  pause
)

