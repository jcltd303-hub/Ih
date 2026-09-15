# Fish Frenzy — Comprehensive Upgrade Plan

## Goal

Transform Fish Frenzy from a cheesy/mobile-casino presentation into a polished arcade combat game inspired by classic fighting-game HUDs such as Street Fighter II.

Core principle:

> The game should feel like an arcade fishing/combat game that happens to have wagering mechanics underneath it — not a casino interface with fish graphics.

---

## 1. Visual Design Language

Replace the current toy/casino aesthetic with:

- Arcade combat HUD
- Dark, high-contrast panels
- Sharp 2–4px corners
- Heavy condensed/italic display typography
- Thin technical borders
- Limited accent colors
- Restrained gradients
- Minimal glow
- Strong visual hierarchy
- Functional game-state indicators
- Dramatic animation only when something important happens

Avoid:

- Rainbow neon everywhere
- Giant glowing buttons
- Excessive rounded cards
- Casino-style promotional UI
- Constant bouncing
- Excessive emoji
- Giant "WIN BIG" style messaging

Visual vocabulary:

FIGHT
ROUND
BOSS
HEALTH
COMBO
MULTIPLIER
KO
VICTORY
DEFEAT

---

# 2. Main HUD

Replace the generic top navigation with an arcade combat HUD.

## Top-left

PLAYER

- Player name/avatar
- Balance
- Current bet

## Top-center

FISH FRENZY

- Round
- Stage/table
- Current game state

## Top-right

OPPONENT / BOSS

- Boss name
- Boss health
- Boss multiplier

The playfield remains visually dominant.

HUD must not obscure:

- Fish
- Projectiles
- Boss
- Important gameplay effects

---

# 3. Street Fighter-Style Health Bars

Create large combat-style health bars.

Requirements:

- Thick horizontal bar
- White/metallic outline
- Dark depleted region
- Segmented health
- Smooth damage interpolation
- Brief damage flash
- Recent-damage trailing region
- Boss bar substantially larger

Example:

PLAYER                         BOSS
██████████████████             ██████████████████

Boss presentation:

+------------------------------------------+
|              BOSS — NAME                 |
|██████████████████████████████████████████|
+------------------------------------------+

Health changes should be visually satisfying without dominating every hit.

---

# 4. Boss Mode

Current problem:

Boss mode can fail to trigger or display.

Implement an explicit state machine:

NORMAL
  ↓
BOSS_TRIGGER
  ↓
WARNING
  ↓
BOSS_INTRO
  ↓
BOSS_ACTIVE
  ↓
BOSS_DEFEATED
  ↓
REWARD
  ↓
NORMAL

## Boss trigger

Boss triggering must be deterministic enough that the player cannot go indefinitely without seeing one.

Use:

- Minimum kills before eligibility
- Configurable probability
- Cooldown after boss
- Maximum kill interval
- Developer/test trigger
- State logging

Example configuration:

BOSS_MIN_KILLS = 25
BOSS_MAX_KILLS = 60
BOSS_CHANCE = 0.08

The maximum interval is an important safety net.

## Boss entrance

Sequence:

1. Subtle screen darkening
2. Normal HUD dims
3. BOSS WARNING appears
4. Boss enters
5. Boss health bar animates in
6. Boss music starts
7. Boss multiplier appears
8. Combat resumes

Boss state must be visible from both gameplay state and HUD state.

---

# 5. Turret Multiplier

Current problem:

Turret multiplier is too frequent and lasts too long.

Separate:

- Trigger frequency
- Multiplier duration
- Multiplier magnitude

Example:

TURRET_MULTIPLIER = {
  minKillsBetweenTriggers: 12,
  baseChance: 0.04,
  durationMs: 3500,
  maxDurationMs: 5000,
  multiplier: 2
}

Implement:

bonus
  ↓
cooldown
  ↓
normal gameplay
  ↓
eligible
  ↓
bonus

Prevent:

bonus → bonus → bonus → bonus

## Multiplier HUD

Use a combat status display:

