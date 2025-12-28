/**
 * AudioManager - Singleton audio system using Web Audio API.
 *
 * Handles all game audio with:
 * - Browser autoplay policy compliance
 * - Volume controls (master, sfx, music)
 * - Mute toggle
 * - LocalStorage persistence
 * - Graceful degradation on errors
 * - Dev-mode tone generation for testing
 *
 * Based on /docs/AUDIO.md specification.
 */

import {
  AudioSettings,
  DEFAULT_AUDIO_SETTINGS,
  AUDIO_SETTINGS_KEY,
  AudioContextState,
  PlayOptions,
  LoadedSound,
  ActiveSound,
  MAX_CONCURRENT_SFX,
} from './types';
import { SoundId, SOUND_REGISTRY, getSoundCategory, isSfx } from './constants';

/**
 * Singleton AudioManager instance.
 */
let instance: AudioManager | null = null;

/**
 * AudioManager class - singleton pattern.
 *
 * Usage:
 *   const audio = AudioManager.getInstance();
 *   await audio.init();
 *   audio.play('sfx_menu_select');
 */
export class AudioManager {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  private settings: AudioSettings;
  private loadedSounds: Map<string, LoadedSound> = new Map();
  private activeSounds: Map<string, ActiveSound> = new Map();
  private currentMusic: ActiveSound | null = null;

  private initialized = false;
  private userInteracted = false;
  private pendingSounds: Array<{ id: SoundId; options?: PlayOptions }> = [];

  /** Dev mode: generate tones instead of loading files */
  private devMode = false;

  private constructor() {
    this.settings = this.loadSettings();
  }

  /**
   * Get the singleton instance.
   */
  static getInstance(): AudioManager {
    if (!instance) {
      instance = new AudioManager();
    }
    return instance;
  }

  /**
   * Initialize the audio system.
   * Must be called before playing sounds.
   * Safe to call multiple times.
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      this.context = new AudioContext();
      this.setupGainNodes();
      this.applySettings();
      this.setupUserInteractionHandler();
      this.initialized = true;

      // Check if dev mode should be enabled (no audio files present)
      await this.checkDevMode();

      console.log('[AudioManager] Initialized', {
        state: this.context.state,
        devMode: this.devMode,
      });
    } catch (error) {
      console.error('[AudioManager] Failed to initialize:', error);
      // Continue without audio - graceful degradation
    }
  }

  /**
   * Enable dev mode with programmatic tone generation.
   * Useful for testing audio pipeline without actual audio files.
   */
  enableDevMode(): void {
    this.devMode = true;
    console.log('[AudioManager] Dev mode enabled - using generated tones');
  }

  /**
   * Disable dev mode.
   */
  disableDevMode(): void {
    this.devMode = false;
    console.log('[AudioManager] Dev mode disabled - using audio files');
  }

  /**
   * Check if audio files exist, enable dev mode if not.
   */
  private async checkDevMode(): Promise<void> {
    // Try to fetch one audio file to check if assets exist
    try {
      const testPath = SOUND_REGISTRY['sfx_menu_select'].path;
      const response = await fetch(testPath, { method: 'HEAD' });
      if (!response.ok) {
        this.enableDevMode();
      }
    } catch {
      // Network error or file not found - enable dev mode
      this.enableDevMode();
    }
  }

  /**
   * Setup gain node hierarchy for volume mixing.
   * Master -> Category (SFX/Music) -> Individual sounds
   */
  private setupGainNodes(): void {
    if (!this.context) return;

    this.masterGain = this.context.createGain();
    this.masterGain.connect(this.context.destination);

    this.sfxGain = this.context.createGain();
    this.sfxGain.connect(this.masterGain);

    this.musicGain = this.context.createGain();
    this.musicGain.connect(this.masterGain);
  }

  /**
   * Handle browser autoplay policy.
   * Audio context is suspended until user interaction.
   */
  private setupUserInteractionHandler(): void {
    const resumeAudio = async () => {
      if (this.context && this.context.state === 'suspended') {
        try {
          await this.context.resume();
          this.userInteracted = true;
          console.log('[AudioManager] Audio context resumed');

          // Play any pending sounds
          this.flushPendingSounds();
        } catch (error) {
          console.error('[AudioManager] Failed to resume context:', error);
        }
      }
      // Remove listeners after first interaction
      document.removeEventListener('click', resumeAudio);
      document.removeEventListener('keydown', resumeAudio);
      document.removeEventListener('touchstart', resumeAudio);
    };

    document.addEventListener('click', resumeAudio);
    document.addEventListener('keydown', resumeAudio);
    document.addEventListener('touchstart', resumeAudio);
  }

