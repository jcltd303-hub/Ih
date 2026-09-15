# Fish Frenzy — Comprehensive Upgrade Plan

## Goal

Transform Fish Frenzy from a casino-style mobile game UI into a polished arcade combat game with a **Street Fighter II-inspired HUD**, responsive combat feedback, reliable boss encounters, tuned turret mechanics, distinct light/dark presentation, and dependable audio.

The existing architecture already contains much of what is needed:

- `StreetFighterBossBar`
- `ArcadeCombatWidgets`
- `GameEventBus`
- `ThemeManager`
- `AudioManager`
- Boss events
- Combo events
- Turret events
- Theme events
- Payout engine
- Monte Carlo tooling/tests

The priority is therefore **polish + correctness + tuning**, not a wholesale rewrite.

---

# 1. Arcade Visual Identity

## Replace the current visual language

Move away from:

- casino/mobile-game styling
- excessive neon
- rounded toy-like panels
- giant glowing buttons
- random cyan/pink/purple accents
- excessive gradients
- generic modal cards

Move toward:

- arcade fighting-game HUD
- sharp rectangular geometry
- high-contrast borders
- condensed display typography
- segmented health bars
- compact information panels
- restrained accent colors
- aggressive combat feedback
- screen-edge HUD elements
- animated round-state banners

### Visual references

Think:

- Street Fighter II
- classic arcade cabinets
- fighting-game tournament overlays
- CRT-era broadcast graphics
- industrial control panels
- tactical combat HUDs

---

# 2. Global Design System

Create one shared visual language.

## Typography

Use a condensed arcade/display font stack:

```css
Impact,
"Arial Narrow",
"Roboto Condensed",
sans-serif
```

Use:

- uppercase labels
- condensed numbers
- bold combat messages
- italicized impact typography where appropriate

Avoid excessive text.

---

# 3. HUD Architecture

Create a unified combat HUD:

```text
CombatHUD
├── PlayerBar
├── BossBar
├── Combo
├── TurretStatus
├── KillFeed
├── Crosshair
├── DamageNumbers
├── RoundBanner
├── PayoutDisplay
└── StatusIndicators
```

The HUD should feel like one system rather than a collection of unrelated widgets.

---

# 4. Player Health / Power Bar

Create a fighting-game-style player bar.

Display:

```text
PLAYER
████████████████████
```

Potential information:

- player status
- current balance
- weapon level
- multiplier
- combo state

Use segmented geometry instead of a smooth casino progress bar.

---

# 5. Boss Health Bar

The existing `StreetFighterBossBar` is already close to the target.

Improve it rather than replacing it.

## Required behavior

Active health:

```text
████████████████░░░░
```

Trailing damage:

```text
████████████████████
        ↓
████████████████░░░░
```

The active bar should drop immediately.

The trailing bar should follow approximately:

```text
250–500ms
```

after the actual damage.

## Boss danger states

At:

```text
< 30% HP → DANGER
< 15% HP → CRITICAL
```

Change:

- animation
- typography
- screen effects
- warning indicators
- audio intensity

---

# 6. Boss Encounter State Machine

Boss mode must be reliable and visible.

Implement explicit round states:

```text
READY
  ↓
3
  ↓
2
  ↓
1
  ↓
FIGHT
  ↓
BOSS
  ↓
KO / ESCAPED
  ↓
RESULT
```

Do not rely on incidental UI events to determine whether the boss is active.

## Boss requirements

A boss encounter must:

1. Trigger deterministically.
2. Display the boss warning.
3. Display the boss intro.
4. Enter boss gameplay state.
5. Start boss music.
6. Display the boss HUD.
7. Track boss HP.
8. Display boss phases.
9. End with either:
   - BOSS DEFEATED
   - BOSS ESCAPED
10. Return cleanly to normal gameplay.

---

# 7. Boss Intro Presentation

When the boss arrives:

- briefly freeze or slow normal gameplay
- dim the playfield
- show boss name
- show boss portrait/sprite
- animate the boss HUD into position
- play a short intro sting
- then return to combat

Example:

