# Fish Frenzy // Cyber Trench Arcade

A cyberpunk arcade fishing game built with **PixiJS v8**, boid swarm physics, provably fair RTP mechanics, and animated modular turret skins.

## 🚀 Key Features

- **PixiJS v8 High-Performance Renderer**: 60 FPS deep-sea visual pipeline with caustic light refraction, god rays, marine snow, and bloom glitch post-processing.
- **Flocking Boid Physics**: Spatial hash grid partitioning driving real-time schooling behavior for small tetras, armored lionfish, and apex Leviathan bosses.
- **Animated Weapon Chassis & Armory**:
  - **Plasma Neon Railgun**: Dual magnetic rails, pulsing cyan/magenta core, high-voltage lightning arcs, and kinetic ion slugs.
  - **Gilded Sunstone Solar Obelisk**: Antique bronze chassis, faceted topaz gem lens, solar flare charging, and starburst solar lance blasts.
  - **Abyssal Dread Juggernaut**: Spiked iron fortress dome, rotary Gatling shroud, tumbling brass shell casings, and crimson rocket payloads.
  - **Tactical Navy Dual-Cannon**: Titanium naval armor, twin plasma bores, and high-energy dual plasma bolts.
- **Calibrated Sprite Alignment**:
  - 12-frame horizontal sprite sheets (`public/skins/*_sheet.png`) with true RGBA alpha transparency.
  - Base-pivot anchoring `(0.5, 0.78125)` ensuring 360-degree rotation around the swivel pedestal.
  - Aim-synchronized muzzle projectile spawning.
- **Provably Fair Mechanics**: Cryptographic SHA-256 seed hashing, client-side entropy verification, and Monte Carlo RTP audit tests.
- **Multiplatform Deployment**:
  - **Web / Desktop / Mobile**: Responsive canvas scaling with Capacitor touch/haptics support.
  - **GitHub Pages CI/CD**: Automated deployment workflow (`.github/workflows/Deploy.yml`).
  - **Node.js CI**: Automated linting, Vitest test suites, and build verification (`.github/workflows/webpack.yml`).

## 🛠️ Development & Build

```bash
# Install dependencies
npm install

# Start local development server (binds to 0.0.0.0:3000)
npm run dev

# Run test suites (Provably Fair & Monte Carlo RTP simulation)
npm test

# Type check
npm run lint

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
