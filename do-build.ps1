$ErrorActionPreference = 'Continue'
$dir = 'c:\Users\lx\Documents\xwechat_files\wxid_1x5t9o0vcbri22_586c\msg\file\2026-08\数智教育学生端初版(3)\数智教育学生端初版'
Set-Location $dir
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
Write-Host "Node path: $(where.exe node 2>&1)"
Write-Host "Running npm run build..."
& npm run build 2>&1 | Out-File -FilePath "$dir\build-log.txt" -Encoding utf8
Write-Host "Build exit code: $LASTEXITCODE"
Write-Host "Done."
if (Test-Path "$dir\dist\index.html") {
    Write-Host "SUCCESS: dist/index.html exists"
} else {
    Write-Host "FAIL: dist/index.html not found"
}
Read-Host "Press Enter to close"
