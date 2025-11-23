#!/bin/bash
set -e

echo "Starting build for Vercel..."

# Ensure Rust toolchain is installed (needed for cargo & rustup)
if ! command -v cargo &> /dev/null; then
    echo "Rust (cargo) not found. Installing Rust toolchain with rustup..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
fi

# Ensure cargo / rustup are in PATH
export CARGO_HOME="${CARGO_HOME:-$HOME/.cargo}"
if [ -d "$CARGO_HOME/bin" ]; then
    export PATH="$CARGO_HOME/bin:$PATH"
fi

# Install Trunk if not already installed
if ! command -v trunk &> /dev/null; then
    echo "Installing Trunk..."
    cargo install --locked trunk
fi

# Add wasm32 target if not already added
if ! rustup target list --installed | grep -q "wasm32-unknown-unknown"; then
    echo "Adding wasm32-unknown-unknown target..."
    rustup target add wasm32-unknown-unknown
fi

# Build the project (used by Vercel)
echo "Building project with Trunk (index.html, release)..."
trunk build index.html --release

echo "Build complete!"