```text
━━━━━━━━━━━━━━━━━━━━━━━━━━
        WARNING
      BOSS APPROACHING
━━━━━━━━━━━━━━━━━━━━━━━━━━

          THE ABYSSAL
             KING

        GET READY
━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Keep it arcade-like, not casino-like.

---

# 8. Boss Phases

Boss phases should materially affect gameplay.

Example:

```text
PHASE 1 — HUNT
```

Normal behavior.

```text
PHASE 2 — ENRAGED
```

Increase:

- movement speed
- attack frequency
- spawn pressure
- visual effects
- music intensity

Potential future:

```text
PHASE 3 — FINAL
```

Triggered below a critical HP threshold.

---

# 9. Boss Music

Boss music should begin exactly when the boss becomes active.

Audio flow:

```text
GAMEPLAY
   ↓
BOSS INTRO
   ↓
BOSS MUSIC
   ↓
ENRAGED MUSIC / INTENSITY
   ↓
VICTORY / DEFEAT
   ↓
GAMEPLAY MUSIC
```

Use crossfades instead of abrupt starts/stops.

---

# 10. Turret Multiplier Overhaul

Current turret behavior feels too frequent and lasts too long.

Replace the current simple active-duration presentation with:

```text
READY
  ↓
ACTIVE
  ↓
COOLDOWN
  ↓
READY
```

HUD:

```text
TURRET
READY
```

During activation:

```text
TURRET
x2
████████████████
ACTIVE
```

After expiration:

```text
TURRET
COOLDOWN
██████░░░░░░░░░░
```

---

# 11. Turret Tuning

Centralize turret parameters:

```ts
turretCooldown
turretDuration
turretMultiplier
turretTriggerThreshold
```

Do not tune these values independently throughout the codebase.

The first tuning pass should:

- reduce trigger frequency
- shorten active duration
- increase meaningfulness of activation
- prevent repeated immediate triggers
- make activation visually obvious

---

# 12. Separate Combat Multipliers From Economy Multipliers

This is important.

Do not let presentation bonuses accidentally alter payout calculations.

Use separate concepts:

```ts
CombatMultiplier
```

and

```ts
PayoutMultiplier
```

Combat multiplier controls:

- damage
- combo feedback
- visual intensity
- weapon power

Payout multiplier controls:

- authoritative monetary result

The payout engine remains authoritative.

---

# 13. Combo System

Make combos feel like arcade mechanics.

Example:

```text
COMBO
17 HIT

x2.40
```

At milestones:

```text
5 HIT
10 HIT
20 HIT
30 HIT
50 HIT
```

trigger stronger presentation.

Combo bar:

```text
COMBO WINDOW
██████████░░░░░
```

When the timer expires:

```text
COMBO BREAK
```

---

# 14. Arcade Announcer System

Introduce short combat callouts:

```text
READY!
FIGHT!
COMBO!
CRITICAL!
NICE!
BOSS!
ENRAGED!
K.O.!
```

These should be:

- short
- punchy
- rare enough to stay meaningful

Avoid firing announcer effects on every minor event.

---

# 15. Damage Numbers

Add floating combat numbers.

Examples:

```text
-24
```

```text
CRIT -86
```

```text
BOSS -142
```

```text
+0.25 SC
```

Damage numbers should:

- spawn near the target
- move upward
- fade
- scale based on damage
- use stronger presentation for critical hits

---

# 16. Target Hierarchy

Make targets visually distinguishable.

```text
NORMAL
ELITE
CRITICAL
BOSS
```

Each should have increasingly strong:

- outline
- hit effect
- damage response
- audio
- HUD feedback

---

# 17. Persistent Crosshair

Add a proper combat crosshair.

States:

```text
IDLE
TARGET
LOCK
HIT
CRITICAL
```

Example:

```text
   ┌─────┐
   │  +  │
   └─────┘
```

On hit:

```text
   ╲  X  ╱
```

The crosshair should become part of the game's identity.

---

# 18. Kill Feed

Add a compact arcade kill feed.

Example:

```text
FISH DOWN
BASS +0.12
SHARK +0.40
CRIT +0.75
```

Keep it small and unobtrusive.

---

# 19. Round Banner

Introduce large center-screen combat announcements.

Examples:

```text
READY
```

```text
FIGHT!
```

```text
BOSS!
```

```text
ENRAGED!
```

```text
K.O.!
```

Use:

- scale-in
- slight screen shake
- short duration
- fade/slide out

---

# 20. Screen Shake

Use screen shake selectively.

Events:

```text
CRITICAL_HIT
BOSS_HIT
BOSS_DEFEATED
K.O.
TURRET_TRIGGER
```

Intensity should scale with event importance.

Never shake continuously.

---

# 21. Hit Stop

Add very short hit-stop for important impacts.

Example:

```text
normal hit:    0ms
critical:     30ms
boss hit:     40ms
boss defeat: 100ms
```

This creates a much stronger arcade feel.

---

# 22. Start Screen Redesign

Replace the existing:

```text
SWEEPSTAKES CASINO
Aim · Hold to fire · Win big
```

presentation.

Use a stronger arcade identity.

Example:

```text
FISH FRENZY

