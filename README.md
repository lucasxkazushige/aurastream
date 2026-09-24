# 🎬 AuraStream 4K

Plataforma de streaming universal com suporte a WebTorrent, HLS e reprodução 4K nativa com aceleração por hardware (GPU).

---

## 🌟 Funcionalidades

- **4K HDR & Hardware Acceleration:** Player nativo integrado com suporte a aceleração gráfica por GPU.
- **Instalador Windows Automático:** Instalador `.exe` (NSIS) com criação de atalho na Área de Trabalho e Menu Iniciar.
- **Auto-Update Integrado:** O aplicativo detecta e baixa novas versões automaticamente em segundo plano via GitHub Releases.
- **Smart TV / Android Box:** Suporte a TV Box, Firestick e Addon oficial para Stremio.

---

## 🚀 Como Lançar uma Nova Versão (100% Automático)

Para compilar e publicar uma nova versão com instalador para Windows e Linux:

```bash
./scripts/nova-versao.sh 1.0.0
```

Este comando executa automaticamente:
1. Atualização do número de versão no `desktop/package.json`
2. Criação do commit e tag Git (`v1.0.0`)
3. Disparo do **GitHub Actions** para compilar o executável na nuvem
4. Publicação automática dos instaladores no **GitHub Releases**
5. O site e aplicativo passam a servir/baixar a versão nova automaticamente

---

## 📁 Estrutura do Projeto

- `frontend/` — Interface web moderna em React, Vite e TailwindCSS
- `backend/` — Servidor Node.js / Express / WebSockets com integração TMDB e Cloudflare R2
- `desktop/` — Aplicativo desktop Electron com player acelerado por hardware e auto-updater
- `.github/workflows/` — Fluxo de CI/CD para compilação automática na nuvem