+----------------+
| TURRET     x2  |
| ███████░░░░░   |
+----------------+

Include a draining duration bar.

When it expires:

x2 → x1

Avoid giant BONUS banners.

---

# 6. Combo System

Add readable combat rhythm.

Example:

COMBO
07

with a timer:

████████░░

Combo breaks after a configurable inactivity period.

Combo feedback should be:

- Fast
- Readable
- Satisfying
- Non-intrusive

---

# 7. Hit Feedback

Normal hit:

- Small impact
- Short sound
- Small number pop

Critical:

CRITICAL
x2

Boss hit:

- Larger impact
- Boss health damage
- Brief hit flash
- Stronger sound
- Optional small screen shake

Avoid making every fish kill a giant explosion.

---

# 8. Background Music

Current problem:

Background music does not reliably behave across game states.

Create an audio state machine:

AudioManager
  ├── MENU
  ├── GAMEPLAY
  ├── BOSS
  ├── VICTORY
  ├── DEFEAT
  └── MUTED

## Gameplay

Loop continuously.

## Boss

Crossfade:

GAME MUSIC
    ↓
fade down
    ↓
BOSS MUSIC

## Boss defeat

Boss music ends and victory layer plays.

## Return

Crossfade back into gameplay.

## Browser/mobile behavior

Handle:

- First user interaction
- AudioContext resume
- Muting
- Visibility changes
- Background tab
- Foreground resume
- iOS/Android autoplay restrictions

Add persistent:

- Master volume
- Music volume
- SFX volume
- Mute

---

# 9. Separate Light and Dark Themes

Do not simply invert colors.

Each theme should have independent art direction.

## Light Theme

Sunlit tropical arcade:

- Bright water
- Warm environment
- Clear dark HUD
- Bright fish palette
- Crisp outlines
- Daytime ambience

## Dark Theme

Deep-sea combat arcade:

- Deep navy/black water
- Bioluminescence
- Strong shadows
- Electric highlights
- Darker fish silhouettes
- Sonar/deep-water ambience
- Strong boss contrast

Centralize theme configuration.

GameTheme should own:

- Colors
- Background
- Particles
- Fish palette
- UI accents
- Music
- Soundscape

Avoid scattering theme logic throughout UIManager.

---

# 10. Start Screen

Replace the current casino-style opening.

Target:

FISH
FRENZY

ARCADE COMBAT

----------------

PLAY

HOW TO PLAY
OPTIONS
LEADERBOARD

The title should feel like an arcade cabinet attract screen.

Primary PLAY/START control should be dominant but restrained.

Remove/rework:

- SWEEPSTAKES CASINO
- WIN BIG
- Excessive glowing frames
- Multiple competing neon colors

---

# 11. Modal System

Create one shared arcade modal system.

Structure:

+--------------------------------+
| TITLE                      X   |
+--------------------------------+
|                                |
| CONTENT                        |
|                                |
+--------------------------------+
|       CANCEL      CONFIRM      |
+--------------------------------+

Characteristics:

- Dark/metal surface
- Sharp corners
- Thin borders
- Strong title typography
- Consistent button hierarchy
- Short transitions

No giant rounded toy cards.

---

# 12. Result Screens

## Victory

KO!

BOSS DEFEATED

REWARD
+$12.40

DAMAGE
184

MULTIPLIER
x2.4

CONTINUE

## Defeat

KO

ROUND OVER

RETRY
RETURN TO GAME

Result screens should feel like arcade results rather than casino advertisements.

---

# 13. Bet Selector

Make betting controls part of the HUD.

BET

-   $0.25   +

$0.05
$0.10
$0.25
$0.50
$1.00
$2.50
$5.00
$10.00

Selected value gets a strong arcade highlight.

Avoid oversized casino chips.

---

# 14. Fire Control

Fire control should feel physical.

Desktop:

- Mouse/touch targeting
- Hold-to-fire
- Release behavior

Mobile:

- Large touch target
- Clear pressed state
- Clear release state
- Cooldown indication

The fire button should be the primary gameplay interaction without taking over the screen.

---