  /**
   * Play pending sounds that were queued before user interaction.
   */
  private flushPendingSounds(): void {
    const pending = [...this.pendingSounds];
    this.pendingSounds = [];
    for (const { id, options } of pending) {
      this.play(id, options);
    }
  }

  // ==================== Volume Controls ====================

  /**
   * Set master volume (0-100).
   */
  setMasterVolume(volume: number): void {
    this.settings.masterVolume = Math.max(0, Math.min(100, volume));
    this.applySettings();
    this.saveSettings();
  }

  /**
   * Set SFX volume (0-100).
   */
  setSfxVolume(volume: number): void {
    this.settings.sfxVolume = Math.max(0, Math.min(100, volume));
    this.applySettings();
    this.saveSettings();
  }

  /**
   * Set music volume (0-100).
   */
  setMusicVolume(volume: number): void {
    this.settings.musicVolume = Math.max(0, Math.min(100, volume));
    this.applySettings();
    this.saveSettings();
  }

  /**
   * Toggle mute state.
   */
  toggleMute(): boolean {
    this.settings.muted = !this.settings.muted;
    this.applySettings();
    this.saveSettings();
    return this.settings.muted;
  }

  /**
   * Set mute state explicitly.
   */
  setMuted(muted: boolean): void {
    this.settings.muted = muted;
    this.applySettings();
    this.saveSettings();
  }

  /**
   * Get current audio settings.
   */
  getSettings(): Readonly<AudioSettings> {
    return { ...this.settings };
  }

  /**
   * Check if audio is currently muted.
   */
  isMuted(): boolean {
    return this.settings.muted;
  }

  /**
   * Apply current settings to gain nodes.
   */
  private applySettings(): void {
    if (!this.masterGain || !this.sfxGain || !this.musicGain) return;

    const masterVol = this.settings.muted ? 0 : this.settings.masterVolume / 100;
    const sfxVol = this.settings.sfxVolume / 100;
    const musicVol = this.settings.musicVolume / 100;

    this.masterGain.gain.value = masterVol;
    this.sfxGain.gain.value = sfxVol;
    this.musicGain.gain.value = musicVol;
  }

  // ==================== Persistence ====================

