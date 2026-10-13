$envFile = Join-Path $PSScriptRoot "..\.env.local"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#]+)\s*=\s*(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}
$env:ADMIN_EMAIL = "alfonsoavilez@icloud.com"
$env:ADMIN_PASSWORD = "Calurore1028@"
node (Join-Path $PSScriptRoot "reset-admin-users.mjs")