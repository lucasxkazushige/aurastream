using System.Globalization;
using System.Text;
using System.Text.Json;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.Threading;
using LibVLCSharp.Avalonia;
using LibVLCSharp.Shared;
using LibVLCSharp.Shared.Structures;

namespace AuraStream;

public sealed class MainWindow : Window
{
    static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    readonly string _url;
    readonly string _titleText;
    readonly long _startMs;
    readonly string _preferAudio;
    readonly string _autoSubs;

    readonly VideoView _video = new();
    readonly TextBlock _titleLabel = new();
    readonly TextBlock _statusLabel = new();
    readonly TextBlock _timeLabel = new();
    readonly Button _playBtn = new();
    readonly Button _audioBtn = new();
    readonly Button _subBtn = new();
    readonly Button _muteBtn = new();
    readonly Slider _seek = new();
    readonly Slider _volume = new();

    LibVLC? _libVlc;
    MediaPlayer? _player;
    Media? _media;
    bool _startedSeek;
    bool _prefsApplied;
    bool _userAudio;
    bool _userSub;
    bool _closing;
    bool _dragging;
    DateTime _lastEmit = DateTime.MinValue;

    public MainWindow(string url, string title, double startSeconds, string preferAudio, string autoSubs)
    {
        _url = url;
        _titleText = string.IsNullOrWhiteSpace(title) ? "AuraStream 4K" : title;
        _startMs = startSeconds > 2 ? (long)(startSeconds * 1000) : 0;
        _preferAudio = (preferAudio ?? "pt-br").ToLowerInvariant();
        _autoSubs = (autoSubs ?? "auto").ToLowerInvariant();

        Title = _titleText + " — AuraStream";
        Width = 1280;
        Height = 720;
        MinWidth = 960;
        MinHeight = 540;
        WindowState = WindowState.FullScreen;
        Background = Brush("#0c0c0e");
        Foreground = Brushes.White;
        SystemDecorations = SystemDecorations.None;

        Content = BuildUi();
        KeyDown += OnKeyDown;
        Closed += (_, _) => ShutdownPlayer();
        Opened += (_, _) => StartPlayback();
    }

    Control BuildUi()
    {
        var backBtn = BarButton("←  Voltar", 118);
        backBtn.Click += (_, _) => Close();

        _titleLabel.Text = _titleText;
        _titleLabel.FontWeight = FontWeight.Bold;
        _titleLabel.FontSize = 15;
        _titleLabel.TextTrimming = TextTrimming.CharacterEllipsis;
        _titleLabel.VerticalAlignment = VerticalAlignment.Center;

        _statusLabel.Text = "Abrindo o arquivo original…";
        _statusLabel.Foreground = Brush("#34d399");
        _statusLabel.FontSize = 11;
        _statusLabel.FontWeight = FontWeight.Bold;
        _statusLabel.HorizontalAlignment = HorizontalAlignment.Right;

        var engineLabel = new TextBlock
        {
            Text = "Motor VLC  ·  arquivo original",
            Foreground = Brush("#a1a1aa"),
            FontSize = 11,
            FontWeight = FontWeight.Bold,
            HorizontalAlignment = HorizontalAlignment.Right,
        };

        var topBar = new Grid
        {
            Height = 58,
            Background = Brush("#121216"),
            ColumnDefinitions = new ColumnDefinitions("Auto,*,Auto"),
        };
        topBar.Children.Add(Wrap(backBtn, 0, new Thickness(12, 0, 12, 0)));
        var titleStack = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
        titleStack.Children.Add(_titleLabel);
        Grid.SetColumn(titleStack, 1);
        topBar.Children.Add(titleStack);
        var rightStack = new StackPanel
        {
            Spacing = 2,
            VerticalAlignment = VerticalAlignment.Center,
            Margin = new Thickness(12, 0, 16, 0),
        };
        rightStack.Children.Add(engineLabel);
        rightStack.Children.Add(_statusLabel);
        Grid.SetColumn(rightStack, 2);
        topBar.Children.Add(rightStack);

        _seek.Minimum = 0;
        _seek.Maximum = 1000;
        _seek.Value = 0;
        _seek.Height = 18;
        _seek.PointerPressed += (_, _) => _dragging = true;
        _seek.PointerReleased += (_, _) =>
        {
            _dragging = false;
            if (_player == null || _player.Length <= 0) return;
            _player.Time = (long)((_seek.Value / 1000.0) * _player.Length);
        };

        _playBtn.Content = "▶";
        StyleButton(_playBtn, 46);
        _playBtn.Click += (_, _) => TogglePause();

        var back10 = BarButton("−10s", 58);
        back10.Click += (_, _) => SeekBy(-10_000);
        var fwd10 = BarButton("+10s", 58);
        fwd10.Click += (_, _) => SeekBy(10_000);

        _muteBtn.Content = "🔊";
        StyleButton(_muteBtn, 42);
        _muteBtn.Click += (_, _) => ToggleMute();

        _volume.Minimum = 0;
        _volume.Maximum = 100;
        _volume.Value = 90;
        _volume.Width = 110;
        _volume.VerticalAlignment = VerticalAlignment.Center;
        _volume.PropertyChanged += (_, e) =>
        {
            if (e.Property != Slider.ValueProperty || _player == null) return;
            _player.Volume = (int)_volume.Value;
            _muteBtn.Content = _volume.Value == 0 || _player.Mute ? "🔇" : "🔊";
        };

        _timeLabel.Text = "00:00 / 00:00";
        _timeLabel.Foreground = Brush("#a1a1aa");
        _timeLabel.FontFamily = new FontFamily("Consolas, monospace");
        _timeLabel.FontSize = 12;
        _timeLabel.VerticalAlignment = VerticalAlignment.Center;
        _timeLabel.Width = 130;

        _audioBtn.Content = "Áudio ▾";
        StyleButton(_audioBtn, 120);
        _audioBtn.Click += (_, _) => ShowTrackMenu(_audioBtn, true);

        _subBtn.Content = "Legendas ▾";
        StyleButton(_subBtn, 132);
        _subBtn.Click += (_, _) => ShowTrackMenu(_subBtn, false);

        var controls = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            Spacing = 8,
            VerticalAlignment = VerticalAlignment.Center,
        };
        controls.Children.Add(_playBtn);
        controls.Children.Add(back10);
        controls.Children.Add(fwd10);
        controls.Children.Add(_muteBtn);
        controls.Children.Add(_volume);
        controls.Children.Add(_timeLabel);

