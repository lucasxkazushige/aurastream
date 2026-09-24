# AuraPlayer — motor VLC integrado

Player Windows do AuraStream. Usa **libVLC** para tocar o **arquivo original** (o mesmo link HTTP do torrent), com troca de idioma e legendas como no VLC. Sem transcode e sem FFmpeg.

## Compilar (a partir de Linux ou Windows)

```bash
dotnet publish AuraPlayer.csproj -c Release -r win-x64 --self-contained true -o publish
```

O Electron empacota a pasta `publish/` em `resources/AuraPlayer/`.