# 15. Kill Feed

Add a subtle arcade feed:

+ $0.12  SARDINE
+ $0.30  PUFFER
+ $1.25  SHARK

Animate briefly and remove.

Keep it away from the center of gameplay.

---

# 16. Payout Visualization

PayoutEngine remains authoritative.

Architecture:

PayoutEngine
    ↓
Game Event
    ↓
UI Animation

Never allow UI to calculate payouts.

UI only displays authoritative results.

---

# 17. Monte Carlo RTP

Maintain the required payout validation:

100,000 kills at every hit ratio from 33% through 100%.

Generate:

Hit %
33
34
35
...
100

Record:

- Kills
- Hits
- Misses
- Total wager
- Gross payout
- RTP
- Variance
- Turret contribution
- Boss contribution
- Bonus contribution

Use the results to select production parameters targeting approximately 90% RTP.

Do not hand-tune payout constants independently of the simulation.

---

# 18. Developer Diagnostics

Create a developer-only diagnostics panel.

Example:

FISH FRENZY DEBUG

Kills:          182
Hit rate:       67.4%
RTP:            89.8%

BOSS
Eligible:       YES
Last boss:      31 kills ago
Next guarantee: 29 kills

TURRET
Eligible:       NO
Cooldown:       7.2s

AUDIO
Context:        RUNNING
Music:          GAMEPLAY
SFX:            ON

This should make bugs such as "boss never happens" immediately visible.

---

# 19. Standard Event Architecture

Standardize gameplay events:

GAME_START
FISH_SPAWN
FISH_HIT
FISH_KILLED
CRITICAL_HIT
COMBO_START
COMBO_BREAK
TURRET_TRIGGER
TURRET_EXPIRE
BOSS_TRIGGER
BOSS_START
BOSS_HIT
BOSS_DEFEATED
ROUND_END
PAYOUT

UI, audio and effects should subscribe to events instead of tightly coupling systems together.

---

# 20. Animation System

Use three animation classes.

## Micro

50–150ms

- Buttons
- Counters
- Hit flashes

## Combat

150–400ms

- Damage
- Combo
- Multiplier
- HUD transitions

## Dramatic

500–1200ms

- Boss intro
- Victory
- Defeat

Do not continuously animate everything.

Animation should communicate game state.

---

# 21. Screen Effects

NORMAL
- Minimal

CRITICAL HIT
- Small flash

BOSS INTRO
- Vignette
- Short shake
- Dramatic transition

BOSS DEFEAT
- Large but short impact

BIG PAYOUT
- Brief celebration

Rarity creates impact.

---

# 22. Responsive Layout

Design for phones first.

Priority:

1. Gameplay
2. Fire/aim
3. Health/boss
4. Balance/bet
5. Multiplier/combo
6. Secondary controls

Use safe-area handling for:

- iPhone notch
- Android navigation
- Portrait
- Landscape

Do not fill the playfield with widgets.

---

# 23. Accessibility

Support:

- Reduced motion
- High contrast
- Minimum readable font sizes
- Keyboard focus
- Touch states
- Color-independent status indicators
- Mute
- Persistent audio settings

Boss state must never depend solely on color.

Use:

BOSS text
+
health bar
+
animation
+
audio

---

# 24. Performance

Canvas/game rendering should remain separate from DOM HUD.

DOM:

- HUD
- Menus
- Modals
- Status indicators

Canvas:

- Fish
- Projectiles
- Particles
- Environmental effects

Avoid updating the entire HUD every animation frame.

Use event-driven DOM updates.

---

# 25. Code Architecture

Target:

src/
  game/
    GameEngine
    GameState
    BossSystem
    ComboSystem
    TurretSystem
    SpawnSystem

  audio/
    AudioManager
    MusicController
    SoundManager

  ui/
    UIManager
    HUD
    BossHUD
    ModalManager
    ThemeManager
    StartScreen
    ResultScreen

  economy/
    PayoutEngine
    BetManager
    RTPConfig

  effects/
    ScreenShake
    HitEffects
    CombatFX

