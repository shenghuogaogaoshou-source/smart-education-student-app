@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  ==========================================
echo   脑洞放映厅 · 打包安卓 App(APK)
echo   需要已安装 Android SDK 到 E:\android-sdk
echo  ==========================================
echo.
bash build.sh
echo.
echo  APK 就在本文件夹:脑洞放映厅.apk
pause
