$ErrorActionPreference = 'Stop'

function Wait-ZhiyaEndpoint {
    param(
        [Parameter(Mandatory = $true)][string]$Uri,
        [int]$TimeoutSeconds = 45
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $Uri -TimeoutSec 2
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
                return $true
            }
        } catch {
            Start-Sleep -Milliseconds 500
            continue
        }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

function Wait-ZhiyaEndpoints {
    param(
        [Parameter(Mandatory = $true)][string[]]$Uris,
        [int]$TimeoutSeconds = 60
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    foreach ($uri in $Uris) {
        $remaining = [Math]::Max(1, [int][Math]::Ceiling(($deadline - (Get-Date)).TotalSeconds))
        if (-not (Wait-ZhiyaEndpoint -Uri $uri -TimeoutSeconds $remaining)) {
            Write-Host "[Error] Service did not become ready: $uri"
            return $false
        }
        Write-Host "[Ready] $uri"
    }
    return $true
}
