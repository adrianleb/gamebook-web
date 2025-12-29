/**
 * Unit tests for SaveManager.
 *
 * Tests:
 * - Save/load operations
 * - Checksum verification
 * - Migration system
 * - Autosave functionality
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SaveManager, createSaveManager, type Migration } from '@engine/save-manager';
import type { GameState, Node } from '@engine/types';
import { SAVE_VERSION, SCHEMA_VERSION } from '@engine/types';
import { EngineError } from '@engine/errors';

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockNode(id: string = 'ACT1_TEST'): Node {
  return {
    id,
    title: 'Test Node',
    body: 'Test body content',
    choices: [],
  };
}

function createMockGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    currentNodeId: 'ACT1_START',
    previousNodeId: null,
    flags: { TEST_FLAG: true },
    stats: { health: 100, maxHealth: 100 },
    inventory: [{ itemId: 'ITEM_TEST', quantity: 1 }],
    factions: { factionA: 50 },
    visitedNodes: ['ACT1_START'],
    choicesMade: [],
    isTransitioning: false,
    pendingEffects: [],
    ...overrides,
  };
}

function createMockStorage(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() { return Object.keys(store).length; },
  };
}

// =============================================================================
// Test Suites
// =============================================================================

describe('SaveManager', () => {
  let storage: Storage;
  let saveManager: SaveManager;
  let playtime: number;

  beforeEach(() => {
    storage = createMockStorage();
    playtime = 3600000; // 1 hour

    saveManager = createSaveManager({
      getNode: createMockNode,
      getPlaytime: () => playtime,
      storage,
    });
  });

  afterEach(() => {
    saveManager.dispose();
  });

  // ===========================================================================
  // Basic Save/Load
  // ===========================================================================

  describe('saveGame', () => {
    it('saves game state to specified slot', () => {
      const state = createMockGameState();
      const saveFile = saveManager.saveGame(state, 1);

      expect(saveFile.slot).toBe(1);
      expect(saveFile.version).toBe(SAVE_VERSION);
      expect(saveFile.schemaVersion).toBe(SCHEMA_VERSION);
      expect(saveFile.state.currentNodeId).toBe('ACT1_START');
      expect(saveFile.checksum).toBeTruthy();
    });

    it('saves to autosave slot (0)', () => {
      const state = createMockGameState();
      const saveFile = saveManager.saveGame(state, 0);

      expect(saveFile.slot).toBe(0);
      expect(saveFile.name).toContain('Autosave');
    });

    it('generates correct preview', () => {
      const state = createMockGameState({
        currentNodeId: 'ACT2_BOSS',
        choicesMade: [
          { nodeId: 'ACT1_START', choiceId: 'choice1', timestamp: 1 },
          { nodeId: 'ACT1_MID', choiceId: 'choice2', timestamp: 2 },
        ],
      });

      const saveFile = saveManager.saveGame(state, 1);

      expect(saveFile.preview.nodeTitle).toBe('Test Node');
      expect(saveFile.preview.actNumber).toBe(2);
      expect(saveFile.preview.choiceCount).toBe(2);
    });

    it('includes playtime in save', () => {
      playtime = 7200000; // 2 hours
      const state = createMockGameState();
      const saveFile = saveManager.saveGame(state, 1);

      expect(saveFile.playtime).toBe(7200000);
    });

    it('throws on invalid slot number', () => {
      const state = createMockGameState();

      expect(() => saveManager.saveGame(state, -1)).toThrow(EngineError);
      expect(() => saveManager.saveGame(state, 4)).toThrow(EngineError);
      expect(() => saveManager.saveGame(state, 1.5)).toThrow(EngineError);
    });

    it('strips runtime fields from saved state', () => {
      const state = createMockGameState({
        isTransitioning: true,
        pendingEffects: [{ type: 'setFlag', flag: 'TEST' }],
      });

      const saveFile = saveManager.saveGame(state, 1);

      // Runtime fields should not be in serialized state
      expect((saveFile.state as unknown as GameState).isTransitioning).toBeUndefined();
      expect((saveFile.state as unknown as GameState).pendingEffects).toBeUndefined();
    });
  });

  describe('loadGame', () => {
    it('loads saved game state', () => {
      const originalState = createMockGameState({
        flags: { UNIQUE_FLAG: true },
        stats: { health: 75 },
      });

      saveManager.saveGame(originalState, 1);
      const loadedState = saveManager.loadGame(1);

      expect(loadedState.currentNodeId).toBe(originalState.currentNodeId);
      expect(loadedState.flags.UNIQUE_FLAG).toBe(true);
      expect(loadedState.stats.health).toBe(75);
    });

    it('restores runtime fields with defaults', () => {
      const state = createMockGameState();
      saveManager.saveGame(state, 1);

      const loadedState = saveManager.loadGame(1);

      expect(loadedState.isTransitioning).toBe(false);
      expect(loadedState.pendingEffects).toEqual([]);
    });

    it('throws SAVE_NOT_FOUND for empty slot', () => {
      expect(() => saveManager.loadGame(2)).toThrow(EngineError);

      try {
        saveManager.loadGame(2);
      } catch (error) {
        expect((error as EngineError).code).toBe('SAVE_NOT_FOUND');
      }
    });

    it('creates deep copies of arrays and objects', () => {
      const originalState = createMockGameState();
      saveManager.saveGame(originalState, 1);

      const loadedState = saveManager.loadGame(1);

      // Modify loaded state
      loadedState.flags.NEW_FLAG = true;
      loadedState.inventory.push({ itemId: 'NEW_ITEM', quantity: 1 });

      // Load again - should not have modifications
      const loadedAgain = saveManager.loadGame(1);
      expect(loadedAgain.flags.NEW_FLAG).toBeUndefined();
      expect(loadedAgain.inventory.length).toBe(1);
    });
  });

  // ===========================================================================
  // List and Delete
  // ===========================================================================

  describe('listSaves', () => {
    it('returns null for empty slots', () => {
      const saves = saveManager.listSaves();

      expect(saves).toHaveLength(4);
      expect(saves.every(s => s === null)).toBe(true);
    });

    it('returns saved games in correct slots', () => {
      const state1 = createMockGameState({ currentNodeId: 'ACT1_A' });
      const state2 = createMockGameState({ currentNodeId: 'ACT2_B' });

      saveManager.saveGame(state1, 1);
      saveManager.saveGame(state2, 3);

      const saves = saveManager.listSaves();

      expect(saves[0]).toBeNull();
      expect(saves[1]).not.toBeNull();
      expect(saves[1]?.state.currentNodeId).toBe('ACT1_A');
      expect(saves[2]).toBeNull();
      expect(saves[3]).not.toBeNull();
      expect(saves[3]?.state.currentNodeId).toBe('ACT2_B');
    });
  });

  describe('deleteSave', () => {
    it('removes save from slot', () => {
      const state = createMockGameState();
      saveManager.saveGame(state, 1);

      expect(saveManager.hasSave(1)).toBe(true);

      saveManager.deleteSave(1);

      expect(saveManager.hasSave(1)).toBe(false);
      expect(() => saveManager.loadGame(1)).toThrow(EngineError);
    });

    it('does not throw when deleting empty slot', () => {
      expect(() => saveManager.deleteSave(2)).not.toThrow();
    });
  });

  describe('hasSave', () => {
    it('returns true for saved slots', () => {
      saveManager.saveGame(createMockGameState(), 1);

      expect(saveManager.hasSave(1)).toBe(true);
      expect(saveManager.hasSave(2)).toBe(false);
    });
  });

  // ===========================================================================
  // Checksum Verification
  // ===========================================================================

  describe('checksum verification', () => {
    it('generates consistent checksums', () => {
      const state = createMockGameState();

      const save1 = saveManager.saveGame(state, 1);
      const save2 = saveManager.saveGame(state, 2);

      expect(save1.checksum).toBe(save2.checksum);
    });

    it('generates different checksums for different states', () => {
      const state1 = createMockGameState({ flags: { A: true } });
      const state2 = createMockGameState({ flags: { B: true } });

      const save1 = saveManager.saveGame(state1, 1);
      const save2 = saveManager.saveGame(state2, 2);

      expect(save1.checksum).not.toBe(save2.checksum);
    });

    it('throws SAVE_CORRUPTED when checksum fails', () => {
      const state = createMockGameState();
      saveManager.saveGame(state, 1);

      // Tamper with the saved data
      const saveJson = storage.getItem('gamebook_save_1');
      const save = JSON.parse(saveJson!);
      save.state.flags.TAMPERED = true;
      storage.setItem('gamebook_save_1', JSON.stringify(save));

      expect(() => saveManager.loadGame(1)).toThrow(EngineError);

      try {
        saveManager.loadGame(1);
      } catch (error) {
        expect((error as EngineError).code).toBe('SAVE_CORRUPTED');
      }
    });
  });

  // ===========================================================================
  // Migration
  // ===========================================================================

  describe('migration', () => {
    it('applies migrations in order', () => {
      const migrations: Migration[] = [
        {
          fromVersion: '0.9.0',
          toVersion: '1.0.0',
          migrate: (state) => ({
            ...state,
            flags: { ...state.flags, MIGRATED_V1: true },
          }),
        },
      ];

      const saveManagerWithMigrations = createSaveManager({
        getNode: createMockNode,
        getPlaytime: () => playtime,
        storage,
        migrations,
      });

      // Create a save with old version
      const oldSave = {
        version: '0.9.0',
        schemaVersion: '1.0.0',
        timestamp: Date.now(),
        playtime: 0,
        slot: 1,
        name: 'Test',
        preview: { nodeTitle: 'Test', actNumber: 1, choiceCount: 0 },
        state: {
          currentNodeId: 'ACT1_START',
          previousNodeId: null,
          flags: {},
          stats: {},
          inventory: [],
          factions: {},
          visitedNodes: ['ACT1_START'],
          choicesMade: [],
        },
        checksum: '', // Will fail checksum - need to set correct one
      };

      // Calculate correct checksum - access private method via any
      const stateJson = JSON.stringify(oldSave.state);
      oldSave.checksum = (saveManagerWithMigrations as any).simpleHash(stateJson);

      storage.setItem('gamebook_save_1', JSON.stringify(oldSave));

      const loadedState = saveManagerWithMigrations.loadGame(1);
      expect(loadedState.flags.MIGRATED_V1).toBe(true);

      saveManagerWithMigrations.dispose();
    });

    it('throws MIGRATION_FAILED when no path exists', () => {
      const saveManagerNoMigrations = createSaveManager({
        getNode: createMockNode,
        getPlaytime: () => playtime,
        storage,
        migrations: [],
      });

      // Create a save with old version
      const oldSave = {
        version: '0.5.0',
        schemaVersion: '1.0.0',
        timestamp: Date.now(),
        playtime: 0,
        slot: 1,
        name: 'Test',
        preview: { nodeTitle: 'Test', actNumber: 1, choiceCount: 0 },
        state: {
          currentNodeId: 'ACT1_START',
          previousNodeId: null,
          flags: {},
          stats: {},
          inventory: [],
          factions: {},
          visitedNodes: ['ACT1_START'],
          choicesMade: [],
        },
        checksum: '',
      };

      const stateJson = JSON.stringify(oldSave.state);
      oldSave.checksum = (saveManagerNoMigrations as any).simpleHash(stateJson);

      storage.setItem('gamebook_save_1', JSON.stringify(oldSave));

      expect(() => saveManagerNoMigrations.loadGame(1)).toThrow(EngineError);

      try {
        saveManagerNoMigrations.loadGame(1);
      } catch (error) {
        expect((error as EngineError).code).toBe('MIGRATION_FAILED');
      }

      saveManagerNoMigrations.dispose();
    });

    it('skips migration for current version', () => {
      const state = createMockGameState();
      saveManager.saveGame(state, 1);

      // Should load without any migration
      const loadedState = saveManager.loadGame(1);
      expect(loadedState.currentNodeId).toBe('ACT1_START');
    });
  });

  // ===========================================================================
  // Autosave
  // ===========================================================================

  describe('autosave', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('triggers autosave on interval', () => {
      const state = createMockGameState();

      saveManager.setupAutosave({
        interval: 1000,
        intervalEnabled: true,
        getState: () => state,
      });

      expect(saveManager.hasSave(0)).toBe(false);

      vi.advanceTimersByTime(1000);

      expect(saveManager.hasSave(0)).toBe(true);
    });

    it('does not autosave when disabled', () => {
      const state = createMockGameState();

      saveManager.setupAutosave({
        interval: 1000,
        intervalEnabled: false,
        getState: () => state,
      });

      vi.advanceTimersByTime(5000);

      expect(saveManager.hasSave(0)).toBe(false);
    });

    it('onNodeTransition triggers autosave', () => {
      const state = createMockGameState();

      expect(saveManager.hasSave(0)).toBe(false);

      saveManager.onNodeTransition(state);

      expect(saveManager.hasSave(0)).toBe(true);
    });

    it('stopAutosave stops interval', () => {
      const state = createMockGameState();

      saveManager.setupAutosave({
        interval: 1000,
        getState: () => state,
      });

      vi.advanceTimersByTime(1000);
      expect(saveManager.hasSave(0)).toBe(true);

      saveManager.deleteSave(0);
      saveManager.stopAutosave();

      vi.advanceTimersByTime(5000);
      expect(saveManager.hasSave(0)).toBe(false);
    });

    it('dispose stops autosave', () => {
      const state = createMockGameState();

      saveManager.setupAutosave({
        interval: 1000,
        getState: () => state,
      });

      saveManager.dispose();

      vi.advanceTimersByTime(5000);
      expect(saveManager.hasSave(0)).toBe(false);
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe('error handling', () => {
    it('handles corrupted JSON in storage', () => {
      storage.setItem('gamebook_save_1', 'not valid json');

      expect(() => saveManager.loadGame(1)).toThrow(EngineError);

      try {
        saveManager.loadGame(1);
      } catch (error) {
        expect((error as EngineError).code).toBe('SAVE_CORRUPTED');
      }
    });

    it('listSaves returns null for corrupted saves', () => {
      storage.setItem('gamebook_save_1', 'invalid');
      saveManager.saveGame(createMockGameState(), 2);

      const saves = saveManager.listSaves();

      expect(saves[1]).toBeNull();
      expect(saves[2]).not.toBeNull();
    });

    it('autosave failure does not throw', () => {
      // Create a storage that throws on setItem
      const failingStorage = createMockStorage();
      failingStorage.setItem = () => {
        throw new Error('Storage full');
      };

      const failingManager = createSaveManager({
        getNode: createMockNode,
        getPlaytime: () => 0,
        storage: failingStorage,
      });

      const state = createMockGameState();

      // Should not throw
      expect(() => failingManager.onNodeTransition(state)).not.toThrow();

      failingManager.dispose();
    });
  });

  // ===========================================================================
  // Act Number Extraction
  // ===========================================================================

  describe('act number extraction', () => {
    it('extracts act number from node ID', () => {
      const states = [
        { nodeId: 'ACT1_START', expected: 1 },
        { nodeId: 'ACT2_BOSS', expected: 2 },
        { nodeId: 'ACT3_ENDING', expected: 3 },
        { nodeId: 'act1_lowercase', expected: 1 },
        { nodeId: 'UNKNOWN_NODE', expected: 1 }, // Default
      ];

      for (const { nodeId, expected } of states) {
        const state = createMockGameState({ currentNodeId: nodeId });
        const save = saveManager.saveGame(state, 1);
        expect(save.preview.actNumber).toBe(expected);
      }
    });
  });
});