  /**
   * Load settings from LocalStorage.
   */
  private loadSettings(): AudioSettings {
    try {
      const stored = localStorage.getItem(AUDIO_SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_AUDIO_SETTINGS, ...parsed };
      }
    } catch (error) {
      console.warn('[AudioManager] Failed to load settings:', error);
    }
    return { ...DEFAULT_AUDIO_SETTINGS };
  }

  /**
   * Save settings to LocalStorage.
   */
  private saveSettings(): void {
    try {
      localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(this.settings));
    } catch (error) {
      console.warn('[AudioManager] Failed to save settings:', error);
    }
  }

  // ==================== Playback ====================

  /**
   * Play a sound by ID.
   *
   * @param id - Sound ID from constants
   * @param options - Playback options
   * @returns Instance ID for stopping, or null if failed
   */
  play(id: SoundId, options?: PlayOptions): string | null {
    if (!this.initialized || !this.context) {
      console.warn(`[AudioManager] Not initialized, cannot play: ${id}`);
      return null;
    }

    // Queue sound if context is suspended (awaiting user interaction)
    if (this.context.state === 'suspended') {
      const pendingSound = options ? { id, options } : { id };
      this.pendingSounds.push(pendingSound);
      console.log(`[AudioManager] Queued sound (awaiting interaction): ${id}`);
      return null;
    }

    // Enforce concurrent SFX limit
    if (isSfx(id)) {
      const activeSfxCount = Array.from(this.activeSounds.values())
        .filter(s => isSfx(s.soundId as SoundId))
        .length;
      if (activeSfxCount >= MAX_CONCURRENT_SFX) {
        // Stop oldest SFX to make room
        const oldest = Array.from(this.activeSounds.entries())
          .filter(([, s]) => isSfx(s.soundId as SoundId))
          .sort((a, b) => a[1].startedAt - b[1].startedAt)[0];
        if (oldest) {
          this.stop(oldest[0]);
        }
      }
    }

    try {
      if (this.devMode) {
        return this.playDevTone(id, options);
      } else {
        return this.playSound(id, options);
      }
    } catch (error) {
      console.error(`[AudioManager] Playback failed: ${id}`, error);
      return null;
    }
  }

  /**
   * Play a sound from loaded buffers.
   */
  private playSound(id: SoundId, options?: PlayOptions): string | null {
    const sound = this.loadedSounds.get(id);
    if (!sound) {
      console.warn(`[AudioManager] Sound not loaded: ${id}`);
      // Attempt to load and play
      this.loadAndPlay(id, options);
      return null;
    }

    return this.playSoundBuffer(id, sound, options);
  }

  /**
   * Load a sound and play it.
   */
  private async loadAndPlay(id: SoundId, options?: PlayOptions): Promise<void> {
    try {
      await this.preload(id);
      this.play(id, options);
    } catch (error) {
      console.error(`[AudioManager] Failed to load and play: ${id}`, error);
    }
  }

  /**
   * Play a sound from an AudioBuffer.
   */
  private playSoundBuffer(
    id: SoundId,
    sound: LoadedSound,
    options?: PlayOptions
  ): string {
    if (!this.context) throw new Error('No audio context');

    const source = this.context.createBufferSource();
    source.buffer = sound.buffer;
    source.loop = options?.loop ?? false;

    // Create gain node for this instance
    const gainNode = this.context.createGain();
    gainNode.gain.value = options?.volume ?? 1;

    // Connect through category gain
    const categoryGain = sound.category === 'music' ? this.musicGain : this.sfxGain;
    if (categoryGain) {
      source.connect(gainNode);
      gainNode.connect(categoryGain);
    }

    const instanceId = `${id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const activeSound: ActiveSound = {
      id: instanceId,
      soundId: id,
      source,
      gainNode,
      loop: options?.loop ?? false,
      startedAt: Date.now(),
    };

    this.activeSounds.set(instanceId, activeSound);

    // Handle music: stop previous track
    if (sound.category === 'music') {
      if (this.currentMusic) {
        this.stop(this.currentMusic.id);
      }
      this.currentMusic = activeSound;
    }

    // Cleanup on end
    source.onended = () => {
      this.activeSounds.delete(instanceId);
      if (this.currentMusic?.id === instanceId) {
        this.currentMusic = null;
      }
      options?.onEnd?.();
    };

    source.start(0);
    return instanceId;
  }

  /**
   * Play a generated tone (dev mode).
   */
  private playDevTone(id: SoundId, options?: PlayOptions): string {
    if (!this.context) throw new Error('No audio context');

    const category = getSoundCategory(id);
    const duration = this.getDevToneDuration(id);
    const frequency = this.getDevToneFrequency(id);

    const oscillator = this.context.createOscillator();
    oscillator.type = 'square'; // Retro sound
    oscillator.frequency.value = frequency;

    const gainNode = this.context.createGain();
    const baseVolume = (options?.volume ?? 1) * 0.3; // Keep dev tones quieter
    gainNode.gain.setValueAtTime(baseVolume, this.context.currentTime);

    // Quick fade out to avoid clicks
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      this.context.currentTime + duration
    );

    const categoryGain = category === 'music' ? this.musicGain : this.sfxGain;
    if (categoryGain) {
      oscillator.connect(gainNode);
      gainNode.connect(categoryGain);
    }

    const instanceId = `dev-${id}-${Date.now()}`;

    oscillator.start(this.context.currentTime);
    oscillator.stop(this.context.currentTime + duration);

    oscillator.onended = () => {
      this.activeSounds.delete(instanceId);
      options?.onEnd?.();
    };

    // Store as active sound (simplified)
    this.activeSounds.set(instanceId, {
      id: instanceId,
      soundId: id,
      source: oscillator as unknown as AudioBufferSourceNode,
      gainNode,
      loop: false,
      startedAt: Date.now(),
    });

    console.log(`[AudioManager] Dev tone: ${id} (${frequency}Hz, ${duration}s)`);
    return instanceId;
  }

  /**
   * Get tone duration based on sound type.
   */
  private getDevToneDuration(id: SoundId): number {
    if (id.includes('menu_move') || id.includes('hover')) return 0.05;
    if (id.includes('select') || id.includes('back')) return 0.1;
    if (id.includes('page_turn')) return 0.3;
    if (id.includes('victory') || id.includes('game_over')) return 0.8;
    if (id.includes('music')) return 2; // Short for dev testing
    return 0.15;
  }

  /**
   * Get tone frequency based on sound type.
   */
  private getDevToneFrequency(id: SoundId): number {
    // Different frequencies for different sound types
    if (id.includes('menu_move')) return 440; // A4
    if (id.includes('menu_select') || id.includes('confirm')) return 880; // A5
    if (id.includes('back') || id.includes('cancel')) return 330; // E4
    if (id.includes('error')) return 220; // A3
    if (id.includes('stat_up')) return 660; // E5
    if (id.includes('stat_down')) return 294; // D4
    if (id.includes('victory')) return 523; // C5
    if (id.includes('game_over') || id.includes('defeat')) return 196; // G3
    if (id.includes('inventory')) return 392; // G4
    if (id.includes('item')) return 494; // B4
    if (id.includes('save')) return 587; // D5
    if (id.includes('load')) return 523; // C5
    if (id.includes('page_turn')) return 349; // F4
    if (id.includes('music')) return 262; // C4
    return 440; // Default A4
  }

  /**
   * Stop a sound by instance ID.
   */
  stop(instanceId: string): void {
    const sound = this.activeSounds.get(instanceId);
    if (sound) {
      try {
        sound.source.stop();
      } catch {
        // Already stopped
      }
      this.activeSounds.delete(instanceId);
      if (this.currentMusic?.id === instanceId) {
        this.currentMusic = null;
      }
    }
  }

  /**
   * Stop all sounds.
   */
  stopAll(): void {
    for (const [id] of this.activeSounds) {
      this.stop(id);
    }
    this.currentMusic = null;
  }

  /**
   * Stop all SFX (but keep music playing).
   */
  stopAllSfx(): void {
    for (const [id, sound] of this.activeSounds) {
      if (isSfx(sound.soundId as SoundId)) {
        this.stop(id);
      }
    }
  }

  /**
   * Stop current music track.
   */
  stopMusic(): void {
    if (this.currentMusic) {
      this.stop(this.currentMusic.id);
    }
  }

  // ==================== Preloading ====================

  /**
   * Preload a sound for instant playback.
   */
  async preload(id: SoundId): Promise<void> {
    if (this.loadedSounds.has(id) || this.devMode) return;
    if (!this.context) return;

    const definition = SOUND_REGISTRY[id];
    if (!definition) {
      console.warn(`[AudioManager] Unknown sound ID: ${id}`);
      return;
    }

    try {
      const response = await fetch(definition.path);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.context.decodeAudioData(arrayBuffer);

      this.loadedSounds.set(id, {
        buffer: audioBuffer,
        category: definition.category,
        path: definition.path,
      });

      console.log(`[AudioManager] Loaded: ${id}`);
    } catch (error) {
      console.error(`[AudioManager] Failed to load ${id}:`, error);
      // Enable dev mode as fallback
      if (!this.devMode) {
        console.log('[AudioManager] Falling back to dev mode');
        this.enableDevMode();
      }
    }
  }

  /**
   * Preload multiple sounds.
   */
  async preloadAll(ids: SoundId[]): Promise<void> {
    await Promise.all(ids.map(id => this.preload(id)));
  }

  // ==================== State ====================

  /**
   * Check if the audio system is ready to play sounds.
   */
  isReady(): boolean {
    return this.initialized && this.context?.state === 'running';
  }

  /**
   * Check if user has interacted (audio unlocked).
   */
  hasUserInteracted(): boolean {
    return this.userInteracted || this.context?.state === 'running';
  }

  /**
   * Get audio context state.
   */
  getContextState(): AudioContextState | null {
    return this.context?.state ?? null;
  }

  /**
   * Check if in dev mode.
   */
  isDevMode(): boolean {
    return this.devMode;
  }

  /**
   * Cleanup and dispose of audio resources.
   */
  dispose(): void {
    this.stopAll();
    this.loadedSounds.clear();
    if (this.context) {
      this.context.close();
      this.context = null;
    }
    this.initialized = false;
    instance = null;
  }
}

// Re-export for convenience
export { SFX_IDS, MUSIC_IDS } from './constants';
export type { SoundId, SfxId, MusicId } from './constants';
export type { AudioSettings } from './types';
