/**
 * Audio system type definitions.
 *
 * Based on /docs/AUDIO.md specification.
 */

/**
 * Audio settings stored in LocalStorage.
 * Separate from game saves - persists across all save slots.
 */
export interface AudioSettings {
  /** Master volume (0-100) */
  masterVolume: number;
  /** SFX volume (0-100) */
  sfxVolume: number;
  /** Music volume (0-100) */
  musicVolume: number;
  /** Global mute state */
  muted: boolean;
}

/**
 * Default audio settings per AUDIO.md specification.
 */
export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  masterVolume: 80,
  sfxVolume: 100,
  musicVolume: 50,
  muted: false,
};

/**
 * Volume steps for discrete controls (DOS-era style).
 * AUDIO.md specifies: 0, 25, 50, 75, 100
 */
export const VOLUME_STEPS = [0, 25, 50, 75, 100] as const;

/**
 * Audio category for volume mixing.
 */
export type AudioCategory = 'sfx' | 'music' | 'ambience';

/**
 * State of the audio context.
 * Note: 'interrupted' is a Safari-specific state.
 */
export type AudioContextState = 'suspended' | 'running' | 'closed' | 'interrupted';

/**
 * Audio playback options.
 */
export interface PlayOptions {
  /** Volume override (0-1, relative to category volume) */
  volume?: number;
  /** Loop the sound */
  loop?: boolean;
  /** Callback when playback ends (not called if looping) */
  onEnd?: () => void;
}

/**
 * Loaded audio buffer with metadata.
 */
export interface LoadedSound {
  /** Decoded audio buffer */
  buffer: AudioBuffer;
  /** Audio category for volume mixing */
  category: AudioCategory;
  /** Original file path */
  path: string;
}

/**
 * Active sound instance for tracking and stopping.
 */
export interface ActiveSound {
  /** Unique instance ID */
  id: string;
  /** Sound ID from constants */
  soundId: string;
  /** Audio source node */
  source: AudioBufferSourceNode;
  /** Gain node for volume control */
  gainNode: GainNode;
  /** Whether this sound is looping */
  loop: boolean;
  /** Start timestamp */
  startedAt: number;
}

/**
 * LocalStorage key for audio settings.
 */
export const AUDIO_SETTINGS_KEY = 'audio_settings';

/**
 * Maximum concurrent SFX per AUDIO.md specification.
 */
export const MAX_CONCURRENT_SFX = 4;

/**
 * Performance constraints from AUDIO.md.
 */
export const AUDIO_CONSTRAINTS = {
  /** Maximum concurrent SFX sounds */
  maxConcurrentSfx: 4,
  /** Maximum music tracks loaded at once */
  maxMusicTracks: 1,
  /** Total audio memory budget in bytes (~10MB) */
  memoryBudget: 10 * 1024 * 1024,
  /** Maximum SFX latency in milliseconds */
  maxLatencyMs: 50,
} as const;