Gradually reduce UIManager responsibilities.

---

# 26. Testing

## Unit tests

Cover:

- Boss trigger
- Boss cooldown
- Boss maximum interval
- Turret frequency
- Turret cooldown
- Turret duration
- Combo
- Payout
- RTP
- Theme switching
- Audio state transitions

## Integration test

Verify:

start
→ gameplay
→ boss
→ boss defeat
→ payout
→ next round

## Regression tests

Explicitly verify:

- Boss eventually appears
- Boss HUD appears
- Boss can be defeated
- Turret does not chain excessively
- Turret expires
- Music starts after interaction
- Boss music activates
- Music returns after boss
- Light theme changes correctly
- Dark theme changes correctly
- Payout remains authoritative

---

# 27. Implementation Order

## Phase 1 — Design Foundation

- CSS variables
- Typography
- Color system
- Buttons
- Panels
- Modal system
- Light/dark foundation

## Phase 2 — Arcade HUD

- Top HUD
- Player status
- Boss status
- Health bars
- Bet selector
- Multiplier
- Combo
- Kill feed

## Phase 3 — Boss System

- Explicit state machine
- Trigger guarantee
- Boss intro
- Boss HUD
- Boss defeat
- Reward state

## Phase 4 — Turret

- Frequency tuning
- Cooldown
- Duration
- Multiplier HUD
- Expiration feedback

## Phase 5 — Audio

- Audio state machine
- Gameplay music
- Boss music
- Victory/defeat
- Theme soundscapes
- Mobile/browser resume

## Phase 6 — Visual Combat Polish

- Hit effects
- Critical hits
- Combo effects
- Boss effects
- Screen shake
- KO animations

## Phase 7 — Economy

- Monte Carlo simulation
- 33–100% hit-rate sweep
- 100,000 kills per ratio
- 90% RTP selection
- Production configuration
- Regression tests

## Phase 8 — QA

Run:

npm run lint
npm test -- --run

Then manually verify:

- Start
- Gameplay
- Boss
- Turret
- Combo
- Audio
- Themes
- Mobile
- Payout
- Result screens

---

# 28. Git Strategy

Implement in focused commits.

Recommended sequence:

1. `ui: establish arcade visual system`
2. `ui: rebuild combat HUD`
3. `game: make boss encounters reliable`
4. `game: tune turret multiplier`
5. `audio: add game-state music controller`
6. `ui: separate light and dark themes`
7. `ui: add arcade combat feedback`
8. `economy: validate 90 percent RTP`
9. `test: add gameplay regression coverage`

Run lint/tests after every major phase.

Never bundle unrelated fixes into one massive commit.

---

# 29. Definition of Done

Fish Frenzy is ready for the next stage when:

- The HUD looks like an arcade fighting-game interface.
- Health bars are immediately understandable.
- Boss mode reliably triggers and is impossible to miss.
- Boss mode has distinct audio, visuals and HUD.
- Turret bonuses are substantially less frequent.
- Turret bonuses have controlled duration.
- Light and dark themes have genuinely different environments.
- Music reliably starts, stops and transitions.
- Boss music crossfades correctly.
- Modals no longer look like generic mobile-casino cards.
- Start/result screens share the arcade visual language.
- Combo and hit feedback make combat feel responsive.
- Payout calculations remain authoritative and deterministic.
- Monte Carlo results support the 90% RTP configuration.
- Lint passes.
- Tests pass.
- Mobile layout remains playable.
- Reduced-motion mode works.
- No critical gameplay state exists only in the UI.

---

# Priority

Immediate priorities:

1. Arcade visual foundation
2. Street Fighter-style HUD/health bars
3. Reliable Boss Mode
4. Turret frequency/duration fix
5. Audio state machine
6. True light/dark theme separation
7. Modal/start/result redesign
8. Combat feedback
9. Monte Carlo/RTP validation
10. Regression/QA

Final product target:

FISH FRENZY should feel like a **purpose-built arcade combat game**, with the economy operating invisibly and reliably underneath the gameplay rather than defining the visual experience.
