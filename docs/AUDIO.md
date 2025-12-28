# Audio Specification

This document defines the audio plan for the gamebook web application, including UI sound effects, background music guidelines, asset pipeline conventions, and volume control specifications.

## Overview

Audio follows the DOS-era aesthetic established in GANG.md: short, punchy SFX for UI actions, optional background music that doesn't obstruct readability, and all assets properly licensed and credited.

### Design Principles

1. **Retro Authenticity** - Sounds should evoke DOS/early PC game era (8-bit to early 16-bit style)
2. **Non-Intrusive** - Audio enhances but never interferes with reading or gameplay
3. **Responsive Feedback** - Every meaningful interaction has audio confirmation
4. **Accessible** - Full mute and volume controls; game is fully playable without sound

## UI Sound Effects

### Required SFX List

| ID | Trigger | Description | Duration | Notes |
|----|---------|-------------|----------|-------|
| `sfx_menu_move` | Menu navigation (arrow keys) | Short blip/tick | <100ms | Subtle, not fatiguing |
| `sfx_menu_select` | Confirm selection (Enter) | Positive confirmation tone | 100-200ms | Satisfying "click" |
| `sfx_menu_back` | Cancel/back (Esc) | Soft descending tone | 100-150ms | Non-jarring |
| `sfx_menu_error` | Invalid action attempted | Low buzz/denial sound | 150-200ms | Clear but not alarming |
| `sfx_choice_hover` | Choice option highlight | Very subtle tick | <50ms | Optional, can be same as menu_move |
| `sfx_choice_select` | Story choice confirmed | Distinct from menu select | 150-250ms | Marks narrative progression |
| `sfx_page_turn` | Scene/node transition | Paper rustle or page flip | 200-400ms | Reinforces "book" metaphor |
| `sfx_inventory_open` | Open inventory screen | Bag/pouch opening | 150-250ms | |
| `sfx_inventory_close` | Close inventory screen | Inverse of open | 150-250ms | |
| `sfx_item_pickup` | Item added to inventory | Positive collection sound | 200-300ms | |
| `sfx_item_use` | Item used/consumed | Context-appropriate | 200-400ms | May vary by item type |
| `sfx_save` | Game saved | Write/confirm tone | 200-300ms | Reassuring |
| `sfx_load` | Game loaded | Load/restore tone | 200-300ms | |
| `sfx_stat_up` | Stat increase | Rising tone | 200-300ms | Positive feedback |
| `sfx_stat_down` | Stat decrease | Falling tone | 200-300ms | Warning without alarm |
| `sfx_game_over` | Death/failure ending | Somber tone | 500-1000ms | Not jarring |
| `sfx_victory` | Victory ending | Triumphant fanfare | 1000-2000ms | Celebratory |

### Optional SFX (If Budget Allows)

| ID | Trigger | Description |
|----|---------|-------------|
| `sfx_combat_hit` | Successful attack | Impact sound |
| `sfx_combat_miss` | Missed attack | Whoosh/miss |
| `sfx_combat_block` | Blocked attack | Metallic clang |
| `sfx_skill_check_pass` | Passed skill check | Success chime |
| `sfx_skill_check_fail` | Failed skill check | Failure tone |
| `sfx_ambient_*` | Location-specific ambience | Environmental loops |

## Background Music

### Music Guidelines

- **Format**: Looping tracks, seamless loop points
- **Style**: Chiptune, FM synthesis, or early MIDI-style compositions
- **Mood**: Atmospheric, not distracting from text reading
- **Volume**: Background music defaults to 50% of SFX volume

### Track Categories

| Category | Usage | Loop Length | Notes |
|----------|-------|-------------|-------|
| `music_title` | Title screen | 30-60s | Sets mood, can be more prominent |
| `music_exploration` | General gameplay | 60-120s | Neutral, readable atmosphere |
| `music_tension` | Dangerous situations | 45-90s | Subtle urgency |
| `music_victory` | Ending (success) | 30-60s | Can be non-looping |
| `music_defeat` | Ending (failure) | 30-60s | Can be non-looping |

### Music Implementation Notes

- Music should crossfade between tracks (500ms-1000ms fade)
- Consider no music during dialogue-heavy sections (or very quiet)
- Music state does NOT need to persist in save files (restart track on load is acceptable)

## Asset Pipeline

### Folder Structure

```
/src/assets/audio/
  /sfx/
    menu_move.ogg
    menu_select.ogg
    menu_back.ogg
    menu_error.ogg
    choice_hover.ogg
    choice_select.ogg
    page_turn.ogg
    inventory_open.ogg
    inventory_close.ogg
    item_pickup.ogg
    item_use.ogg
    save.ogg
    load.ogg
    stat_up.ogg
    stat_down.ogg
    game_over.ogg
    victory.ogg
  /music/
    title.ogg
    exploration.ogg
    tension.ogg
    victory.ogg
    defeat.ogg
  /ambience/
    (optional ambient loops)
```

