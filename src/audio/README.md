# Audio System

This module provides the audio infrastructure for the gamebook web application.

## Quick Start

```typescript
import { AudioManager, SFX_IDS } from './audio';

// Initialize once at app startup
const audio = AudioManager.getInstance();
await audio.init();

// Play sounds
audio.play(SFX_IDS.MENU_SELECT);
audio.play(SFX_IDS.PAGE_TURN);
```

## Features

- **Browser autoplay policy compliance**: Queues sounds until user interaction
- **Volume controls**: Master, SFX, and Music with LocalStorage persistence
- **Mute toggle**: Global mute with visual indicator support
- **Dev mode**: Programmatic tone generation when audio files are missing
- **Graceful degradation**: Game remains playable if audio fails
- **Concurrent SFX limit**: Max 4 simultaneous SFX (oldest evicted)

## API Reference

### AudioManager

Singleton class - get instance with `AudioManager.getInstance()`.

#### Initialization

```typescript
const audio = AudioManager.getInstance();
await audio.init();
```

#### Playing Sounds

```typescript
// Play SFX
audio.play(SFX_IDS.MENU_SELECT);

// Play with options
audio.play(SFX_IDS.ITEM_PICKUP, {
  volume: 0.5,      // 0-1 relative volume
  loop: false,      // Loop the sound
  onEnd: () => {},  // Callback when done
});

// Play music (auto-stops previous track)
audio.play(MUSIC_IDS.EXPLORATION, { loop: true });
```

#### Stopping Sounds

```typescript
// Stop specific sound (using returned instance ID)
const id = audio.play(SFX_IDS.MENU_SELECT);
audio.stop(id);

// Stop all sounds
audio.stopAll();

// Stop only SFX (keep music)
audio.stopAllSfx();

// Stop music
audio.stopMusic();
```

#### Volume Controls

```typescript
// Set volumes (0-100)
audio.setMasterVolume(80);
audio.setSfxVolume(100);
audio.setMusicVolume(50);

// Toggle mute
const isMuted = audio.toggleMute();

// Set mute explicitly
audio.setMuted(true);

// Get current settings
const settings = audio.getSettings();
// { masterVolume: 80, sfxVolume: 100, musicVolume: 50, muted: false }
```

#### State Checks

```typescript
// Check if ready to play
if (audio.isReady()) { ... }

// Check if user has interacted (audio unlocked)
if (audio.hasUserInteracted()) { ... }

// Check if in dev mode (using generated tones)
if (audio.isDevMode()) { ... }
```

#### Preloading

```typescript
// Preload specific sounds for instant playback
await audio.preload(SFX_IDS.MENU_SELECT);

// Preload multiple
await audio.preloadAll([
  SFX_IDS.MENU_SELECT,
  SFX_IDS.MENU_MOVE,
  SFX_IDS.PAGE_TURN,
]);
```

## Sound IDs

### SFX (Sound Effects)

| ID | Trigger |
|----|---------|
| `SFX_IDS.MENU_MOVE` | Menu navigation |
| `SFX_IDS.MENU_SELECT` | Confirm selection |
| `SFX_IDS.MENU_BACK` | Cancel/back |
| `SFX_IDS.MENU_ERROR` | Invalid action |
| `SFX_IDS.CHOICE_HOVER` | Choice highlight |
| `SFX_IDS.CHOICE_SELECT` | Story choice confirmed |
| `SFX_IDS.PAGE_TURN` | Scene transition |
| `SFX_IDS.INVENTORY_OPEN` | Open inventory |
| `SFX_IDS.INVENTORY_CLOSE` | Close inventory |
| `SFX_IDS.ITEM_PICKUP` | Item acquired |
| `SFX_IDS.ITEM_USE` | Item used |
| `SFX_IDS.SAVE` | Game saved |
| `SFX_IDS.LOAD` | Game loaded |
| `SFX_IDS.STAT_UP` | Stat increase |
| `SFX_IDS.STAT_DOWN` | Stat decrease |
| `SFX_IDS.GAME_OVER` | Death/failure |
| `SFX_IDS.VICTORY` | Victory ending |

### Music

| ID | Usage |
|----|-------|
| `MUSIC_IDS.TITLE` | Title screen |
| `MUSIC_IDS.EXPLORATION` | General gameplay |
| `MUSIC_IDS.TENSION` | Dangerous situations |
| `MUSIC_IDS.VICTORY` | Victory ending |
| `MUSIC_IDS.DEFEAT` | Defeat ending |

## Integration with UI Components

```typescript
// Example: Button component with audio feedback
class MenuButton {
  private audio = AudioManager.getInstance();

  onFocus() {
    this.audio.play(SFX_IDS.MENU_MOVE);
  }

  onClick() {
    this.audio.play(SFX_IDS.MENU_SELECT);
    // ... handle click
  }
}

// Example: Scene transition
function transitionToScene(nodeId: string) {
  const audio = AudioManager.getInstance();
  audio.play(SFX_IDS.PAGE_TURN);
  // ... load and display scene
}
```

## Volume Settings UI

```typescript
// Example: Volume slider in Options screen
function renderVolumeSlider(type: 'master' | 'sfx' | 'music') {
  const audio = AudioManager.getInstance();
  const settings = audio.getSettings();

  // Discrete steps per AUDIO.md: 0, 25, 50, 75, 100
  const steps = [0, 25, 50, 75, 100];
  const currentValue = settings[`${type}Volume`];

  // Render ASCII volume bar: [████████░░]
  const filled = Math.round(currentValue / 10);
  const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);

  return `[${bar}] ${currentValue}%`;
}

function handleVolumeChange(type: 'master' | 'sfx' | 'music', delta: number) {
  const audio = AudioManager.getInstance();
  const settings = audio.getSettings();
  const current = settings[`${type}Volume`];

  // Step in increments of 25
  const newValue = Math.max(0, Math.min(100, current + delta * 25));

  switch (type) {
    case 'master': audio.setMasterVolume(newValue); break;
    case 'sfx': audio.setSfxVolume(newValue); break;
    case 'music': audio.setMusicVolume(newValue); break;
  }
}
```

## Dev Mode

When audio files are not present (common during early development), the AudioManager automatically switches to dev mode, which generates simple tones instead of playing audio files.

```typescript
// Force enable dev mode
audio.enableDevMode();

// Disable dev mode (will try to load files)
audio.disableDevMode();

// Check if in dev mode
if (audio.isDevMode()) {
  console.log('Using generated tones');
}
```

Dev mode tones use different frequencies to distinguish sound types:
- Menu sounds: 440Hz (A4)
- Confirm/select: 880Hz (A5)
- Cancel/back: 330Hz (E4)
- Error: 220Hz (A3)

## Browser Autoplay Policy

Modern browsers block audio until user interaction. The AudioManager handles this automatically:

1. Sounds are queued if played before user interaction
2. On first click/keypress/touch, the audio context resumes
3. Queued sounds are played automatically

To show "Click to enable audio" prompt:

```typescript
if (!audio.hasUserInteracted()) {
  showAudioPrompt();
}
```

## File Structure

```
src/audio/
├── index.ts          # Module exports
├── AudioManager.ts   # Main singleton class
├── constants.ts      # Sound IDs and registry
├── types.ts          # TypeScript interfaces
└── README.md         # This file
```

## Audio Assets

Audio files should be placed in:

```
src/assets/audio/
├── sfx/              # Sound effects (.ogg)
├── music/            # Background music (.ogg)
└── ambience/         # Ambient loops (.ogg)
```

See `/docs/AUDIO.md` for full asset specifications and naming conventions.

---

*Module owned by Agent E (Production Toolsmith)*
