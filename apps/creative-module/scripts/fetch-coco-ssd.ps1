# ============================================================
# fetch-coco-ssd.ps1 —— 一次性下载 COCO-SSD (lite_mobilenet_v2) 模型到本地
#
# 用途：
#   国内网络无法访问 Google Storage 时，先在可访问的网络环境（如挂 VPN）
#   运行本脚本一次，把 model.json + 权重分片下载到 public/models/coco-ssd/。
#   之后应用会优先从本地加载，永久离线可用，不再依赖外网。
#
# 用法：
#   pwsh ./scripts/fetch-coco-ssd.ps1                 # 默认从官方 GCS 下载
#   pwsh ./scripts/fetch-coco-ssd.ps1 -Mirror <url>   # 从自定义镜像下载（url 指向 model.json 所在目录）
#
# 示例（自定义镜像，model.json 在该目录下）：
#   pwsh ./scripts/fetch-coco-ssd.ps1 -Mirror https://your-mirror.com/coco-ssd/
# ============================================================
param(
  [string]$Source = "https://storage.googleapis.com/tfjs-models/savedmodel/ssdlite_mobilenet_v2/"
)

$ErrorActionPreference = "Stop"

# 目标目录（项目根/public/models/coco-ssd）
$root = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $root "public\models\coco-ssd"
New-Item -ItemType Directory -Force -Path $dest | Out-Null

# 规范化源地址（确保以 / 结尾）
if (-not $Source.EndsWith("/")) { $Source = "$Source/" }

$modelJsonUrl = "$Source`model.json"
$modelJsonPath = Join-Path $dest "model.json"

function Get-FileWithRetry {
  param([string]$Url, [string]$OutPath, [int]$Retries = 3)
  for ($i = 1; $i -le $Retries; $i++) {
    try {
      Write-Host "  [$i/$Retries] 下载 $Url ..."
      Invoke-WebRequest -Uri $Url -OutFile $OutPath -TimeoutSec 60 -UseBasicParsing
      return $true
    } catch {
      Write-Warning "  失败: $($_.Exception.Message)"
      Start-Sleep -Seconds 2
    }
  }
  return $false
}

Write-Host "==> 目标目录: $dest"
Write-Host "==> 模型源  : $Source"

# 1) 下载 model.json
Write-Host "`n[1/2] 下载 model.json ..."
if (-not (Get-FileWithRetry -Url $modelJsonUrl -OutPath $modelJsonPath)) {
  Write-Error "model.json 下载失败。请检查网络/源地址，或挂载可访问 GCS 的网络后重试。"
  exit 1
}

# 2) 解析权重分片路径并逐个下载
Write-Host "`n[2/2] 解析并下载权重分片 ..."
$model = Get-Content $modelJsonPath -Raw | ConvertFrom-Json
$paths = @()
foreach ($entry in $model.weightsManifest) {
  foreach ($p in $entry.paths) { $paths += $p }
}

if ($paths.Count -eq 0) {
  Write-Warning "model.json 中未找到权重分片路径，可能格式异常。"
  exit 1
}

Write-Host "  发现 $($paths.Count) 个分片。"
$allOk = $true
foreach ($p in $paths) {
  $url = "$Source$p"
  $out = Join-Path $dest $p
  if (-not (Get-FileWithRetry -Url $url -OutPath $out)) {
    $allOk = $false
  }
}

if (-not $allOk) {
  Write-Error "部分分片下载失败，请重试本脚本。"
  exit 1
}

Write-Host "`n=============================================="
Write-Host "完成！模型已保存到: $dest" -ForegroundColor Green
Write-Host "文件清单:"
Get-ChildItem $dest | ForEach-Object { Write-Host ("  {0,-40} {1,8} KB" -f $_.Name, [math]::Round($_.Length/1KB,1)) }
Write-Host "`n现在运行 'npm run dev'，目标检测模块会自动从本地加载。"
Write-Host "=============================================="
