using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

[assembly: System.Reflection.AssemblyTitle("PodcastStudio")]
[assembly: System.Reflection.AssemblyProduct("PodcastStudio AI")]
[assembly: System.Reflection.AssemblyCompany("PodcastStudio AI")]
[assembly: System.Reflection.AssemblyVersion("1.0.3.0")]
[assembly: System.Reflection.AssemblyFileVersion("1.0.3.0")]
[assembly: System.Reflection.AssemblyDescription("PodcastStudio - Estudio de Podcast Profesional con IA")]
[assembly: System.Reflection.AssemblyCopyright("Copyright © 2026 PodcastStudio AI")]

class Program
{
    [STAThread]
    static void Main()
    {
        try
        {
            string exeDir = AppDomain.CurrentDomain.BaseDirectory;

            // Buscar electron.exe en dist_electron primero, luego node_modules
            string[] candidatePaths = new string[]
            {
                Path.Combine(exeDir, "dist_electron", "PodcastStudio.exe"),
                Path.Combine(exeDir, "node_modules", "electron", "dist", "electron.exe"),
                Path.Combine(exeDir, "electron.exe"),
            };

            string electronExe = null;
            foreach (string candidate in candidatePaths)
            {
                if (File.Exists(candidate))
                {
                    electronExe = candidate;
                    break;
                }
            }

            if (electronExe == null)
            {
                // Fallback: buscar electron.exe globalmente via npm
                electronExe = "electron";
            }

            ProcessStartInfo psi = new ProcessStartInfo();
            psi.FileName = electronExe;
            psi.WorkingDirectory = exeDir;
            psi.UseShellExecute = true;
            psi.WindowStyle = ProcessWindowStyle.Normal;

            Process.Start(psi);
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                "Error al iniciar PodcastStudio:\n\n" + ex.Message +
                "\n\nVerifica que Node.js y Electron estén instalados correctamente.",
                "PodcastStudio - Error de Inicio",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
        }
    }
}
