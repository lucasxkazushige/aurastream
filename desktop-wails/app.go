package main

import (
	"context"
	"net/url"
	"os"
	"strings"

	"aurastream/wails/player"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx     context.Context
	backend string
}

func NewApp() *App {
	base := os.Getenv("AURA_URL")
	if base == "" {
		base = "http://151.247.210.55:7700"
	}
	return &App{backend: strings.TrimRight(base, "/")}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	player.SetEventHandler(func(ev map[string]any) {
		if a.ctx != nil {
			runtime.EventsEmit(a.ctx, "player:event", ev)
		}
	})
	player.SetOnClosed(func() {
		if a.ctx != nil {
			runtime.EventsEmit(a.ctx, "player:event", map[string]any{"type": "closed"})
		}
	})
	player.SetFullscreenToggle(func() bool {
		return a.ToggleFullscreen()
	})
}

func (a *App) BackendOrigin() string {
	return a.backend
}

func (a *App) IsNative() bool {
	return true
}

func (a *App) PlayNative(streamURL, title string, startSeconds float64, x, y, w, h int) string {
	_, _, _, _ = x, y, w, h
	streamURL = a.absoluteURL(streamURL)
	if title == "" {
		title = "AuraStream 4K"
	}
	parent := player.FindAppHWND()
	if err := player.PlayInHost(parent, streamURL, title, startSeconds); err != nil {
		return err.Error()
	}
	return ""
}

func (a *App) StopPlayer() {
	player.StopActive()
}

func (a *App) PlayerPause() {
	player.Command("toggle", 0, 0, false)
}

func (a *App) PlayerSeek(ms float64) {
	player.Command("seek", ms, 0, false)
}

func (a *App) PlayerVolume(vol float64) {
	player.Command("volume", vol, 0, false)
}

func (a *App) PlayerMute(muted bool) {
	player.Command("mute", 0, 0, muted)
}

func (a *App) PlayerSetAudio(id int) {
	player.Command("audio", 0, int32(id), false)
}

func (a *App) PlayerSetSpu(id int) {
	player.Command("spu", 0, int32(id), false)
}

func (a *App) PlayerSetBounds(x, y, w, h int) {
	// O player nativo preenche 100% da janela; bounds do HTML são ignorados.
}

func (a *App) ToggleFullscreen() bool {
	if a.ctx == nil {
		return false
	}
	if runtime.WindowIsFullscreen(a.ctx) {
		runtime.WindowUnfullscreen(a.ctx)
		return false
	}
	runtime.WindowFullscreen(a.ctx)
	return true
}

func (a *App) SetFullscreen(on bool) bool {
	if a.ctx == nil {
		return false
	}
	if on {
		runtime.WindowFullscreen(a.ctx)
		return true
	}
	runtime.WindowUnfullscreen(a.ctx)
	return false
}

func (a *App) IsFullscreen() bool {
	if a.ctx == nil {
		return false
	}
	return runtime.WindowIsFullscreen(a.ctx)
}

func (a *App) absoluteURL(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return raw
	}
	if strings.HasPrefix(raw, "/") {
		return a.backend + raw
	}
	u, err := url.Parse(raw)
	if err != nil {
		return raw
	}
	host := strings.ToLower(u.Host)
	if strings.HasPrefix(u.Path, "/api/stream") &&
		(u.Scheme == "wails" || strings.Contains(host, "wails") || strings.Contains(host, "localhost")) {
		return a.backend + u.Path + q(u.RawQuery)
	}
	if u.Scheme == "http" || u.Scheme == "https" {
		return raw
	}
	return a.backend + "/" + strings.TrimPrefix(raw, "/")
}

func q(query string) string {
	if query == "" {
		return ""
	}
	return "?" + query
}
