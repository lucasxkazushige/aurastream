using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Styling;
using Avalonia.Themes.Fluent;
using System.Globalization;

namespace AuraStream;

public class App : Application
{
    public override void Initialize()
    {
        RequestedThemeVariant = ThemeVariant.Dark;
        Styles.Add(new FluentTheme());
    }

    public override void OnFrameworkInitializationCompleted()
    {
        if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
        {
            var args = Environment.GetCommandLineArgs();
            string url = "";
            string title = "AuraStream 4K";
            string preferAudio = "pt-br";
            string autoSubs = "auto";
            double start = 0;

            for (int i = 0; i < args.Length; i++)
            {
                string Next() => i + 1 < args.Length ? args[++i] : "";
                switch (args[i])
                {
                    case "--url":
                        url = Next();
                        break;
                    case "--title":
                        title = Next();
                        break;
                    case "--start":
                        double.TryParse(Next(), NumberStyles.Float, CultureInfo.InvariantCulture, out start);
                        break;
                    case "--prefer-audio":
                        preferAudio = Next();
                        break;
                    case "--auto-subs":
                        autoSubs = Next();
                        break;
                }
            }

            desktop.MainWindow = new MainWindow(url, title, start, preferAudio, autoSubs);
        }

        base.OnFrameworkInitializationCompleted();
    }
}
