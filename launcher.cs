using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Threading;
using System.Windows.Forms;

[assembly: System.Reflection.AssemblyTitle("PodcaStudio")]
[assembly: System.Reflection.AssemblyProduct("PodcaStudio")]
[assembly: System.Reflection.AssemblyCompany("PodcaStudio")]
[assembly: System.Reflection.AssemblyVersion("1.2.2.0")]
[assembly: System.Reflection.AssemblyFileVersion("1.2.2.0")]
[assembly: System.Reflection.AssemblyInformationalVersion("1.2.2.0")]
[assembly: System.Reflection.AssemblyDescription("PodcaStudio - Estudio Profesional de Transmisi\u00F3n & Producci\u00F3n")]
[assembly: System.Reflection.AssemblyCopyright("Copyright (C) 2026 PodcaStudio")]

class Program
{
    [STAThread]
    static void Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);

        string exeDir = AppDomain.CurrentDomain.BaseDirectory;
        string electronExe = Path.Combine(exeDir, "node_modules", "electron", "dist", "electron.exe");

        if (!File.Exists(electronExe))
        {
            MessageBox.Show(
                "No se encontr\u00F3 electron.exe en:\n" + electronExe +
                "\n\nAseg\u00FArese de haber ejecutado 'npm install' en la carpeta del proyecto.",
                "PodcaStudio - Error de Archivo",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
            return;
        }

        // Mostrar Splash Screen nativo instantaneo con animacion
        SplashForm splash = new SplashForm(exeDir, electronExe);
        Application.Run(splash);
    }
}

public class SplashForm : Form
{
    private readonly string _exeDir;
    private readonly string _electronExe;
    private readonly System.Windows.Forms.Timer _animTimer;
    private Icon _appIcon;
    private Image _appImage;
    private int _animOffset = 0;
    private string _statusText = "Iniciando motor de transmisi\u00F3n y estudio...";
    private Thread _workerThread;
    private bool _isClosing = false;

    public SplashForm(string exeDir, string electronExe)
    {
        _exeDir = exeDir;
        _electronExe = electronExe;

        // Configuracion de ventana Splash sin bordes, centrada y de respuesta instantanea (<30ms)
        this.FormBorderStyle = FormBorderStyle.None;
        this.StartPosition = FormStartPosition.CenterScreen;
        this.Size = new Size(480, 280);
        this.BackColor = Color.FromArgb(13, 15, 20);
        this.DoubleBuffered = true;
        this.ShowInTaskbar = true;
        this.Text = "PodcaStudio - Iniciando...";

        // Cargar icono oficial si existe
        string iconPath = Path.Combine(_exeDir, "icon.ico");
        if (File.Exists(iconPath))
        {
            try
            {
                _appIcon = new Icon(iconPath, 64, 64);
                this.Icon = _appIcon;
            }
            catch {}
        }
        string pngPath = Path.Combine(_exeDir, "icon.png");
        if (File.Exists(pngPath))
        {
            try { _appImage = Image.FromFile(pngPath); } catch {}
        }

        // Timer de animacion suave para la barra de carga dinamica (28ms = ~35fps)
        _animTimer = new System.Windows.Forms.Timer();
        _animTimer.Interval = 28;
        _animTimer.Tick += (s, e) =>
        {
            _animOffset = (_animOffset + 7) % 520;
            this.Invalidate();
        };
        _animTimer.Start();

        this.Shown += (s, e) => StartElectronLaunch();
    }

