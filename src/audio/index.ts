/**
 * Audio module exports.
 *
 * Usage:
 *   import { AudioManager, SFX_IDS } from '@/audio';
 *
 *   const audio = AudioManager.getInstance();
 *   await audio.init();
 *   audio.play(SFX_IDS.MENU_SELECT);
 */

export { AudioManager, SFX_IDS, MUSIC_IDS } from './AudioManager';
export type { SoundId, SfxId, MusicId, AudioSettings } from './AudioManager';
export { SOUND_REGISTRY, getSoundPath, getSoundCategory, isSfx, isMusic } from './constants';
export {
  DEFAULT_AUDIO_SETTINGS,
  VOLUME_STEPS,
  AUDIO_CONSTRAINTS,
  AUDIO_SETTINGS_KEY,
  MAX_CONCURRENT_SFX,
} from './types';
export type {
  AudioCategory,
  AudioContextState,
  PlayOptions,
  LoadedSound,
  ActiveSound,
} from './types';
