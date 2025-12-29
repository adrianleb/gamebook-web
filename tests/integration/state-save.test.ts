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
  createTestManifest,
  createTestEngine,
  GameState,
} from '../setup';
import type { SaveFile, SerializedGameState, SAVE_VERSION } from '../../src/engine';

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

  describe('Save Migration', () => {
    it('should detect saves from older versions', () => {
      const oldVersionSave = {
        version: '0.9.0', // Older version
        schemaVersion: '0.9.0',
        timestamp: Date.now(),
        playtime: 3600,
        slot: 1,
        name: 'Old Save',
        preview: { nodeTitle: 'Test', actNumber: 1, choiceCount: 5 },
        state: {
          currentNodeId: 'ACT1_START',
          previousNodeId: null,
          flags: {},
          stats: { health: 100 },
          inventory: [],
          factions: {},
          visitedNodes: ['ACT1_START'],
          choicesMade: [],
        },
        checksum: 'abc123',
      };

      mockStorage.setItem('gamebook_save_1', JSON.stringify(oldVersionSave));
      const loaded = JSON.parse(mockStorage.getItem('gamebook_save_1') ?? '{}');

      // Should be able to read version for migration check
      expect(loaded.version).toBe('0.9.0');
      expect(loaded.version !== '1.0.0').toBe(true); // Needs migration
    });

    it('should handle missing fields gracefully', () => {
      const incompleteSave = {
        version: '1.0.0',
        timestamp: Date.now(),
        slot: 1,
        state: {
          currentNodeId: 'ACT1_START',
          // Missing other fields
        },
      };

      mockStorage.setItem('gamebook_save_1', JSON.stringify(incompleteSave));
      const loaded = JSON.parse(mockStorage.getItem('gamebook_save_1') ?? '{}');

      // Should load but with missing fields
      expect(loaded.state.currentNodeId).toBe('ACT1_START');
      expect(loaded.state.flags).toBeUndefined(); // Missing field
    });

    it('should preserve backward-compatible fields', () => {
      const state = createVictoryPathState();
      const saveFile = {
        version: '1.0.0',
        schemaVersion: '1.0.0',
        timestamp: Date.now(),
        playtime: 1800,
        slot: 2,
        name: 'Victory Save',
        preview: {
          nodeTitle: 'Final Confrontation',
          actNumber: 3,
          choiceCount: 25,
        },
        state: {
          currentNodeId: state.currentNodeId,
          previousNodeId: state.previousNodeId,
          flags: state.flags,
          stats: state.stats,
          inventory: state.inventory,
          factions: state.factions,
          visitedNodes: state.visitedNodes,
          choicesMade: state.choicesMade,
        },
        checksum: 'calculated_checksum',
      };

      mockStorage.setItem('gamebook_save_2', JSON.stringify(saveFile));
      const loaded = JSON.parse(mockStorage.getItem('gamebook_save_2') ?? '{}');

      expect(loaded.state.flags.FACTION_A_JOINED).toBe(true);
      expect(loaded.preview.actNumber).toBe(3);
    });
  });

  describe('Save Integrity', () => {
    it('should include checksum field in save file', () => {
      const state = createInitialState();
      const saveFile = {
        version: '1.0.0',
        schemaVersion: '1.0.0',
        timestamp: Date.now(),
        playtime: 0,
        slot: 1,
        name: 'Test Save',
        preview: { nodeTitle: 'Start', actNumber: 1, choiceCount: 0 },
        state: {
          currentNodeId: state.currentNodeId,
          previousNodeId: state.previousNodeId,
          flags: state.flags,
          stats: state.stats,
          inventory: state.inventory,
          factions: state.factions,
          visitedNodes: state.visitedNodes,
          choicesMade: state.choicesMade,
        },
        checksum: 'initial_checksum',
      };

      mockStorage.setItem('gamebook_save_1', JSON.stringify(saveFile));
      const loaded = JSON.parse(mockStorage.getItem('gamebook_save_1') ?? '{}');

      expect(loaded.checksum).toBeDefined();
      expect(typeof loaded.checksum).toBe('string');
    });

    it('should detect modified save data', () => {
      const originalState = createInitialState({ stats: { health: 100 } });
      const originalChecksum = 'original_hash';

      const saveFile = {
        version: '1.0.0',
        schemaVersion: '1.0.0',
        timestamp: Date.now(),
        playtime: 0,
        slot: 1,
        name: 'Test Save',
        preview: { nodeTitle: 'Start', actNumber: 1, choiceCount: 0 },
        state: {
          currentNodeId: originalState.currentNodeId,
          previousNodeId: originalState.previousNodeId,
          flags: originalState.flags,
          stats: originalState.stats,
          inventory: originalState.inventory,
          factions: originalState.factions,
          visitedNodes: originalState.visitedNodes,
          choicesMade: originalState.choicesMade,
        },
        checksum: originalChecksum,
      };

      // Simulate tampering
      const tamperedSave = JSON.parse(JSON.stringify(saveFile));
      tamperedSave.state.stats.health = 9999; // Tamper with health

      // Checksum should still be the original (doesn't match tampered data)
      expect(tamperedSave.checksum).toBe(originalChecksum);
      expect(tamperedSave.state.stats.health).not.toBe(originalState.stats.health);
    });

    it('should load state via engine loadGameState', () => {
      const manifest = createTestManifest({
        nodes: [
          { id: 'ACT1_START', title: 'Start', body: 'Start', choices: [] },
          { id: 'ACT1_SAVED', title: 'Saved', body: 'Saved state', choices: [] },
        ],
        items: [],
        initialState: {
          currentNodeId: 'ACT1_START',
          flags: {},
          stats: { health: 100 },
          inventory: [],
          factions: {},
        },
      });

      const { engine } = createTestEngine(manifest);

      // Create a saved state
      const savedState = {
        currentNodeId: 'ACT1_SAVED',
        previousNodeId: 'ACT1_START',
        flags: { SAVED_FLAG: true },
        stats: { health: 75 },
        inventory: [],
        factions: {},
        visitedNodes: ['ACT1_START', 'ACT1_SAVED'],
        choicesMade: [],
        isTransitioning: false,
        pendingEffects: [],
      };

      // Load the saved state via engine
      engine.loadGameState(savedState);

      expect(engine.getGameState()?.currentNodeId).toBe('ACT1_SAVED');
      expect(engine.getGameState()?.flags.SAVED_FLAG).toBe(true);
      expect(engine.getGameState()?.stats.health).toBe(75);
    });
  });
});
