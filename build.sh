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

# Source cargo env to ensure PATH is set correctly
if [ -f "$CARGO_HOME/env" ]; then
    source "$CARGO_HOME/env"
fi

# Optimize Cargo for CI/CD (faster builds, better caching)
export CARGO_NET_GIT_FETCH_WITH_CLI=true
export CARGO_NET_RETRY=10

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

# Install clippy if not already installed
if ! rustup component list --installed | grep -q "clippy"; then
    echo "Installing clippy..."
    rustup component add clippy
fi

# Verify formatting
echo "Checking code formatting with rustfmt..."
if ! cargo fmt --check --all; then
    echo "❌ Error: Code is not properly formatted."
    echo "💡 Run 'cargo fmt' to fix formatting issues."
    exit 1
fi
echo "✅ Formatting OK"

# Verify lints
echo "Checking lints with clippy..."
if ! cargo clippy --all-targets --all-features -- -D warnings; then
    echo "❌ Error: Clippy warnings detected."
    echo "💡 Fix warnings before building."
    exit 1
fi
echo "✅ Lints OK"

# Build the project (used by Vercel)
# Using incremental compilation for faster rebuilds
echo "Building project with Trunk (index.html, release)..."
trunk build index.html --release

echo "Build complete!"
