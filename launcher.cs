using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Threading;
using System.Windows.Forms;

[assembly: System.Reflection.AssemblyTitle("PodcastStudio")]
[assembly: System.Reflection.AssemblyProduct("PodcastStudio AI")]
[assembly: System.Reflection.AssemblyCompany("PodcastStudio AI")]
[assembly: System.Reflection.AssemblyVersion("1.0.6.0")]
[assembly: System.Reflection.AssemblyFileVersion("1.0.6.0")]
[assembly: System.Reflection.AssemblyInformationalVersion("1.0.6.0")]
[assembly: System.Reflection.AssemblyDescription("PodcastStudio - Estudio de Podcast Profesional con IA")]
[assembly: System.Reflection.AssemblyCopyright("Copyright (C) 2026 PodcastStudio AI")]

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
                "No se encontrÃ³ electron.exe en:\n" + electronExe +
                "\n\nAsegÃºrate de haber ejecutado 'npm install' en la carpeta del proyecto.",
                "PodcastStudio - Error de Archivo",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
            return;
        }

        // Mostrar Splash Screen nativo instantÃ¡neo con animaciÃ³n
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
    private string _statusText = "Iniciando motor de transmisiÃ³n y estudio...";
    private Thread _workerThread;
    private bool _isClosing = false;

    public SplashForm(string exeDir, string electronExe)
    {
        _exeDir = exeDir;
        _electronExe = electronExe;

        // ConfiguraciÃ³n de ventana Splash sin bordes, centrada y de respuesta instantÃ¡nea (<30ms)
        this.FormBorderStyle = FormBorderStyle.None;
        this.StartPosition = FormStartPosition.CenterScreen;
        this.Size = new Size(480, 280);
        this.BackColor = Color.FromArgb(13, 15, 20);
        this.DoubleBuffered = true;
        this.ShowInTaskbar = true;
        this.Text = "PodcastStudio - Iniciando...";

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

        // Timer de animaciÃ³n suave para la barra de carga dinÃ¡mica y el brillo (30ms = ~35fps)
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

    private void StartElectronLaunch()
    {
        _workerThread = new Thread(() =>
        {
            try
            {
                // Limpiar posibles instancias colgadas previas de electron para arranque inmediato
                try
                {
                    Process[] oldProcs = Process.GetProcessesByName("electron");
                    // No matamos procesos a menos que lleven demasiado tiempo
                }
                catch {}

                UpdateStatus("Cargando componentes del estudio...");

                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = _electronExe;
                psi.Arguments = "\"" + _exeDir.TrimEnd('\\') + "\"";
                psi.WorkingDirectory = _exeDir;
                psi.UseShellExecute = false;
                psi.WindowStyle = ProcessWindowStyle.Normal;

                Process electronProc = Process.Start(psi);

                UpdateStatus("Conectando interfaz grÃ¡fica...");

                // Esperar a que la ventana de Electron aparezca
                int waitedMs = 0;
                while (waitedMs < 14000)
                {
                    Thread.Sleep(250);
                    waitedMs += 250;

                    if (electronProc.HasExited) break;

                    try
                    {
                        electronProc.Refresh();
                        if (electronProc.MainWindowHandle != IntPtr.Zero)
                        {
                            // La ventana principal de Electron ya estÃ¡ activa
                            Thread.Sleep(700);
                            break;
                        }
                    }
                    catch {}
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
                        "Error al inicializar PodcastStudio:\n\n" + ex.Message,
                        "PodcastStudio",
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

        // 2. Borde exterior elegante naranja/Ã¡mbar
        using (Pen borderPen = new Pen(Color.FromArgb(234, 88, 12), 1.5f))
        {
            g.DrawRectangle(borderPen, 0, 0, this.Width - 1, this.Height - 1);
        }

        // 3. Brillo circular de acento detrÃ¡s del logo
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

        // 5. TÃ­tulo Principal
        using (Font titleFont = new Font("Segoe UI", 17f, FontStyle.Bold))
        using (SolidBrush textBrush = new SolidBrush(Color.White))
        {
            string title = "PODCASTSTUDIO AI";
            SizeF size = g.MeasureString(title, titleFont);
            g.DrawString(title, titleFont, textBrush, (this.Width - size.Width) / 2, 130);
        }

        // 6. SubtÃ­tulo Broadcast
        using (Font subFont = new Font("Segoe UI", 8.5f, FontStyle.Bold))
        using (SolidBrush subBrush = new SolidBrush(Color.FromArgb(234, 88, 12)))
        {
            string sub = "ESTUDIO PROFESIONAL DE TRANSMISIÃ“N & PRODUCCIÃ“N";
            SizeF size = g.MeasureString(sub, subFont);
            g.DrawString(sub, subFont, subBrush, (this.Width - size.Width) / 2, 162);
        }

        // 7. Texto de Estado DinÃ¡mico
        using (Font statusFont = new Font("Segoe UI", 9f, FontStyle.Regular))
        using (SolidBrush statusBrush = new SolidBrush(Color.FromArgb(148, 163, 184)))
        {
            SizeF size = g.MeasureString(_statusText, statusFont);
            g.DrawString(_statusText, statusFont, statusBrush, (this.Width - size.Width) / 2, 198);
        }

        // 8. Barra de Progreso Animada y DinÃ¡mica (Shimmer effect)
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

        // 9. VersiÃ³n en la esquina inferior derecha
        using (Font verFont = new Font("Segoe UI", 7.5f, FontStyle.Regular))
        using (SolidBrush verBrush = new SolidBrush(Color.FromArgb(71, 85, 105)))
        {
            g.DrawString("v1.0.6.0", verFont, verBrush, this.Width - 60, this.Height - 20);
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
