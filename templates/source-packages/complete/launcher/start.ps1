$ErrorActionPreference = 'Stop'

$packageRoot = Split-Path -Parent $PSScriptRoot
$projectRoot = Join-Path $packageRoot 'project'
$nodeRoot = Join-Path $packageRoot 'runtime\node'
$nodeExe = Join-Path $nodeRoot 'node.exe'
$pythonExe = Join-Path $packageRoot 'runtime\python\python.exe'
$ffmpegRoot = Join-Path $packageRoot 'runtime\ffmpeg'

. (Join-Path $PSScriptRoot 'process-manager.ps1')
. (Join-Path $PSScriptRoot 'health-check.ps1')

$ports = @(5173, 5191, 5192, 8766, 8787)
$endpoints = @(
    'http://127.0.0.1:5173/',
    'http://127.0.0.1:5191/',
    'http://127.0.0.1:5192/',
    'http://127.0.0.1:8766/api/health',
    'http://127.0.0.1:8787/api/health'
)
$serverProcess = $null

Write-Host '=========================================='
Write-Host '  Zhiya AI Education'
Write-Host '=========================================='

try {
    foreach ($requiredPath in @(
        $nodeExe,
        $pythonExe,
        (Join-Path $ffmpegRoot 'ffmpeg.exe'),
        (Join-Path $ffmpegRoot 'ffprobe.exe'),
        (Join-Path $projectRoot 'server\dev.mjs'),
        (Join-Path $projectRoot 'node_modules')
    )) {
        if (-not (Test-Path -LiteralPath $requiredPath)) {
            throw "Required package file is missing: $requiredPath"
        }
    }

    foreach ($port in $ports) {
        if (-not (Stop-ZhiyaPortConflict -Port $port -PackageRoot $packageRoot -NonInteractive:($env:ZHIYA_NONINTERACTIVE -eq '1'))) {
            throw "Port $port is unavailable. Resolve the conflict and try again."
        }
    }

    $env:ZHIYA_PYTHON = $pythonExe
    $env:PATH = "$ffmpegRoot;$nodeRoot;$env:PATH"

    $serverProcess = Start-Process `
        -FilePath $nodeExe `
        -ArgumentList @('server/dev.mjs', '--host', '127.0.0.1', '--port', '5173', '--strictPort') `
        -WorkingDirectory $projectRoot `
        -NoNewWindow `
        -PassThru

    if (-not (Wait-ZhiyaEndpoints -Uris $endpoints -TimeoutSeconds 60)) {
        throw 'Services did not become ready before the timeout.'
    }

    if ($env:ZHIYA_NO_BROWSER -ne '1') {
        Start-Process 'http://127.0.0.1:5173/'
    }

    Write-Host ''
    Write-Host 'Zhiya is running. Close this window to stop this session.'
    if ($env:ZHIYA_VERIFY_SHUTDOWN_FILE) {
        while (-not (Test-Path -LiteralPath $env:ZHIYA_VERIFY_SHUTDOWN_FILE) -and -not $serverProcess.HasExited) {
            Start-Sleep -Milliseconds 500
            $serverProcess.Refresh()
        }
    } else {
        Wait-Process -Id $serverProcess.Id
    }
} catch {
    Write-Host "[Error] $($_.Exception.Message)"
    exit 1
} finally {
    if ($serverProcess) {
        Stop-ZhiyaProcessTree -RootPid $serverProcess.Id
    }
    foreach ($port in $ports) {
        $owner = Get-ZhiyaPortOwner -Port $port
        if ($owner -and (Test-ZhiyaOwnedProcess -Pid $owner.Pid -PackageRoot $packageRoot)) {
            Stop-ZhiyaProcessTree -RootPid $owner.Pid
        }
    }
}
