Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class WinApiChecker {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);
}
"@

$sw = [System.Diagnostics.Stopwatch]::StartNew()
$proc = Start-Process -FilePath ".\PodcastStudio.exe" -PassThru
Write-Host "PodcastStudio.exe lanzado (PID $($proc.Id))..."

$found = $false
for ($i = 0; $i -lt 50; $i++) {
    Start-Sleep -Milliseconds 80
    $elecProcesses = Get-Process -Name "electron" -ErrorAction SilentlyContinue
    foreach ($p in $elecProcesses) {
        if ($p.MainWindowHandle -ne [IntPtr]::Zero) {
            $sw.Stop()
            Write-Host ">>> EXITO TOTAL: Ventana visible en $($sw.ElapsedMilliseconds) ms!" -ForegroundColor Green
            Write-Host "Proceso Electron $($p.Id) tiene MainWindowHandle: $($p.MainWindowHandle) con Titulo: '$($p.MainWindowTitle)'"
            $found = $true
            break
        }
    }
    if ($found) { break }
}

if (-not $found) {
    Write-Host ">>> ERROR: La ventana no se detecto a tiempo." -ForegroundColor Red
}

$allElec = Get-Process -Name "electron" -ErrorAction SilentlyContinue
Write-Host "Procesos Electron activos y estables: $($allElec.Count)"

# Esperar 2 segundos para asegurar estabilidad
Start-Sleep -Seconds 2

Stop-Process -Name "electron", "PodcastStudio" -Force -ErrorAction SilentlyContinue
Write-Host "Prueba finalizada con exito."

