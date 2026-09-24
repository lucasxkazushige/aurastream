# AuraStream Desktop (Go)

Cliente Windows **100% Go**. Sem Electron.

- Catálogo nativo (Gio)
- Player nativo **libVLC** no mesmo processo (arquivo original, áudio e legendas)

## Compilar no Linux para Windows

```bash
cd desktop-go
go mod tidy
CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -ldflags="-H windowsgui -s -w" -o AuraStream.exe .
```

Junte o `.exe` com `libvlc.dll`, `libvlccore.dll` e a pasta `plugins/` (os mesmos arquivos do VLC / `desktop/native-player/publish`).
