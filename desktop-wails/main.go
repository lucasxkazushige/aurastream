package main

import (
	"embed"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strings"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app := NewApp()
	backend := os.Getenv("AURA_URL")
	if backend == "" {
		backend = "http://151.247.210.55:7700"
	}
	target, _ := url.Parse(strings.TrimRight(backend, "/"))
	proxy := httputil.NewSingleHostReverseProxy(target)

	err := wails.Run(&options.App{
		Title:             "AuraStream 4K",
		Width:             1360,
		Height:            860,
		MinWidth:          1100,
		MinHeight:         700,
		Frameless:         false,
		BackgroundColour:  &options.RGBA{R: 10, G: 10, B: 12, A: 255},
		OnStartup:         app.startup,
		StartHidden:       false,
		HideWindowOnClose: false,
		AssetServer: &assetserver.Options{
			Assets: assets,
			Middleware: func(next http.Handler) http.Handler {
				return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					if strings.HasPrefix(r.URL.Path, "/api") || strings.HasPrefix(r.URL.Path, "/stremio") {
						r.Host = target.Host
						r.URL.Scheme = target.Scheme
						r.URL.Host = target.Host
						proxy.ServeHTTP(w, r)
						return
					}
					next.ServeHTTP(w, r)
				})
			},
		},
		Bind: []interface{}{app},
		Windows: &windows.Options{
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
			DisableWindowIcon:    false,
			Theme:                windows.Dark,
		},
	})
	if err != nil {
		println("Error:", err.Error())
	}
}
