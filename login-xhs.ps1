$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$loginExe = Join-Path $root "tools\xiaohongshu-mcp\xiaohongshu-login-windows-amd64.exe"

if (-not (Test-Path $loginExe)) {
  Write-Host "Missing login executable: $loginExe"
  exit 1
}

Start-Process -FilePath $loginExe -WorkingDirectory (Split-Path $loginExe)
