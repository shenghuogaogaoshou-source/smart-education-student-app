$ErrorActionPreference = 'Stop'
$dir = 'c:\Users\lx\Documents\xwechat_files\wxid_1x5t9o0vcbri22_586c\msg\file\2026-08\数智教育学生端初版(3)\数智教育学生端初版'
Set-Location $dir
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
Write-Host "PATH: $($env:Path.Substring(0, [Math]::Min(200, $env:Path.Length)))..."
Write-Host "Running tsc..."
& node node_modules\typescript\bin\tsc -b 2>&1
Write-Host "tsc exit: $LASTEXITCODE"
if ($LASTEXITCODE -eq 0) {
    Write-Host "Running vite build..."
    & node node_modules\vite\bin\vite.js build 2>&1
    Write-Host "vite exit: $LASTEXITCODE"
}
Write-Host "DONE. Press Enter."
Read-Host
