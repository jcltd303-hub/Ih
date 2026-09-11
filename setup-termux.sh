#!/data/data/com.termux/files/usr/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "[Termux Setup] Updating package repositories..."
pkg update -y && pkg upgrade -y

echo "[Termux Setup] Requesting external storage permissions..."
termux-setup-storage

echo "[Termux Setup] Installing core system packages & development tools..."
pkg install -y \
 git \
 curl \
 wget \
 build-essential \
 python \
 nodejs-lts \
 proot \
 openssh

echo "[Termux Setup] Configuring npm environment..."
npm config set python python3

echo "[Termux Setup] Verifying installations..."
node -v
npm -v
git --version

echo "[Termux Setup] Setup complete! Your Termux environment is ready for development."
