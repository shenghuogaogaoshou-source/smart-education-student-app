$ErrorActionPreference = 'Stop'

function Get-ZhiyaPortOwner {
    param([Parameter(Mandatory = $true)][int]$Port)

    $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if (-not $connection) {
        return $null
    }

    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($connection.OwningProcess)" -ErrorAction SilentlyContinue
    return [pscustomobject]@{
        Port = $Port
        Pid = $connection.OwningProcess
        Name = if ($process) { $process.Name } else { 'unknown' }
        ExecutablePath = if ($process) { $process.ExecutablePath } else { $null }
        CommandLine = if ($process) { $process.CommandLine } else { $null }
    }
}

function Test-ZhiyaPathUnderRoot {
    param(
        [string]$Candidate,
        [Parameter(Mandatory = $true)][string]$PackageRoot
    )

    if ([string]::IsNullOrWhiteSpace($Candidate)) {
        return $false
    }

    try {
        $rootFull = [System.IO.Path]::GetFullPath($PackageRoot).TrimEnd('\', '/')
        $candidateFull = [System.IO.Path]::GetFullPath($Candidate)
        $comparison = [System.StringComparison]::OrdinalIgnoreCase
        return $candidateFull.StartsWith("$rootFull\", $comparison) -or
            $candidateFull.StartsWith("$rootFull/", $comparison)
    } catch {
        return $false
    }
}

function Test-ZhiyaOwnedProcess {
    param(
        [Parameter(Mandatory = $true)]
        [Alias('Pid')]
        [int]$ProcessId,
        [Parameter(Mandatory = $true)][string]$PackageRoot
    )

    if ($ProcessId -le 4) {
        return $false
    }

    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction SilentlyContinue
    if (-not $process) {
        return $false
    }

    $executableOwned = Test-ZhiyaPathUnderRoot -Candidate $process.ExecutablePath -PackageRoot $PackageRoot
    $commandOwned = $false
    if ($process.CommandLine) {
        $normalizedRoot = [System.IO.Path]::GetFullPath($PackageRoot).TrimEnd('\', '/')
        $commandOwned = $process.CommandLine.IndexOf(
            $normalizedRoot,
            [System.StringComparison]::OrdinalIgnoreCase
        ) -ge 0
    }

    return $executableOwned -or $commandOwned
}

function Test-ZhiyaProtectedProcess {
    param([Parameter(Mandatory = $true)]$Process)

    if ($Process.Pid -le 4) {
        return $true
    }

    $protectedNames = @(
        'System',
        'Idle',
        'svchost.exe',
        'services.exe',
        'wininit.exe',
        'lsass.exe'
    )
    return $protectedNames -contains $Process.Name
}

function Stop-ZhiyaProcessTree {
    param([Parameter(Mandatory = $true)][int]$RootPid)

    $children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$RootPid" -ErrorAction SilentlyContinue
    foreach ($child in $children) {
        Stop-ZhiyaProcessTree -RootPid $child.ProcessId
    }
    Stop-Process -Id $RootPid -Force -ErrorAction SilentlyContinue
}

function Stop-ZhiyaPortConflict {
    param(
        [Parameter(Mandatory = $true)][int]$Port,
        [Parameter(Mandatory = $true)][string]$PackageRoot,
        [switch]$NonInteractive
    )

    $owner = Get-ZhiyaPortOwner -Port $Port
    if (-not $owner) {
        return $true
    }

    if (Test-ZhiyaProtectedProcess -Process $owner) {
        Write-Host "[Blocked] Port $Port is owned by protected process $($owner.Name) (PID $($owner.Pid))."
        return $false
    }

    if (Test-ZhiyaOwnedProcess -Pid $owner.Pid -PackageRoot $PackageRoot) {
        Write-Host "[Cleanup] Stopping stale package process $($owner.Name) (PID $($owner.Pid), port $Port)."
        Stop-ZhiyaProcessTree -RootPid $owner.Pid
        return $true
    }

    Write-Host "[Busy] Port $Port is used by $($owner.Name) (PID $($owner.Pid))."
    if ($NonInteractive) {
        return $false
    }

    $answer = Read-Host 'Stop this process and continue? Type Y to confirm'
    if ($answer -eq 'Y' -or $answer -eq 'y') {
        Stop-ZhiyaProcessTree -RootPid $owner.Pid
        return $true
    }
    return $false
}