    [System.Runtime.InteropServices.DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr hWnd);

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    private void StartElectronLaunch()
    {
        _workerThread = new Thread(() =>
        {
            try
            {
                // Limpiar procesos huÃƒÂ©rfanos previos de electron para arranque instantÃƒÂ¡neo
                try
                {
                    foreach (Process p in Process.GetProcessesByName("electron"))
                    {
                        try { p.Kill(); p.WaitForExit(1000); } catch {}
                    }
                }
                catch {}

                UpdateStatus("Cargando componentes del estudio...");

                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = _electronExe;
                psi.Arguments = "\"" + _exeDir.TrimEnd('\\') + "\"";
                psi.WorkingDirectory = _exeDir;
                psi.UseShellExecute = true;
                psi.WindowStyle = ProcessWindowStyle.Normal;

                Process electronProc = Process.Start(psi);

                UpdateStatus("Conectando interfaz gr\u00E1fica...");

                // Deteccion ultrarrapida de la ventana de PodcastStudio (<1 segundo)
                int waitedMs = 0;
                while (waitedMs < 10000)
                {
                    Thread.Sleep(50);
                    waitedMs += 50;

                    IntPtr hWnd = IntPtr.Zero;

                    // 1. Buscar en todos los procesos electron si alguno ya tiene ventana visible
                    try
                    {
                        Process[] procs = Process.GetProcessesByName("electron");
                        if (waitedMs > 2000 && procs.Length == 0)
                        {
                            // Ningun proceso de electron sigue activo
                            break;
                        }

                        foreach (Process p in procs)
                        {
                            if (p.MainWindowHandle != IntPtr.Zero && IsWindowVisible(p.MainWindowHandle))
                            {
                                hWnd = p.MainWindowHandle;
                                try { SetForegroundWindow(hWnd); } catch {}
                                break;
                            }
                        }
                    }
                    catch {}

                    // 2. Buscar por titulo en el administrador de ventanas de Windows
                    if (hWnd == IntPtr.Zero)
                    {
                        try
                        {
                            IntPtr winHwnd = FindWindow(null, "PodcastStudio");
                            if (winHwnd != IntPtr.Zero && IsWindowVisible(winHwnd))
                            {
                                hWnd = winHwnd;
                                try { SetForegroundWindow(hWnd); } catch {}
                            }
                        }
                        catch {}
                    }

                    if (hWnd != IntPtr.Zero)
                    {
                        Thread.Sleep(80);
                        break;
                    }
                }

                // Cerrar splash de forma segura en el hilo de UI
                this.BeginInvoke(new Action(() =>
                {
                    _isClosing = true;
                    _animTimer.Stop();
                    this.Close();
                }));
            }
            catch (Exception ex)
            {
                this.BeginInvoke(new Action(() =>
                {
                    MessageBox.Show(
                        "Error al inicializar PodcaStudio:\n\n" + ex.Message,
                        "PodcaStudio",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Warning
                    );
                    this.Close();
                }));
            }
        });

        _workerThread.IsBackground = true;
        _workerThread.Start();
    }

