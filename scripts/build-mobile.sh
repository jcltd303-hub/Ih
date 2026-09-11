#!/usr/bin/env bash
set -e

echo "[Mobile Build] Compiling web production bundle..."
npm run build

echo "[Mobile Build] Synchronizing with Capacitor native shell..."
npx cap sync

echo "[Mobile Build] Opening Android Studio / Xcode project..."
# npx cap open android
# npx cap open ios
echo "[Mobile Build] Sync complete! Run 'npx cap open android' or 'npx cap open ios' to deploy."
