$ErrorActionPreference = 'Stop'
$projectDir = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $projectDir

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   EMPAQUETANDO PODCASTSTUDIO.EXE CON NUEVA VERSION" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Leer versión desde package.json
$pkgJsonPath = Join-Path $projectDir "package.json"
$pkg = Get-Content $pkgJsonPath -Raw | ConvertFrom-Json
$rawVersion = $pkg.version
$verParts = $rawVersion.Split('.')
while ($verParts.Count -lt 4) { $verParts += "0" }
$fullVersion = $verParts -join '.'

Write-Host "[1/4] Version del proyecto: $rawVersion ($fullVersion)" -ForegroundColor Yellow

# 2. Sincronizar versión en launcher.cs
$launcherPath = Join-Path $projectDir "launcher.cs"
if (Test-Path $launcherPath) {
    $launcherCode = Get-Content $launcherPath -Raw -Encoding UTF8
    $launcherCode = [System.Text.RegularExpressions.Regex]::Replace($launcherCode, '\[assembly:\s*System\.Reflection\.AssemblyVersion\("[^"]+"\)', "[assembly: System.Reflection.AssemblyVersion(`"$fullVersion`")")
    $launcherCode = [System.Text.RegularExpressions.Regex]::Replace($launcherCode, '\[assembly:\s*System\.Reflection\.AssemblyFileVersion\("[^"]+"\)', "[assembly: System.Reflection.AssemblyFileVersion(`"$fullVersion`")")
    $launcherCode = [System.Text.RegularExpressions.Regex]::Replace($launcherCode, '\[assembly:\s*System\.Reflection\.AssemblyInformationalVersion\("[^"]+"\)', "[assembly: System.Reflection.AssemblyInformationalVersion(`"$fullVersion`")")
    [System.IO.File]::WriteAllText($launcherPath, $launcherCode, [System.Text.Encoding]::UTF8)
    Write-Host "[2/4] launcher.cs actualizado con version $fullVersion" -ForegroundColor Green
}

# 3. Eliminar EXE previo si existe para reiniciar CreationTime de NTFS
$exePath = Join-Path $projectDir "PodcastStudio.exe"
if (Test-Path $exePath) {
    Remove-Item $exePath -Force
    Write-Host "[3/4] Archivo previo eliminado para actualizar fecha y hora de creacion" -ForegroundColor DarkGray
}

# 4. Compilar con csc.exe y el icon.ico original intacto
$cscPath = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $cscPath)) {
    $cscPath = "C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
}

$iconPath = Join-Path $projectDir "icon.ico"
$cscArgs = @("/target:winexe", "/codepage:65001", "/win32icon:$iconPath", "/r:System.dll", "/r:System.Drawing.dll", "/r:System.Windows.Forms.dll", "/out:$exePath", $launcherPath)
& $cscPath $cscArgs

if ($LASTEXITCODE -ne 0 -or -not (Test-Path $exePath)) {
    Write-Error "Fallo la compilacion de PodcastStudio.exe"
    exit 1
}

# 5. Establecer CreationTime, LastWriteTime y LastAccessTime a este instante exacto
$now = Get-Date
$exeItem = Get-Item $exePath
$exeItem.CreationTime = $now
$exeItem.LastWriteTime = $now
$exeItem.LastAccessTime = $now

Write-Host "==================================================" -ForegroundColor Green
Write-Host "   EXITO: PODCASTSTUDIO.EXE GENERADO CORRECTAMENTE" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green

Get-Item $exePath | Select-Object Name, Length, 
    @{N='VersionArchivo';E={$_.VersionInfo.FileVersion}}, 
    @{N='VersionProducto';E={$_.VersionInfo.ProductVersion}}, 
    @{N='FechaCreacion';E={$_.CreationTime.ToString("dd/MM/yyyy hh:mm tt")}}, 
    @{N='FechaModificacion';E={$_.LastWriteTime.ToString("dd/MM/yyyy hh:mm tt")}} | Format-List