    private void UpdateStatus(string text)
    {
        try
        {
            if (!_isClosing && !this.IsDisposed)
            {
                this.BeginInvoke(new Action(() =>
                {
                    _statusText = text;
                    this.Invalidate();
                }));
            }
        }
        catch {}
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        Graphics g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;

        // 1. Fondo degradado profesional estilo Dark Studio
        using (LinearGradientBrush bgBrush = new LinearGradientBrush(
            this.ClientRectangle,
            Color.FromArgb(19, 21, 28),
            Color.FromArgb(10, 11, 15),
            LinearGradientMode.Vertical))
        {
            g.FillRectangle(bgBrush, this.ClientRectangle);
        }

        // 2. Borde exterior elegante naranja/ambar
        using (Pen borderPen = new Pen(Color.FromArgb(234, 88, 12), 1.5f))
        {
            g.DrawRectangle(borderPen, 0, 0, this.Width - 1, this.Height - 1);
        }

        // 3. Brillo circular de acento detras del logo
        int logoCenterX = this.Width / 2;
        int logoCenterY = 72;
        using (GraphicsPath path = new GraphicsPath())
        {
            path.AddEllipse(logoCenterX - 55, logoCenterY - 55, 110, 110);
            using (PathGradientBrush pgb = new PathGradientBrush(path))
            {
                pgb.CenterColor = Color.FromArgb(50, 255, 107, 0);
                pgb.SurroundColors = new Color[] { Color.FromArgb(0, 0, 0, 0) };
                g.FillEllipse(pgb, logoCenterX - 55, logoCenterY - 55, 110, 110);
            }
        }

        // 4. Dibujar Icono
        if (_appIcon != null)
        {
            g.DrawIcon(_appIcon, new Rectangle(logoCenterX - 30, logoCenterY - 30, 60, 60));
        }
        else if (_appImage != null)
        {
            g.DrawImage(_appImage, new Rectangle(logoCenterX - 30, logoCenterY - 30, 60, 60));
        }
        else
        {
            using (SolidBrush dotBrush = new SolidBrush(Color.FromArgb(234, 88, 12)))
            {
                g.FillEllipse(dotBrush, logoCenterX - 25, logoCenterY - 25, 50, 50);
            }
        }

        // 5. Titulo Principal exacto: "PodcaStudio" (sin AI)
        using (Font titleFont = new Font("Segoe UI", 18f, FontStyle.Bold))
        using (SolidBrush textBrush = new SolidBrush(Color.White))
        {
            string title = "PodcaStudio";
            SizeF size = g.MeasureString(title, titleFont);
            g.DrawString(title, titleFont, textBrush, (this.Width - size.Width) / 2, 128);
        }

        // 6. Subtitulo Broadcast con tildes impecables
        using (Font subFont = new Font("Segoe UI", 8.5f, FontStyle.Bold))
        using (SolidBrush subBrush = new SolidBrush(Color.FromArgb(234, 88, 12)))
        {
            string sub = "ESTUDIO PROFESIONAL DE TRANSMISI\u00D3N & PRODUCCI\u00D3N";
            SizeF size = g.MeasureString(sub, subFont);
            g.DrawString(sub, subFont, subBrush, (this.Width - size.Width) / 2, 162);
        }

        // 7. Texto de Estado Dinamico con tildes impecables
        using (Font statusFont = new Font("Segoe UI", 9f, FontStyle.Regular))
        using (SolidBrush statusBrush = new SolidBrush(Color.FromArgb(148, 163, 184)))
        {
            SizeF size = g.MeasureString(_statusText, statusFont);
            g.DrawString(_statusText, statusFont, statusBrush, (this.Width - size.Width) / 2, 198);
        }

        // 8. Barra de Progreso Animada y Dinamica (Shimmer effect)
        int barX = 40;
        int barY = 236;
        int barW = this.Width - 80;
        int barH = 5;

        // Pista de fondo
        using (SolidBrush trackBrush = new SolidBrush(Color.FromArgb(30, 34, 45)))
        {
            g.FillRectangle(trackBrush, barX, barY, barW, barH);
        }

        // Haz de luz animado en movimiento fluido
        int beamW = 120;
        int beamX = barX - beamW + _animOffset;
        if (beamX < barX + barW)
        {
            int drawX = Math.Max(barX, beamX);
            int drawW = Math.Min(barX + barW - drawX, beamW - (drawX - beamX));

            if (drawW > 0)
            {
                using (LinearGradientBrush beamBrush = new LinearGradientBrush(
                    new Rectangle(beamX, barY, beamW, barH),
                    Color.FromArgb(255, 107, 0),
                    Color.FromArgb(239, 68, 68),
                    LinearGradientMode.Horizontal))
                {
                    g.FillRectangle(beamBrush, drawX, barY, drawW, barH);
                }
            }
        }

        // 9. Version dinamica sincronizada en la esquina inferior derecha
        string verText = "v" + typeof(Program).Assembly.GetName().Version.ToString();
        using (Font verFont = new Font("Segoe UI", 7.5f, FontStyle.Regular))
        using (SolidBrush verBrush = new SolidBrush(Color.FromArgb(80, 95, 115)))
        {
            SizeF verSize = g.MeasureString(verText, verFont);
            g.DrawString(verText, verFont, verBrush, this.Width - verSize.Width - 14, this.Height - verSize.Height - 8);
        }
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            if (_animTimer != null) _animTimer.Dispose();
            if (_appIcon != null) _appIcon.Dispose();
            if (_appImage != null) _appImage.Dispose();
        }
        base.Dispose(disposing);
    }
}
