/**
 * Settings Service
 *
 * Manages game settings with localStorage persistence.
 * Follows ENGINE.md patterns with PREFS_KEY for storage.
 *
 * Settings include:
 * - Audio: Master/Music/SFX volume, mute state
 * - Display: Text speed, screen shake
 * - Controls: Show hotkeys
 */

export type TextSpeed = 'instant' | 'fast' | 'normal' | 'slow';

export interface GameSettings {
  // Audio settings
  masterVolume: number;   // 0-100
  musicVolume: number;    // 0-100
  sfxVolume: number;      // 0-100
  muted: boolean;

  // Display settings
  textSpeed: TextSpeed;
  screenShake: boolean;

  // Control settings
  showHotkeys: boolean;
}

const PREFS_KEY = 'gamebook_prefs';

const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 80,
  musicVolume: 60,
  sfxVolume: 100,
  muted: false,
  textSpeed: 'normal',
  screenShake: true,
  showHotkeys: true,
};

type SettingsListener = (settings: GameSettings) => void;

class SettingsServiceImpl {
  private settings: GameSettings;
  private listeners: Set<SettingsListener> = new Set();

  constructor() {
    this.settings = this.load();
  }

  /**
   * Get current settings (read-only copy)
   */
  getSettings(): Readonly<GameSettings> {
    return { ...this.settings };
  }

  /**
   * Get a specific setting value
   */
  get<K extends keyof GameSettings>(key: K): GameSettings[K] {
    return this.settings[key];
  }

  /**
   * Update one or more settings
   */
  update(partial: Partial<GameSettings>): void {
    this.settings = { ...this.settings, ...partial };
    this.save();
    this.notifyListeners();
  }

  /**
   * Set a specific setting value
   */
  set<K extends keyof GameSettings>(key: K, value: GameSettings[K]): void {
    this.settings[key] = value;
    this.save();
    this.notifyListeners();
  }

  /**
   * Toggle mute state
   */
  toggleMute(): boolean {
    this.settings.muted = !this.settings.muted;
    this.save();
    this.notifyListeners();
    return this.settings.muted;
  }

  /**
   * Adjust master volume by delta (clamped to 0-100)
   */
  adjustMasterVolume(delta: number): number {
    this.settings.masterVolume = clamp(this.settings.masterVolume + delta, 0, 100);
    this.save();
    this.notifyListeners();
    return this.settings.masterVolume;
  }

  /**
   * Get effective volume (considering mute and master)
   */
  getEffectiveVolume(type: 'music' | 'sfx'): number {
    if (this.settings.muted) return 0;
    const typeVolume = type === 'music' ? this.settings.musicVolume : this.settings.sfxVolume;
    return (this.settings.masterVolume / 100) * (typeVolume / 100);
  }

  /**
   * Subscribe to settings changes
   */
  subscribe(listener: SettingsListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Reset all settings to defaults
   */
  reset(): void {
    this.settings = { ...DEFAULT_SETTINGS };
    this.save();
    this.notifyListeners();
  }

  private load(): GameSettings {
    try {
      const stored = localStorage.getItem(PREFS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<GameSettings>;
        // Merge with defaults to handle new settings added in updates
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
    return { ...DEFAULT_SETTINGS };
  }

  private save(): void {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.warn('Failed to save settings:', e);
    }
  }

  private notifyListeners(): void {
    const settings = this.getSettings();
    Array.from(this.listeners).forEach(listener => listener(settings));
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Singleton instance
let instance: SettingsServiceImpl | null = null;

export function getSettingsService(): SettingsServiceImpl {
  if (!instance) {
    instance = new SettingsServiceImpl();
  }
  return instance;
}

// Export the type for consumers
export type SettingsService = SettingsServiceImpl;
