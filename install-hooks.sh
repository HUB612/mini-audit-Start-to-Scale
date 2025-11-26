#!/bin/bash
# Script pour installer les hooks git du projet

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOKS_DIR="$SCRIPT_DIR/.git/hooks"

if [ ! -d "$HOOKS_DIR" ]; then
    echo "❌ Erreur: Le répertoire .git/hooks n'existe pas."
    echo "   Assurez-vous d'être dans un dépôt git."
    exit 1
fi

echo "📦 Installation des hooks git..."

# Copier les hooks
if [ -f "$SCRIPT_DIR/.git/hooks/pre-commit" ]; then
    echo "✅ Hook pre-commit déjà installé"
else
    echo "❌ Erreur: Le hook pre-commit n'existe pas."
    exit 1
fi

if [ -f "$SCRIPT_DIR/.git/hooks/commit-msg" ]; then
    echo "✅ Hook commit-msg déjà installé"
else
    echo "❌ Erreur: Le hook commit-msg n'existe pas."
    exit 1
fi

# S'assurer que les hooks sont exécutables
chmod +x "$HOOKS_DIR/pre-commit"
chmod +x "$HOOKS_DIR/commit-msg"

echo "✅ Tous les hooks sont installés et prêts à être utilisés !"
echo ""
echo "Les hooks vérifieront automatiquement :"
echo "  - Le formatage du code (rustfmt) avant chaque commit"
echo "  - Les lints (clippy) avant chaque commit"
echo "  - Le format des messages de commit (convention: type: description)"

