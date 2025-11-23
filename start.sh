#!/bin/bash

# Script de démarrage pour l'application Hub Survey

echo "🚀 Démarrage de Hub Survey..."
echo ""

# Vérifier que Trunk est installé
if ! command -v trunk &> /dev/null; then
    echo "❌ Trunk n'est pas installé."
    echo "Installez-le avec: cargo install --locked trunk"
    exit 1
fi

# Vérifier que la cible wasm32-unknown-unknown est installée
if ! rustup target list --installed | grep -q "wasm32-unknown-unknown"; then
    echo "📦 Installation de la cible wasm32-unknown-unknown..."
    rustup target add wasm32-unknown-unknown
fi

echo "✅ Démarrage du serveur de développement..."
echo "🌐 Ouvrez http://localhost:8080 dans votre navigateur"
echo ""

trunk serve index.html

