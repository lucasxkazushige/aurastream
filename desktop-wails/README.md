# AuraStream Desktop (Wails)

App Windows moderno: **Wails v2** (interface web no WebView2) + **libVLC** nativo para o player.

Não usa Electron. O catálogo é o mesmo frontend React; o filme abre no motor VLC.

```bash
cd frontend && npm run build
cd ../desktop-wails
rm -rf frontend/dist && cp -a ../frontend/dist frontend/dist
go mod tidy
CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -tags "production,desktop" -ldflags="-H windowsgui -s -w" -o AuraStream.exe .
```
