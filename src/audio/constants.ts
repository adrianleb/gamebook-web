/**
 * Audio constants - sound IDs and file path mappings.
 *
 * Based on /docs/AUDIO.md specification.
 * Import SoundId type for type-safe audio triggering.
 */

import type { AudioCategory } from './types';

/**
 * SFX sound identifiers matching AUDIO.md required SFX list.
 */
export const SFX_IDS = {
  // Menu navigation
  MENU_MOVE: 'sfx_menu_move',
  MENU_SELECT: 'sfx_menu_select',
  MENU_BACK: 'sfx_menu_back',
  MENU_ERROR: 'sfx_menu_error',

  // Choice interaction
  CHOICE_HOVER: 'sfx_choice_hover',
  CHOICE_SELECT: 'sfx_choice_select',

  // Scene transitions
  PAGE_TURN: 'sfx_page_turn',

  // Inventory
  INVENTORY_OPEN: 'sfx_inventory_open',
  INVENTORY_CLOSE: 'sfx_inventory_close',
  ITEM_PICKUP: 'sfx_item_pickup',
  ITEM_USE: 'sfx_item_use',

  // Save/Load
  SAVE: 'sfx_save',
  LOAD: 'sfx_load',

  // Stats
  STAT_UP: 'sfx_stat_up',
  STAT_DOWN: 'sfx_stat_down',

  // Endings
  GAME_OVER: 'sfx_game_over',
  VICTORY: 'sfx_victory',
} as const;

/**
 * Music track identifiers.
 */
export const MUSIC_IDS = {
  TITLE: 'music_title',
  EXPLORATION: 'music_exploration',
  TENSION: 'music_tension',
  VICTORY: 'music_victory',
  DEFEAT: 'music_defeat',
} as const;

/**
 * Union type of all valid SFX IDs.
 */
export type SfxId = typeof SFX_IDS[keyof typeof SFX_IDS];

/**
 * Union type of all valid music IDs.
 */
export type MusicId = typeof MUSIC_IDS[keyof typeof MUSIC_IDS];

/**
 * Union type of all sound IDs.
 */
export type SoundId = SfxId | MusicId;

/**
 * Sound definition with path and category.
 */
interface SoundDefinition {
  path: string;
  category: AudioCategory;
}

/**
 * Base path for audio assets.
 * Files are served from public/ folder at root URL in production.
 */
const AUDIO_BASE_PATH = '/audio';

/**
 * Sound registry mapping IDs to file paths and categories.
 * Paths are relative to project root for Vite to resolve.
 */
export const SOUND_REGISTRY: Record<SoundId, SoundDefinition> = {
  // SFX
  [SFX_IDS.MENU_MOVE]: { path: `${AUDIO_BASE_PATH}/sfx/menu_move.ogg`, category: 'sfx' },
  [SFX_IDS.MENU_SELECT]: { path: `${AUDIO_BASE_PATH}/sfx/menu_select.ogg`, category: 'sfx' },
  [SFX_IDS.MENU_BACK]: { path: `${AUDIO_BASE_PATH}/sfx/menu_back.ogg`, category: 'sfx' },
  [SFX_IDS.MENU_ERROR]: { path: `${AUDIO_BASE_PATH}/sfx/menu_error.ogg`, category: 'sfx' },
  [SFX_IDS.CHOICE_HOVER]: { path: `${AUDIO_BASE_PATH}/sfx/choice_hover.ogg`, category: 'sfx' },
  [SFX_IDS.CHOICE_SELECT]: { path: `${AUDIO_BASE_PATH}/sfx/choice_select.ogg`, category: 'sfx' },
  [SFX_IDS.PAGE_TURN]: { path: `${AUDIO_BASE_PATH}/sfx/page_turn.ogg`, category: 'sfx' },
  [SFX_IDS.INVENTORY_OPEN]: { path: `${AUDIO_BASE_PATH}/sfx/inventory_open.ogg`, category: 'sfx' },
  [SFX_IDS.INVENTORY_CLOSE]: { path: `${AUDIO_BASE_PATH}/sfx/inventory_close.ogg`, category: 'sfx' },
  [SFX_IDS.ITEM_PICKUP]: { path: `${AUDIO_BASE_PATH}/sfx/item_pickup.ogg`, category: 'sfx' },
  [SFX_IDS.ITEM_USE]: { path: `${AUDIO_BASE_PATH}/sfx/item_use.ogg`, category: 'sfx' },
  [SFX_IDS.SAVE]: { path: `${AUDIO_BASE_PATH}/sfx/save.ogg`, category: 'sfx' },
  [SFX_IDS.LOAD]: { path: `${AUDIO_BASE_PATH}/sfx/load.ogg`, category: 'sfx' },
  [SFX_IDS.STAT_UP]: { path: `${AUDIO_BASE_PATH}/sfx/stat_up.ogg`, category: 'sfx' },
  [SFX_IDS.STAT_DOWN]: { path: `${AUDIO_BASE_PATH}/sfx/stat_down.ogg`, category: 'sfx' },
  [SFX_IDS.GAME_OVER]: { path: `${AUDIO_BASE_PATH}/sfx/game_over.ogg`, category: 'sfx' },
  [SFX_IDS.VICTORY]: { path: `${AUDIO_BASE_PATH}/sfx/victory.ogg`, category: 'sfx' },

  // Music
  [MUSIC_IDS.TITLE]: { path: `${AUDIO_BASE_PATH}/music/title.ogg`, category: 'music' },
  [MUSIC_IDS.EXPLORATION]: { path: `${AUDIO_BASE_PATH}/music/exploration.ogg`, category: 'music' },
  [MUSIC_IDS.TENSION]: { path: `${AUDIO_BASE_PATH}/music/tension.ogg`, category: 'music' },
  [MUSIC_IDS.VICTORY]: { path: `${AUDIO_BASE_PATH}/music/victory.ogg`, category: 'music' },
  [MUSIC_IDS.DEFEAT]: { path: `${AUDIO_BASE_PATH}/music/defeat.ogg`, category: 'music' },
};

/**
 * Get the file path for a sound ID.
 */
export function getSoundPath(id: SoundId): string {
  return SOUND_REGISTRY[id].path;
}

/**
 * Get the category for a sound ID.
 */
export function getSoundCategory(id: SoundId): AudioCategory {
  return SOUND_REGISTRY[id].category;
}

/**
 * Check if a sound ID is an SFX.
 */
export function isSfx(id: SoundId): id is SfxId {
  return SOUND_REGISTRY[id].category === 'sfx';
}

/**
 * Check if a sound ID is music.
 */
export function isMusic(id: SoundId): id is MusicId {
  return SOUND_REGISTRY[id].category === 'music';
}
