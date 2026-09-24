# AuraStream 4K - Aplicativo Desktop Dedicado

Aplicativo oficial Desktop do **AuraStream**, com aceleração total por hardware (GPU) da sua máquina para reprodução de vídeo em 4K nativo sem passar por navegadores comuns.

## Como Executar Localmente no seu Computador (Windows / Linux / Mac)

1. Certifique-se de ter o **Node.js** instalado no seu computador.
2. Clone ou copie esta pasta `streaming-app/desktop` para seu PC.
3. Instale as dependências:
```bash
npm install
```
4. Inicie o aplicativo:
```bash
npm start
```

*Por padrão ele se conecta ao seu servidor AuraStream em `http://151.247.210.55:7700`. Para usar outra URL, execute `AURA_URL=http://seu-ip:7700 npm start`.*

## Como Gerar o Executável (.EXE para Windows ou .AppImage para Linux)

Para compilar o executável de instalação para seu sistema operacional:

```bash
# Gerar instalador Windows (.exe)
npm run dist -- --win

# Gerar pacote Linux (.AppImage ou .deb)
npm run dist -- --linux

# Gerar pacote Mac (.dmg)
npm run dist -- --mac
```

Os arquivos prontos serão gerados na pasta `release/`.

## Player integrado (motor VLC)

O player interno do Windows **não usa o HTML5 do Chromium** (que só lê a faixa principal de um MKV). Um processo Go mínimo (`embedplayer.exe`) carrega **libVLC** e desenha o vídeo **dentro da janela do AuraStream** (HWND filho). Idioma e legendas são os menus do próprio app.

Antes de gerar o `.exe` do AuraStream, compile o player:

```bash
npm run build:player
npm run dist -- --win
```
