# Fish Frenzy // Cyber Trench Arcade

A cyberpunk arcade fishing game built with **PixiJS v8**, boid swarm physics, and provably fair RTP mechanics.

## 🚀 Key Features

- **PixiJS v8 High-Performance Renderer**: 60 FPS deep-sea visual pipeline with caustic light refraction and god rays.
- **Flocking Boid Physics**: Spatial hash grid partitioning driving real-time schooling behavior.
- **Animated Weapon Chassis**: Modular cannon support with aim-synchronized muzzle projectile spawning.
- **Provably Fair Mechanics**: Cryptographic SHA-256 seed hashing and RTP audit verification.

## 🛠️ Development & Build

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Run tests
npm test

# Run CI test suite
npm run test:ci

# Type check
npm run typecheck

# Production build
npm run build
```

## 📦 Project Structure

```
├── public/
│   ├── skins/                  # Calibrated 12-frame animated turret sprite sheets & JSON
│   ├── deep_abyss_seabed.jpg   # Trench background texture
│   └── leviathan_boss.png      # Boss entity sprite
├── src/
│   ├── audio/                  # Synthesized procedural sound effects
│   ├── engine/
│   │   ├── core/               # GameScene and ticker management
│   │   └── systems/            # WeaponController, SpriteSheetManager, BoidSwarmManager, etc.
│   ├── network/                # LoadoutManager, Firebase client, Multiplayer table
│   ├── ui/                     # Cyberpunk HUD, Armory modal, Provably Fair auditor
│   └── utils/                  # ProvablyFairAuditor and mathematical helpers
├── tests/                      # Unit tests for RTP compliance and provable fairness
└── .github/workflows/          # GitHub Pages deployment and CI workflows
```
[![Deploy Fish Frenzy to GitHub Pages](https://github.com/jcltd303-hub/Ih/actions/workflows/Deploy.yml/badge.svg)](https://github.com/jcltd303-hub/Ih/actions/workflows/Deploy.yml)
