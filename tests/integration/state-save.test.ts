/**
 * State Management + Save System Integration Tests
 *
 * Tests the interaction between game state and save/load functionality.
 *
 * @see /docs/ENGINE.md for save format specification
 * @see /docs/QA.md for save/load test requirements
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createInitialState,
  createVictoryPathState,
  createMockLocalStorage,
  GameState,
} from '../setup';

describe('State + Save System Integration', () => {
  let mockStorage: ReturnType<typeof createMockLocalStorage>;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    globalThis.localStorage = mockStorage as unknown as Storage;
  });

  describe('State Serialization', () => {
    it('should serialize game state to JSON', () => {
      const state = createInitialState();
      const json = JSON.stringify(state);

      expect(json).toBeTruthy();
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should preserve all state fields after serialization', () => {
      const state = createVictoryPathState();
      const json = JSON.stringify(state);
      const restored = JSON.parse(json) as GameState;

      expect(restored.currentNodeId).toBe(state.currentNodeId);
      expect(restored.flags).toEqual(state.flags);
      expect(restored.stats).toEqual(state.stats);
      expect(restored.inventory).toEqual(state.inventory);
      expect(restored.factions).toEqual(state.factions);
      expect(restored.visitedNodes).toEqual(state.visitedNodes);
    });

    it('should handle empty inventory', () => {
      const state = createInitialState({ inventory: [] });
      const json = JSON.stringify(state);
      const restored = JSON.parse(json) as GameState;

      expect(restored.inventory).toEqual([]);
    });

    it('should handle complex flags', () => {
      const state = createInitialState({
        flags: {
          FLAG_A: true,
          FLAG_B: false,
          FLAG_C: true,
        },
      });
      const json = JSON.stringify(state);
      const restored = JSON.parse(json) as GameState;

      expect(restored.flags.FLAG_A).toBe(true);
      expect(restored.flags.FLAG_B).toBe(false);
      expect(restored.flags.FLAG_C).toBe(true);
    });
  });

  describe('LocalStorage Integration', () => {
    it('should save state to localStorage', () => {
      const state = createInitialState();
      const key = 'gamebook_save_1';

      mockStorage.setItem(key, JSON.stringify(state));

      expect(mockStorage.getItem(key)).toBeTruthy();
    });

    it('should load state from localStorage', () => {
      const state = createVictoryPathState();
      const key = 'gamebook_save_1';

      mockStorage.setItem(key, JSON.stringify(state));
      const loaded = JSON.parse(mockStorage.getItem(key) ?? '{}') as GameState;

      expect(loaded.currentNodeId).toBe(state.currentNodeId);
    });

    it('should support multiple save slots', () => {
      const state1 = createInitialState({ currentNodeId: 'SLOT_1' });
      const state2 = createInitialState({ currentNodeId: 'SLOT_2' });
      const state3 = createInitialState({ currentNodeId: 'SLOT_3' });

      mockStorage.setItem('gamebook_save_1', JSON.stringify(state1));
      mockStorage.setItem('gamebook_save_2', JSON.stringify(state2));
      mockStorage.setItem('gamebook_save_3', JSON.stringify(state3));

      expect(
        JSON.parse(mockStorage.getItem('gamebook_save_1') ?? '{}').currentNodeId
      ).toBe('SLOT_1');
      expect(
        JSON.parse(mockStorage.getItem('gamebook_save_2') ?? '{}').currentNodeId
      ).toBe('SLOT_2');
      expect(
        JSON.parse(mockStorage.getItem('gamebook_save_3') ?? '{}').currentNodeId
      ).toBe('SLOT_3');
    });

    it('should handle autosave slot (slot 0)', () => {
      const state = createInitialState({ currentNodeId: 'AUTOSAVE' });

      mockStorage.setItem('gamebook_save_0', JSON.stringify(state));

      const autosave = JSON.parse(
        mockStorage.getItem('gamebook_save_0') ?? '{}'
      ) as GameState;
      expect(autosave.currentNodeId).toBe('AUTOSAVE');
    });

    it('should delete saves', () => {
      const state = createInitialState();
      const key = 'gamebook_save_1';

      mockStorage.setItem(key, JSON.stringify(state));
      expect(mockStorage.getItem(key)).toBeTruthy();

      mockStorage.removeItem(key);
      expect(mockStorage.getItem(key)).toBeNull();
    });
  });

  describe('Save File Format', () => {
    interface SaveFile {
      version: string;
      schemaVersion: string;
      timestamp: number;
      slot: number;
      state: GameState;
    }

    it('should include version metadata in save file', () => {
      const state = createInitialState();
      const saveFile: SaveFile = {
        version: '1.0.0',
        schemaVersion: '1.0.0',
        timestamp: Date.now(),
        slot: 1,
        state,
      };

      const json = JSON.stringify(saveFile);
      const restored = JSON.parse(json) as SaveFile;

      expect(restored.version).toBe('1.0.0');
      expect(restored.schemaVersion).toBe('1.0.0');
      expect(restored.slot).toBe(1);
    });

    it('should preserve timestamp', () => {
      const now = Date.now();
      const state = createInitialState();
      const saveFile: SaveFile = {
        version: '1.0.0',
        schemaVersion: '1.0.0',
        timestamp: now,
        slot: 1,
        state,
      };

      const json = JSON.stringify(saveFile);
      const restored = JSON.parse(json) as SaveFile;

      expect(restored.timestamp).toBe(now);
    });
  });

  // TODO: Implement when save system is ready
  describe.skip('Save Migration', () => {
    it('should migrate saves from older versions');
    it('should reject incompatible save versions');
    it('should handle missing fields gracefully');
  });

  // TODO: Implement when save system is ready
  describe.skip('Save Integrity', () => {
    it('should detect corrupted saves via checksum');
    it('should reject tampered save files');
    it('should recover from partial corruption');
  });
});