DEEP SEA COMBAT

PRESS START

PLAY
LOADOUT
HOW TO PLAY
SETTINGS
```

Keep wallet/balance information available but visually secondary.

---

# 23. Button System

Buttons should become consistent.

States:

```text
NORMAL
HOVER
PRESSED
DISABLED
ACTIVE
```

Avoid:

- giant rounded mobile buttons
- excessive glow
- rainbow gradients

Use:

- hard edges
- strong borders
- compact labels
- subtle depth
- clear pressed state

---

# 24. Bet Selector

Redesign the betting control as an arcade selector.

Example:

```text
BET

[ - ]   $0.25   [ + ]
```

or:

```text
BET
$0.05
$0.10
$0.25
$0.50
$1.00
```

The active selection should look like a fighting-game HUD selection.

---

# 25. Fire Control

The fire control should visually communicate:

```text
READY
FIRING
COOLDOWN
NO FUNDS
PAUSED
```

The user should always know why a shot did or did not fire.

---

# 26. Modal Redesign

All modals should share one visual system.

Use:

```text
┌──────────────────────────────┐
│ BOSS DEFEATED                │
├──────────────────────────────┤
│                              │
│        THE ABYSSAL KING      │
│                              │
│       DAMAGE     12,420      │
│       COMBO          27      │
│       BONUS        x2.40     │
│                              │
│          [ CONTINUE ]        │
└──────────────────────────────┘
```

Avoid generic floating white/mobile cards.

---

# 27. Boss Result Modal

Results should feel like an arcade score screen.

```text
K.O.

BOSS DEFEATED

DAMAGE
12,420

MAX COMBO
27

TURRET BONUS
x2.00

PAYOUT
+1.84 SC

[ CONTINUE ]
```

---

# 28. Game Over Screen

Use:

```text
ROUND OVER

SCORE
1,842

KILLS
37

ACCURACY
71%

MAX COMBO
19

PAYOUT
+0.82 SC

[ PLAY AGAIN ]
```

---

# 29. Light Theme

The existing `ThemeManager` already supports:

```ts
light
```

with:

```text
Sunlit Tropical Arcade
```

Lean into that identity.

Use:

- bright tropical water
- warm sunlight
- colorful fish
- clean arcade HUD
- lighter ambient effects
- energetic arcade music

---

# 30. Dark Theme

The existing dark theme already supports:

```text
Deep-Sea Combat Abyss
```

Lean into:

- deep blue/black water
- bioluminescent fish
- sonar elements
- darker HUD
- stronger contrast
- atmospheric particles
- deeper soundscape

---

# 31. Theme-Specific Soundscapes

The theme system already has:

```ts
soundscapeStyle:
  'sunlit_arcade'
  | 'deepsea_sonar'
```

Actually use those values consistently.

### Light

```text
Sunlit Arcade
- bright percussion
- tropical ambience
- lighter synths
- energetic loops
```

### Dark

```text
Deep-Sea Sonar
- sonar pings
- low drones
- sub bass
- underwater ambience
- darker synth textures
```

---

# 32. Audio State Machine

Existing `AudioManager` already has:

```text
MENU
GAMEPLAY
BOSS
VICTORY
DEFEAT
MUTED
```

Keep this architecture.

Improve transitions:

```text
MENU → GAMEPLAY
GAMEPLAY → BOSS
BOSS → VICTORY
BOSS → DEFEAT
VICTORY → GAMEPLAY
DEFEAT → GAMEPLAY
```

Use crossfade timing.

---

# 33. Audio Diagnostics

Add development-only logging:

```text
AUDIO
state: GAMEPLAY
theme: dark
music: gameplay_dark
volume: 0.72
muted: false
```

This will make background-music bugs much easier to diagnose.

---

# 34. Visibility / Mobile Lifecycle

Ensure:

```text
TAB HIDDEN
    ↓
