@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  ============================================
echo   脑洞放映厅 · 手机模式
echo   手机/平板和这台电脑连同一个 Wi-Fi,
echo   用浏览器打开下面打印的地址即可。
echo  ============================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0launch.ps1" -Lan
pause
