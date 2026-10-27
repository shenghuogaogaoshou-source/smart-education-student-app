$deadline = (Get-Date).AddSeconds(40)
while ((Get-Date) -lt $deadline) {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5173/' -TimeoutSec 2
        if ($response.StatusCode -eq 200) {
            Start-Process 'http://127.0.0.1:5173/'
            break
        }
    } catch {
        Start-Sleep -Milliseconds 500
    }
}