STOP / PAUSE AUDIO

TAB VISIBLE
    ↓
RESTORE CURRENT AUDIO STATE
```

Also handle:

- mobile backgrounding
- screen lock
- browser tab switching
- autoplay restrictions

---

# 35. Pause / Resume

Use the existing events:

```text
GAME_PAUSE
GAME_RESUME
```

Pause:

- gameplay
- animations where appropriate
- timers
- music
- boss timers

Resume everything cleanly.

---

# 36. Central Gameplay Tuning

Create one authoritative configuration:

```ts
GAMEPLAY_TUNING
```

Suggested values:

```ts
fireRate
projectileSpeed
fishSpeed
spawnRate
comboWindow
critChance

turretCooldown
turretDuration
turretMultiplier

bossMinKills
bossMaxKills
bossDuration
bossEnrageThreshold

screenShake
hitStop
```

Do not scatter tuning constants across components.

---

# 37. Monte Carlo Payout Validation

Preserve the existing requirement:

> Run 100,000 kills across every hit ratio from 33% through 100%.

For each hit ratio:

```text
33%
34%
35%
...
99%
100%
```

Run:

```text
100,000 kills
```

Collect:

```text
kills
hits
misses
wager
gross payout
RTP
variance
turret contribution
boss contribution
bonus contribution
```

Example:

```text
Hit Ratio: 72%

Kills:          100,000
Hits:            72,000
Misses:          28,000

Total Wager:     $XX.XX
Gross Payout:    $XX.XX

RTP:             89.94%
```

---

# 38. Production RTP Target

Use the Monte Carlo results to choose the production configuration targeting approximately:

```text
90% RTP
```

The production payout configuration must be based on the simulation.

Do not allow the UI to independently calculate payout values.

The server/payout engine remains authoritative.

---

# 39. Economy Separation

Maintain a strict separation:

```text
GAMEPLAY
   ↓
combat events
   ↓
payout engine
   ↓
authoritative payout
```

UI should only display the result.

Never:

```text
UI → calculate payout
```

---

# 40. Telemetry

Add internal development telemetry.

Track:

```text
round duration
kills
shots
hits
misses
hit percentage
critical hits
max combo
turret triggers
turret uptime
boss encounters
boss defeats
boss escapes
RTP
```

This gives real data for tuning instead of guessing.

---

# 41. Developer Diagnostics

Add a development-only diagnostics overlay.

Example:

```text
FPS        60
FISH       24
PROJECTILES 7

HIT RATE   71.4%
COMBO      12
TURRET     ACTIVE
BOSS       PHASE 2

AUDIO      GAMEPLAY
THEME      DARK
```

Disable it in production.

---

# 42. Event Architecture

The existing `GameEventBus` already has the necessary events.

Continue using:

```text
GAME_START
GAME_PAUSE
GAME_RESUME

FISH_HIT
FISH_KILLED
CRITICAL_HIT

COMBO_UPDATE
COMBO_BREAK

TURRET_TRIGGER
TURRET_UPDATE
TURRET_EXPIRE

BOSS_TRIGGER
BOSS_WARNING
BOSS_INTRO
BOSS_START
BOSS_STATE
BOSS_HIT
BOSS_DEFEATED
BOSS_ESCAPED

ROUND_END
PAYOUT

THEME_CHANGED
SCREEN_SHAKE
```

Do not introduce a second event architecture.

---

# 43. Animation System

Animations should have consistent timing.

Suggested timing:

```text
micro feedback:   80–150ms
HUD transition:  150–250ms
major banner:    250–500ms
boss intro:      750–1500ms
```

Avoid everything animating at once.

---

# 44. Responsive Layout

The game must remain readable on mobile.

Priority:

```text
gameplay
↓
boss/target information
↓
fire control
↓
bet
↓
secondary information
```

Never allow decorative UI to cover targets.

---

# 45. Accessibility

Support:

- keyboard controls
- visible focus
- reduced motion
- readable contrast
- non-color-only status indicators
- clear muted state
- readable mobile text

Respect:

```css
prefers-reduced-motion
```

---

# 46. Performance

Avoid:

- unnecessary DOM creation
- per-frame DOM updates
- excessive filters
- huge shadow stacks
- unnecessary particle systems
- audio object recreation

Prefer:

- reusable DOM nodes
- Pixi rendering for game objects
- CSS transforms
- pooled effects
- cached audio resources

---

# 47. Testing

Required automated coverage:

## Boss

```text
boss trigger
boss intro
boss start
boss state
boss phase
boss defeat
boss escape
boss cleanup
```

## Turret

```text
trigger
active duration
cooldown
retrigger prevention
expiration
```

## Audio

```text
gameplay music
boss music
victory
defeat
mute
unmute
visibility changes
theme changes
```

## Theme

```text
light
dark
persistence
THEME_CHANGED
audio theme propagation
```

## Economy

```text
payout authority
RTP
Monte Carlo
bonus separation
```

---

# 48. Git Commit Strategy

Keep implementation in focused commits.

```text
ui: establish arcade visual system