        var rightBtns = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            Spacing = 8,
            HorizontalAlignment = HorizontalAlignment.Right,
            VerticalAlignment = VerticalAlignment.Center,
        };
        rightBtns.Children.Add(_audioBtn);
        rightBtns.Children.Add(_subBtn);

        var bottomInner = new Grid { ColumnDefinitions = new ColumnDefinitions("*,Auto") };
        bottomInner.Children.Add(controls);
        Grid.SetColumn(rightBtns, 1);
        bottomInner.Children.Add(rightBtns);

        var bottomBar = new StackPanel
        {
            Height = 92,
            Background = Brush("#121216"),
            Spacing = 4,
        };
        bottomBar.Children.Add(new Border { Padding = new Thickness(14, 10, 14, 0), Child = _seek });
        bottomBar.Children.Add(new Border { Padding = new Thickness(14, 4, 14, 10), Child = bottomInner });

        var root = new Grid
        {
            RowDefinitions = new RowDefinitions("Auto,*,Auto"),
        };
        root.Children.Add(topBar);
        Grid.SetRow(_video, 1);
        root.Children.Add(_video);
        Grid.SetRow(bottomBar, 2);
        root.Children.Add(bottomBar);
        return root;
    }

    static Control Wrap(Control child, int col, Thickness margin)
    {
        child.Margin = margin;
        child.VerticalAlignment = VerticalAlignment.Center;
        Grid.SetColumn(child, col);
        return child;
    }

    static Button BarButton(string text, double width)
    {
        var btn = new Button { Content = text };
        StyleButton(btn, width);
        return btn;
    }

    static void StyleButton(Button btn, double width)
    {
        btn.Width = width;
        btn.Height = 38;
        btn.Background = Brush("#242428");
        btn.Foreground = Brushes.White;
        btn.FontWeight = FontWeight.Bold;
        btn.FontSize = 13;
        btn.CornerRadius = new CornerRadius(10);
        btn.BorderThickness = new Thickness(0);
        btn.Cursor = new Cursor(StandardCursorType.Hand);
        btn.Padding = new Thickness(8, 0);
    }

    static SolidColorBrush Brush(string hex) => SolidColorBrush.Parse(hex);

    void StartPlayback()
    {
        if (string.IsNullOrWhiteSpace(_url))
        {
            _statusLabel.Text = "Nenhuma URL de vídeo foi informada.";
            _statusLabel.Foreground = Brush("#f87171");
            return;
        }

        try
        {
            Core.Initialize(AppContext.BaseDirectory);
            _libVlc = new LibVLC(
                "--network-caching=4000",
                "--file-caching=3000",
                "--no-video-title-show",
                "--avcodec-hw=any",
                "--http-reconnect",
                "--no-crashdump",
                "--quiet");

            _player = new MediaPlayer(_libVlc)
            {
                EnableKeyInput = false,
                EnableMouseInput = false,
                Volume = 90,
            };
            _video.MediaPlayer = _player;

            _player.Playing += (_, _) => Ui(() =>
            {
                _playBtn.Content = "❚❚";
                _statusLabel.Text = "Arquivo original  ·  use Áudio e Legendas";
                _statusLabel.Foreground = Brush("#34d399");
                Emit(new { type = "playing" });
                ApplyStartTime();
                Dispatcher.UIThread.Post(async () =>
                {
                    await Task.Delay(1500);
                    TryApplyPreferences();
                    RefreshTrackButtons();
                });
            });
            _player.Paused += (_, _) => Ui(() =>
            {
                _playBtn.Content = "▶";
                Emit(new { type = "paused" });
            });
            _player.EndReached += (_, _) => Ui(() =>
            {
                Emit(new { type = "ended" });
                Close();
            });
            _player.EncounteredError += (_, _) => Ui(() =>
            {
                _statusLabel.Text = "Falha ao abrir o fluxo. Verifique a conexão e tente de novo.";
                _statusLabel.Foreground = Brush("#fbbf24");
                Emit(new { type = "error", message = "Falha no motor VLC ao abrir o arquivo original." });
            });
            _player.TimeChanged += (_, e) =>
            {
                if (DateTime.UtcNow - _lastEmit < TimeSpan.FromMilliseconds(400)) return;
                _lastEmit = DateTime.UtcNow;
                Ui(() => UpdateTime(e.Time));
            };
            _player.ESAdded += (_, _) => Ui(() =>
            {
                TryApplyPreferences();
                RefreshTrackButtons();
            });

            _media = new Media(_libVlc, _url, FromType.FromLocation);
            _media.AddOption(":network-caching=4000");
            _media.AddOption(":http-reconnect");
            _player.Play(_media);
        }
        catch (Exception ex)
        {
            _statusLabel.Text = "Não foi possível iniciar o motor VLC: " + ex.Message;
            _statusLabel.Foreground = Brush("#f87171");
            Emit(new { type = "error", message = ex.Message });
        }
    }

    void ApplyStartTime()
    {
        if (_startedSeek || _player == null || _startMs <= 0) return;
        _startedSeek = true;
        try { _player.Time = _startMs; } catch { }
    }

    void UpdateTime(long timeMs)
    {
        if (_player == null) return;
        var duration = Math.Max(0, _player.Length);
        if (!_dragging)
        {
            _seek.Value = duration > 0 ? Math.Clamp(1000.0 * timeMs / duration, 0, 1000) : 0;
        }
        _timeLabel.Text = $"{Format(timeMs)} / {Format(duration)}";
        Emit(new { type = "time", t = timeMs / 1000.0, d = duration / 1000.0 });
    }

    void TryApplyPreferences()
    {
        if (_player == null || _prefsApplied) return;
        var audio = _player.AudioTrackDescription;
        var subs = _player.SpuDescription;
        if (audio == null || audio.Length == 0) return;

        if (!_userAudio)
        {
            var chosen = PickAudio(audio);
            if (chosen is TrackDescription pickedAudio)
                _player.SetAudioTrack(pickedAudio.Id);
        }

        if (!_userSub && subs != null)
        {
            if (_autoSubs == "never")
            {
                _player.SetSpu(-1);
            }
            else
            {
                var sub = PickSubtitle(subs);
                if (sub is TrackDescription pickedSub)
                    _player.SetSpu(pickedSub.Id);
                else if (_autoSubs != "always")
                    _player.SetSpu(-1);
            }
        }

        _prefsApplied = true;
        RefreshTrackButtons();
    }

    TrackDescription? PickAudio(TrackDescription[] tracks)
    {
        var usable = tracks.Where(t => t.Id >= 0).ToArray();
        if (usable.Length == 0) return null;
        if (_preferAudio == "original")
        {
            foreach (var t in usable)
                if (IsEnglish(t.Name)) return t;
            foreach (var t in usable)
                if (!IsPortuguese(t.Name)) return t;
            return usable[0];
        }
        foreach (var t in usable)
            if (IsPortuguese(t.Name)) return t;
        return usable[0];
    }

    TrackDescription? PickSubtitle(TrackDescription[] tracks)
    {
        var usable = tracks.Where(t => t.Id >= 0).ToArray();
        if (usable.Length == 0) return null;
        foreach (var t in usable)
            if (IsPortuguese(t.Name)) return t;
        return _autoSubs == "always" ? usable[0] : null;
    }

    static bool IsPortuguese(string? name)
    {
        var n = (name ?? "").ToLowerInvariant();
        return n.Contains("portug") || n.Contains("brazil") || n.Contains("brasil")
            || n.Contains("pt-br") || n.Contains("ptbr") || n.Contains("pob")
            || n.Contains("[pt]") || n.Contains("portuguese");
    }

    static bool IsEnglish(string? name)
    {
        var n = (name ?? "").ToLowerInvariant();
        return n.Contains("english") || n.Contains("inglês") || n.Contains("ingles")
            || n.Contains("[en]") || n.Contains("eng") || n.Contains("original");
    }

    void RefreshTrackButtons()
    {
        if (_player == null) return;
        var audio = _player.AudioTrackDescription?.Where(t => t.Id >= 0).ToArray() ?? [];
        var subs = _player.SpuDescription?.Where(t => t.Id >= 0).ToArray() ?? [];
        var curA = audio.FirstOrDefault(t => t.Id == _player.AudioTrack);
        var curS = subs.FirstOrDefault(t => t.Id == _player.Spu);

        _audioBtn.Content = audio.Length <= 1 ? "Áudio" : ShortName(curA.Name, "Áudio") + " ▾";
        _subBtn.Content = _player.Spu <= 0
            ? (subs.Length == 0 ? "Legendas" : "Legendas ▾")
            : ShortName(curS.Name, "Legendas") + " ▾";
        _audioBtn.Background = audio.Length > 1 ? Brush("#461414") : Brush("#242428");
        _subBtn.Background = subs.Length > 0 ? Brush("#142846") : Brush("#242428");
        EmitTracks();
    }

    void EmitTracks()
    {
        if (_player == null) return;
        Emit(new
        {
            type = "tracks",
            audio = (_player.AudioTrackDescription ?? []).Where(t => t.Id >= 0).Select(t => new { id = t.Id, name = t.Name ?? $"Faixa {t.Id}" }),
            subs = (_player.SpuDescription ?? []).Where(t => t.Id >= 0).Select(t => new { id = t.Id, name = t.Name ?? $"Legenda {t.Id}" }),
            audioId = _player.AudioTrack,
            subId = _player.Spu,
        });
    }

    static string ShortName(string? name, string fallback)
    {
        if (string.IsNullOrWhiteSpace(name)) return fallback;
        var clean = name.Replace("Track", "", StringComparison.OrdinalIgnoreCase)
            .Replace("Audio", "", StringComparison.OrdinalIgnoreCase)
            .Replace("-", " ")
            .Trim();
        if (clean.Length > 18) clean = clean[..16] + "…";
        return string.IsNullOrWhiteSpace(clean) ? fallback : clean;
    }

    async void ShowTrackMenu(Control anchor, bool audio)
    {
        if (_player == null) return;
        var menu = new ContextMenu();

        if (audio)
        {
            var usable = (_player.AudioTrackDescription ?? []).Where(t => t.Id >= 0).ToArray();
            if (usable.Length == 0)
            {
                menu.Items.Add(new MenuItem { Header = "Áudio principal do arquivo", IsEnabled = false });
            }
            foreach (var t in usable)
            {
                var id = t.Id;
                var item = new MenuItem
                {
                    Header = t.Name ?? $"Faixa {id}",
                    ToggleType = MenuItemToggleType.Radio,
                    IsChecked = id == _player.AudioTrack,
                };
                item.Click += (_, _) =>
                {
                    _userAudio = true;
                    _player.SetAudioTrack(id);
                    RefreshTrackButtons();
                };
                menu.Items.Add(item);
            }
        }
        else
        {
            var off = new MenuItem
            {
                Header = "Desativadas",
                ToggleType = MenuItemToggleType.Radio,
                IsChecked = _player.Spu < 0,
            };
            off.Click += (_, _) =>
            {
                _userSub = true;
                _player.SetSpu(-1);
                RefreshTrackButtons();
            };
            menu.Items.Add(off);
            var usable = (_player.SpuDescription ?? []).Where(t => t.Id >= 0).ToArray();
            if (usable.Length == 0)
            {
                menu.Items.Add(new MenuItem { Header = "Nenhuma legenda no arquivo", IsEnabled = false });
            }
            foreach (var t in usable)
            {
                var id = t.Id;
                var item = new MenuItem
                {
                    Header = t.Name ?? $"Legenda {id}",
                    ToggleType = MenuItemToggleType.Radio,
                    IsChecked = id == _player.Spu,
                };
                item.Click += (_, _) =>
                {
                    _userSub = true;
                    _player.SetSpu(id);
                    RefreshTrackButtons();
                };
                menu.Items.Add(item);
            }
        }

        menu.Open(anchor);
        await Task.CompletedTask;
    }

    void TogglePause()
    {
        _player?.Pause();
    }

    void ToggleMute()
    {
        if (_player == null) return;
        _player.ToggleMute();
        _muteBtn.Content = _player.Mute ? "🔇" : "🔊";
    }

    void SeekBy(long deltaMs)
    {
        if (_player == null || _player.Length <= 0) return;
        _player.Time = Math.Clamp(_player.Time + deltaMs, 0, _player.Length - 1);
    }

    void ToggleWindowed()
    {
        if (WindowState == WindowState.FullScreen)
        {
            SystemDecorations = SystemDecorations.Full;
            WindowState = WindowState.Normal;
        }
        else
        {
            SystemDecorations = SystemDecorations.None;
            WindowState = WindowState.FullScreen;
        }
    }

    void OnKeyDown(object? sender, KeyEventArgs e)
    {
        switch (e.Key)
        {
            case Key.Space:
            case Key.K:
                TogglePause();
                e.Handled = true;
                break;
            case Key.Left:
            case Key.J:
                SeekBy(-10_000);
                e.Handled = true;
                break;
            case Key.Right:
            case Key.L:
                SeekBy(10_000);
                e.Handled = true;
                break;
            case Key.Up:
                _volume.Value = Math.Min(100, _volume.Value + 5);
                e.Handled = true;
                break;
            case Key.Down:
                _volume.Value = Math.Max(0, _volume.Value - 5);
                e.Handled = true;
                break;
            case Key.F:
                ToggleWindowed();
                e.Handled = true;
                break;
            case Key.M:
                ToggleMute();
                e.Handled = true;
                break;
            case Key.A:
                ShowTrackMenu(_audioBtn, true);
                e.Handled = true;
                break;
            case Key.S:
            case Key.C:
                ShowTrackMenu(_subBtn, false);
                e.Handled = true;
                break;
            case Key.Escape:
                Close();
                e.Handled = true;
                break;
        }
    }

    void ShutdownPlayer()
    {
        if (_closing) return;
        _closing = true;
        Emit(new { type = "closed" });
        try
        {
            if (_player != null)
            {
                _video.MediaPlayer = null;
                _player.Stop();
                _player.Dispose();
                _player = null;
            }
            _media?.Dispose();
            _libVlc?.Dispose();
        }
        catch { }
    }

    void Ui(Action action)
    {
        if (_closing) return;
        Dispatcher.UIThread.Post(action);
    }

    static void Emit(object payload)
    {
        try
        {
            var json = JsonSerializer.Serialize(payload, JsonOpts);
            Console.OutputEncoding = Encoding.UTF8;
            Console.WriteLine("AURA " + json);
            Console.Out.Flush();
        }
        catch { }
    }

    static string Format(long ms)
    {
        if (ms <= 0) return "00:00";
        var ts = TimeSpan.FromMilliseconds(ms);
        return ts.TotalHours >= 1
            ? ts.ToString(@"h\:mm\:ss", CultureInfo.InvariantCulture)
            : ts.ToString(@"mm\:ss", CultureInfo.InvariantCulture);
    }
}
