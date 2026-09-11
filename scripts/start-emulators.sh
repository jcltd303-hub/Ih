#!/usr/bin/env bash
echo "[Firebase Emulators] Starting local suite (Auth, Firestore, RTDB, Functions)..."
firebase emulators:start --import=./emulator-data --export-on-exit
