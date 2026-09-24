# 🚀 Como publicar uma nova versão com Auto-Update

## Pré-requisitos

1. Criar o repositório `aurastream` no GitHub: https://github.com/new
   - Pode ser **privado** (o electron-updater funciona com repo privado também)
2. Gerar um **Personal Access Token** (PAT) com permissão `repo`:
   - https://github.com/settings/tokens → "Generate new token (classic)"
   - Marque: `repo` (full control)
   - Copie o token gerado

## Primeira vez (configurar)

```bash
# 1. Inicializar git no projeto
cd /root/streaming-app/desktop
git init
git remote add origin https://github.com/lucasxkazushige/aurastream.git

# 2. Exportar o token do GitHub (necessário para o electron-builder publicar)
export GH_TOKEN=ghp_SEU_TOKEN_AQUI
```

## Gerar o instalador + publicar no GitHub Releases

```bash
cd /root/streaming-app/desktop

# Instalar dependências (só na primeira vez)
npm install

# Build do frontend (sempre antes de buildar o desktop)
cd ../frontend && npm run build && cd ../desktop

# Gerar instalador Windows + publicar automaticamente no GitHub Releases
GH_TOKEN=ghp_SEU_TOKEN_AQUI npm run release
```

Isso vai:
- Gerar `AuraStream-Setup.exe` (instalador NSIS) em `release/`
- Gerar `AuraStream-Setup.exe.blockmap` e `latest.yml` (usados pelo auto-update)
- Criar automaticamente um **GitHub Release** com todos os arquivos

## Copiar o instalador para a pasta downloads (servidor)

```bash
cp release/AuraStream\ 4K\ Setup\ 1.0.0.exe /root/streaming-app/downloads/AuraStream-Setup.exe
```

## Como funciona o Auto-Update

```
Usuário instala AuraStream-Setup.exe
         ↓
App abre → aguarda 5 segundos
         ↓
electron-updater consulta: https://github.com/lucasxkazushige/aurastream/releases/latest
         ↓
Se versão nova disponível:
  → baixa silenciosamente em background
  → mostra notificação no app com barra de progresso
  → ao fechar o app: instala automaticamente
  → ou o usuário clica "Reiniciar e Instalar Agora"
```

## Publicar uma nova versão (v1.1.0 por exemplo)

```bash
# 1. Editar a versão no package.json
#    "version": "1.1.0"

# 2. Publicar
GH_TOKEN=ghp_SEU_TOKEN_AQUI npm run release
```

Todos os usuários que já instalaram a v1.0.0 receberão a atualização automaticamente!

## Arquivos gerados em `release/`

| Arquivo | Descrição |
|---|---|
| `AuraStream 4K Setup 1.0.0.exe` | Instalador NSIS — distribua este |
| `AuraStream 4K 1.0.0.exe` | Versão portable (sem instalar) |
| `latest.yml` | Metadados usados pelo auto-update |
| `AuraStream 4K Setup 1.0.0.exe.blockmap` | Necessário para o auto-update delta |

## Variável de ambiente GH_TOKEN no VPS

Para facilitar, adicione ao `.env` do backend:

```env
GH_TOKEN=ghp_SEU_TOKEN_AQUI
```

Ou no sistema:
```bash
echo 'export GH_TOKEN=ghp_SEU_TOKEN_AQUI' >> ~/.bashrc
source ~/.bashrc
```