### Naming Conventions

- **Lowercase with underscores**: `menu_select.ogg`, not `MenuSelect.ogg`
- **Descriptive names**: Match the SFX ID without the `sfx_` or `music_` prefix
- **No spaces or special characters**
- **Version suffix if needed**: `menu_select_v2.ogg` during development only

### Supported Formats

| Format | Usage | Notes |
|--------|-------|-------|
| `.ogg` (Vorbis) | Primary format | Best compression/quality for web |
| `.mp3` | Fallback | For Safari compatibility if needed |
| `.wav` | Source only | Not shipped; keep originals for re-encoding |

**Recommendation**: Ship `.ogg` as primary with `.mp3` fallback. Modern browsers handle this well.

### Audio Specifications

| Property | SFX | Music |
|----------|-----|-------|
| Sample Rate | 44.1kHz | 44.1kHz |
| Bit Depth | 16-bit | 16-bit |
| Channels | Mono | Stereo |
| Normalization | -3dB peak | -6dB peak |
| Format | Ogg Vorbis q5 | Ogg Vorbis q6 |

### Build-Time Validation

The build pipeline should validate:

- [ ] All required SFX files exist
- [ ] Files are in correct format (.ogg)
- [ ] File sizes are reasonable (<100KB for SFX, <2MB for music)
- [ ] No clipping detected (peak < 0dB)
- [ ] Loop points defined for music tracks (metadata or separate loop file)

## Volume Controls

### Volume Settings

| Setting | Default | Range | Persistence |
|---------|---------|-------|-------------|
| Master Volume | 80% | 0-100% | LocalStorage |
| SFX Volume | 100% | 0-100% | LocalStorage |
| Music Volume | 50% | 0-100% | LocalStorage |
| Mute All | false | boolean | LocalStorage |

### UI Implementation

Following DOS-era conventions:

1. **Discrete Steps**: Volume controls use discrete steps (0, 25, 50, 75, 100) rather than continuous sliders
2. **Keyboard Control**: Arrow keys to adjust, Enter to confirm
3. **Visual Feedback**: ASCII-style volume bar: `[████████░░]`
4. **Location**: Audio settings accessible from:
   - Main menu → Options
   - Pause menu → Options
5. **Mute Toggle**: Dedicated key (M) and visual indicator when muted

### Mute Behavior

- Mute toggles all audio immediately
- Visual indicator in corner when muted: `[MUTE]` or speaker icon with X
- Unmute restores previous volume levels
- Mute state persists across sessions

### Persistence

```typescript
interface AudioSettings {
  masterVolume: number;  // 0-100
  sfxVolume: number;     // 0-100
  musicVolume: number;   // 0-100
  muted: boolean;
}
```

Audio settings are stored separately from game saves in LocalStorage under key `audio_settings`. This allows:
- Settings to persist across all save slots
- Settings to be adjusted from title screen before loading a game

## Technical Implementation

### Recommended Audio Library

**Web Audio API** (native) is recommended for:
- Low latency SFX playback
- Volume control with gain nodes
- No external dependencies

For simpler implementation, **Howler.js** is an acceptable alternative with good browser support.

### Performance Constraints

| Constraint | Limit | Rationale |
|------------|-------|-----------|
| Concurrent SFX | 4 max | Prevent audio chaos |
| Music tracks loaded | 1 active | Memory efficiency |
| Total audio memory | <10MB | Mobile-friendly |
| SFX latency | <50ms | Responsive feedback |

### Browser Autoplay Policy

Modern browsers block autoplay. Implementation must:

1. Wait for user interaction before playing any audio
2. Show "Click to enable audio" prompt on title screen if needed
3. Resume AudioContext on first user click
4. Music should start only after user initiates New Game or Load

## Licensing Requirements

All audio assets must be:

- **License-compatible**: CC0, CC-BY, or purchased with appropriate license
- **Credited**: Listed in CREDITS.md with license type
- **Documented**: Source URL and license stored in `/docs/audio-licenses.md`

### Recommended Sources (CC0/Public Domain)

- [OpenGameArt.org](https://opengameart.org) - CC0 game audio
- [Freesound.org](https://freesound.org) - Various licenses, filter for CC0
- [Kenney.nl](https://kenney.nl) - CC0 game assets

### Credit Format

```markdown
## Audio Credits

### Sound Effects
- menu_select.ogg - "UI Click" by Author Name (CC0) - [source URL]

### Music
- exploration.ogg - "Dungeon Theme" by Author Name (CC-BY 4.0) - [source URL]
```

---

*This document is maintained by Agent E (Production Toolsmith). Updates require PR review.*

*Note: Audio engine integration details may be refined once ENGINE.md is finalized by Agent C.*
