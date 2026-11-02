# Creates an SAP AI Core service key from the Generative AI Hub trial and saves it to .env without showing it.
# Uses its own cf login folder, so your normal BTP login stays as it is.
param([Parameter(Mandatory = $true)][string]$User)

$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$env:CF_HOME = Join-Path $HOME '.cf-sap-ai'
New-Item -ItemType Directory -Force $env:CF_HOME | Out-Null

Write-Host "Get the passcode from this link in an Incognito window, and sign in as your trial user, not your normal SAP account:"
Write-Host 'https://login.cf.eu10-004.hana.ondemand.com/passcode?login_hint=%7B%22origin%22%3A%22academy-platform%22%7D'
cf login -a https://api.cf.eu10-004.hana.ondemand.com --sso
if ($LASTEXITCODE -ne 0) { throw 'cf login failed' }
cf target -o 'TRIAL - Shared_sap-core-ai-chatbot-eu10-chatbot' -s dev | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not select the trial org and space' }

$keyName = "${User}_key"
cf create-service-key default_aicore $keyName | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not create the service key' }

$raw = cf service-key default_aicore $keyName | Out-String
if ($LASTEXITCODE -ne 0) { throw 'Could not read the service key' }
$json = $raw.Substring($raw.IndexOf('{')) | ConvertFrom-Json
if ($json.credentials) { $json = $json.credentials }
if (-not ($json.clientid -and $json.clientsecret -and $json.url -and $json.serviceurls.AI_API_URL)) {
  throw 'The service key is missing expected fields'
}

$envFile = Join-Path $repo '.env'
$lines = @()
if (Test-Path $envFile) { $lines = @(Get-Content $envFile | Where-Object { $_ -notmatch '^AICORE_SERVICE_KEY=' }) }
$lines += 'AICORE_SERVICE_KEY=' + ($json | ConvertTo-Json -Compress -Depth 10)
Set-Content -Path $envFile -Value $lines -Encoding ascii

Write-Host "Done. The SAP AI Core service key is saved in .env (not shown)."
