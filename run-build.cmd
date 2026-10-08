@echo off
set "PATH=D:\Program Files\nodejs;%PATH%"
cd /d "c:\Users\lx\Documents\xwechat_files\wxid_1x5t9o0vcbri22_586c\msg\file\2026-08\数智教育学生端初版(3)\数智教育学生端初版"
call npm run build
echo.
echo Build done with exit code %ERRORLEVEL%
pause
