$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$apiPort = 8766
$webPort = 5174
$apiHealth = "http://127.0.0.1:$apiPort/api/health"

function Test-ListeningPort([int]$Port) {
  return $null -ne (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1)
}

if (-not (Test-ListeningPort $apiPort)) {
  $python = Get-Command py.exe -ErrorAction SilentlyContinue
  if ($python) {
    Start-Process -FilePath $python.Source -ArgumentList '-3', 'server.py', '--host', '127.0.0.1', '--port', $apiPort -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
  } else {
    Start-Process -FilePath python.exe -ArgumentList 'server.py', '--host', '127.0.0.1', '--port', $apiPort -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
  }
}

$apiReady = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
  try {
    if ((Invoke-WebRequest -Uri $apiHealth -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200) {
      $apiReady = $true
      break
    }
  } catch {}
  Start-Sleep -Milliseconds 300
}
if (-not $apiReady) {
  throw '本机创作服务没有启动，请确认 Python 已安装后再试。'
}

if (-not (Get-NetTCPConnection -LocalPort $webPort -State Listen -ErrorAction SilentlyContinue)) {
  # npm.cmd run dev is deliberately launched in a separate hidden process.
  $viteArgs = @('run', 'dev', '--', '--host', '127.0.0.1', '--port', $webPort)
  Start-Process -FilePath npm.cmd -ArgumentList $viteArgs -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
}

for ($attempt = 0; $attempt -lt 30; $attempt++) {
  if (Test-ListeningPort $webPort) { break }
  Start-Sleep -Milliseconds 300
}
if (-not (Test-ListeningPort $webPort)) {
  throw '网页没有启动，请确认已运行 npm install 后再试。'
}

Start-Process "http://127.0.0.1:$webPort/"
