param(
  # -Lan:让同一 Wi-Fi 下的手机/平板也能玩(启动手机模式.cmd 就是带这个参数跑的)
  [switch]$Lan
)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$apiPort = 8766
$webPort = 5174
$apiHealth = "http://127.0.0.1:$apiPort/api/health"
$bindHost = if ($Lan) { '0.0.0.0' } else { '127.0.0.1' }

function Test-ListeningPort([int]$Port) {
  return $null -ne (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1)
}

if (-not (Test-ListeningPort $apiPort)) {
  $python = Get-Command py.exe -ErrorAction SilentlyContinue
  # --lan 让后端绑到 0.0.0.0;只开本机时用 --host 127.0.0.1
  $apiArgs = if ($Lan) { @('-3', 'server.py', '--lan', '--port', $apiPort) } else { @('-3', 'server.py', '--host', '127.0.0.1', '--port', $apiPort) }
  $apiArgsPlain = if ($Lan) { @('server.py', '--lan', '--port', $apiPort) } else { @('server.py', '--host', '127.0.0.1', '--port', $apiPort) }
  if ($python) {
    Start-Process -FilePath $python.Source -ArgumentList $apiArgs -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
  } else {
    Start-Process -FilePath python.exe -ArgumentList $apiArgsPlain -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
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
  $viteArgs = @('run', 'dev', '--', '--host', $bindHost, '--port', $webPort)
  Start-Process -FilePath npm.cmd -ArgumentList $viteArgs -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
}

for ($attempt = 0; $attempt -lt 30; $attempt++) {
  if (Test-ListeningPort $webPort) { break }
  Start-Sleep -Milliseconds 300
}
if (-not (Test-ListeningPort $webPort)) {
  throw '网页没有启动，请确认已运行 npm install 后再试。'
}

if ($Lan) {
  $lanIp = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
    Select-Object -First 1).IPAddress
  Write-Host ''
  Write-Host '  ============================================'
  Write-Host '   手机模式已开启:手机连同一个 Wi-Fi,用浏览器打开'
  if ($lanIp) { Write-Host "     http://${lanIp}:$webPort/" } else { Write-Host "     http://<这台电脑的局域网 IP>:$webPort/" }
  Write-Host '   (电脑上仍然用 http://127.0.0.1:5174/)'
  Write-Host '  ============================================'
  Write-Host ''
}

Start-Process "http://127.0.0.1:$webPort/"
