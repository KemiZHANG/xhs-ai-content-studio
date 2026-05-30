$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$mcpExe = Join-Path $root "tools\xiaohongshu-mcp\xiaohongshu-mcp-windows-amd64.exe"

function Test-Port($port) {
  return [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

function Open-InChromeOrDefault($url) {
  $chromeCandidates = @(
    (Join-Path ${env:ProgramFiles} "Google\Chrome\Application\chrome.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"),
    (Join-Path ${env:LocalAppData} "Google\Chrome\Application\chrome.exe")
  )

  foreach ($candidate in $chromeCandidates) {
    if ($candidate -and (Test-Path $candidate)) {
      Start-Process -FilePath $candidate -ArgumentList @($url)
      Write-Host "Opened XHS Studio in Google Chrome: $url"
      return
    }
  }

  Start-Process $url
  Write-Host "Google Chrome was not found. Opened XHS Studio with the default browser: $url"
}

Set-Location $root

if (-not (Test-Path $mcpExe)) {
  Write-Host "Missing MCP executable: $mcpExe"
  Write-Host "Run the setup/download step again before starting XHS Studio."
  exit 1
}

if (-not (Test-Port 18060)) {
  Start-Process -FilePath $mcpExe `
    -WorkingDirectory (Split-Path $mcpExe) `
    -RedirectStandardOutput (Join-Path $root "xhs-mcp.stdout.log") `
    -RedirectStandardError (Join-Path $root "xhs-mcp.stderr.log") `
    -WindowStyle Hidden
  Write-Host "Started Xiaohongshu MCP on port 18060."
} else {
  Write-Host "Xiaohongshu MCP is already running on port 18060."
}

if (-not (Test-Port 3000)) {
  Start-Process -FilePath "powershell" `
    -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "npm run dev *> next-dev.stdout.log") `
    -WorkingDirectory $root `
    -WindowStyle Hidden
  Write-Host "Started XHS Studio web app on port 3000."
} else {
  Write-Host "XHS Studio web app is already running on port 3000."
}

Start-Sleep -Seconds 3
Open-InChromeOrDefault "http://localhost:3000"
