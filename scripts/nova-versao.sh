#!/usr/bin/env bash
# =============================================================================
# AuraStream — Lançar nova versão com 1 comando
# Uso: ./scripts/nova-versao.sh 1.1.0
# =============================================================================

set -euo pipefail

VERSION="${1:-}"

# ── Validações ────────────────────────────────────────────────────────────────
if [[ -z "$VERSION" ]]; then
  echo "❌  Uso: ./scripts/nova-versao.sh <versao>"
  echo "    Exemplo: ./scripts/nova-versao.sh 1.1.0"
  exit 1
fi

if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "❌  Versão inválida: '$VERSION'. Use o formato X.Y.Z (ex: 1.1.0)"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DESKTOP_DIR="$ROOT_DIR/desktop"
TAG="v$VERSION"

echo ""
echo "🚀 AuraStream — Publicando versão $TAG"
echo "============================================"

# ── Verificar git ─────────────────────────────────────────────────────────────
cd "$ROOT_DIR"

if ! git rev-parse --git-dir &>/dev/null; then
  echo "❌  Este diretório não é um repositório git."
  echo "    Rode primeiro: git init && git remote add origin https://github.com/lucasxkazushige/aurastream.git"
  exit 1
fi

if git rev-parse "$TAG" &>/dev/null; then
  echo "❌  A tag '$TAG' já existe. Use uma versão maior."
  exit 1
fi

# ── Atualizar versão no package.json do desktop ──────────────────────────────
echo ""
echo "📝 Atualizando versão para $VERSION no desktop/package.json..."
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('$DESKTOP_DIR/package.json', 'utf8'));
  pkg.version = '$VERSION';
  fs.writeFileSync('$DESKTOP_DIR/package.json', JSON.stringify(pkg, null, 2) + '\n');
"
echo "   ✅ desktop/package.json atualizado"

# ── Commit + Tag ─────────────────────────────────────────────────────────────
echo ""
echo "📦 Criando commit e tag git..."
git add desktop/package.json
git commit -m "chore: release $TAG" --allow-empty
git tag -a "$TAG" -m "AuraStream Desktop $TAG"
echo "   ✅ Tag $TAG criada"

# ── Push para GitHub ──────────────────────────────────────────────────────────
echo ""
echo "🔼 Enviando para o GitHub..."
git push origin HEAD
git push origin "$TAG"
echo "   ✅ Push realizado"

# ── Resultado ─────────────────────────────────────────────────────────────────
echo ""
echo "============================================"
echo "✅  PRONTO! Versão $TAG publicada com sucesso."
echo ""
echo "⏳  O GitHub Actions está buildando agora (~5-10 min)."
echo "    Acompanhe em:"
echo "    https://github.com/lucasxkazushige/aurastream/actions"
echo ""
echo "📦  Quando terminar, o instalador estará disponível em:"
echo "    https://github.com/lucasxkazushige/aurastream/releases/tag/$TAG"
echo ""
echo "🌐  Seu site já vai servir a nova versão automaticamente"
echo "    (o backend busca sempre o release mais recente do GitHub)."
echo ""
echo "🔄  Usuários que já instalaram receberão o update automático!"
echo "============================================"