ui: rebuild combat HUD

game: make boss encounters reliable

game: tune turret multiplier

audio: improve game-state music transitions

ui: separate light and dark themes

ui: add arcade combat feedback

economy: validate 90 percent RTP

test: add gameplay regression coverage
```

Avoid one enormous commit containing every subsystem.

---

# 49. Implementation Order

## Phase 1 — Foundation

- typography
- colors
- borders
- panel system
- buttons
- shared HUD variables

## Phase 2 — Combat HUD

- player bar
- boss bar
- combo
- turret
- crosshair
- damage numbers
- kill feed
- round banners

## Phase 3 — Boss

- deterministic trigger
- intro
- state machine
- phases
- danger states
- trailing HP
- result presentation

## Phase 4 — Turret

- READY
- ACTIVE
- COOLDOWN
- tuning
- retrigger protection

## Phase 5 — Audio

- crossfade
- theme-specific tracks
- boss transitions
- visibility handling
- diagnostics

## Phase 6 — Themes

- light polish
- dark polish
- fish palettes
- particles
- HUD
- soundscape

## Phase 7 — Combat Feel

- hit stop
- screen shake
- announcer
- damage numbers
- critical effects

## Phase 8 — Economy

- Monte Carlo
- 33–100% hit ratios
- 100,000 kills per ratio
- 90% RTP configuration

## Phase 9 — QA

```bash
npm run lint
npm test -- --run
```

Then manually verify:

- start
- gameplay
- combo
- turret
- boss
- boss defeat
- boss escape
- theme switching
- music
- pause/resume
- mobile layout
- payout

---

# 50. Definition of Done

Fish Frenzy is ready for the next stage when:

- [ ] UI no longer feels like a generic casino/mobile game
- [ ] HUD reads like an arcade fighting game
- [ ] player combat information is immediately readable
- [ ] boss mode reliably triggers
- [ ] boss mode is impossible to miss visually
- [ ] boss phases materially change gameplay
- [ ] boss HP has real trailing damage animation
- [ ] boss danger states work
- [ ] turret is less frequent
- [ ] turret duration is properly tuned
- [ ] turret has READY/ACTIVE/COOLDOWN states
- [ ] combo feedback feels rewarding
- [ ] damage numbers work
- [ ] critical hits feel powerful
- [ ] crosshair communicates combat state
- [ ] round banners work
- [ ] light and dark themes feel genuinely different
- [ ] light and dark soundscapes are distinct
- [ ] background music transitions reliably
- [ ] mobile background/foreground audio works
- [ ] modals share one visual system
- [ ] start screen feels arcade-grade
- [ ] payout remains server-authoritative
- [ ] Monte Carlo runs 100,000 kills at every 33–100% hit ratio
- [ ] production configuration targets ~90% RTP
- [ ] diagnostics exist for development
- [ ] regression tests cover boss/turret/audio/economy
- [ ] lint passes
- [ ] tests pass

---

# Priority

The highest-value changes are:

1. **Make Boss Mode reliable**
2. **Fix/tune turret frequency and duration**
3. **Rebuild the combat HUD around Street Fighter-style health bars**
4. **Add real combat feedback**
5. **Fix music state transitions**
6. **Make light/dark presentation genuinely distinct**
7. **Run the Monte Carlo payout validation**
8. **Finish responsive/mobile polish**
9. **Add regression coverage**

The existing codebase is already structurally positioned for this. The correct strategy is to **upgrade the systems that already exist instead of replacing them.**