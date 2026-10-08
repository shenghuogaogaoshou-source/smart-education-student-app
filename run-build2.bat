@echo off
set "PATH=D:\Program Files\nodejs;D:\Program Files\nodejs\node_modules\.bin;%PATH%"
cd /d "c:\Users\lx\Documents\xwechat_files\wxid_1x5t9o0vcbri22_586c\msg\file\2026-08\数智教育学生端初版(3)\数智教育学生端初版"
echo ==== PATH CHECK ====
where node
where npm
echo ==== RUN TSC ====
node node_modules\typescript\bin\tsc -b
echo TSC_EXIT=%ERRORLEVEL%
if %ERRORLEVEL%==0 (
  echo ==== RUN VITE ====
  node node_modules\vite\bin\vite.js build
  echo VITE_EXIT=%ERRORLEVEL%
)
echo ==== ALL DONE ====
dir dist\index.html
pause
