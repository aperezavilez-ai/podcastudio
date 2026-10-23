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
[assembly: System.Reflection.AssemblyCopyright("Copyright (C) 2026 PodcastStudio AI")]

class Program
{
    [STAThread]
    static void Main()
    {
        try
        {
            string exeDir = AppDomain.CurrentDomain.BaseDirectory;
            // Ruta al electron.exe en node_modules
            string electronExe = Path.Combine(exeDir, "node_modules", "electron", "dist", "electron.exe");

            if (!File.Exists(electronExe))
            {
                MessageBox.Show(
                    "No se encontro electron.exe en:\n" + electronExe +
                    "\n\nAsegurate de haber ejecutado 'npm install' en la carpeta del proyecto.",
                    "PodcastStudio - Error",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                return;
            }

            ProcessStartInfo psi = new ProcessStartInfo();
            psi.FileName = electronExe;
            // CRITICO: pasar el directorio raiz del proyecto como argumento
            psi.Arguments = "\"" + exeDir.TrimEnd('\\') + "\"";
            psi.WorkingDirectory = exeDir;
            psi.UseShellExecute = false;
            psi.WindowStyle = ProcessWindowStyle.Normal;

            Process.Start(psi);
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                "Error al iniciar PodcastStudio:\n\n" + ex.Message,
                "PodcastStudio - Error de Inicio",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
        }
    }
}
