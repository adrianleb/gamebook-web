/**
 * Edge Case 4: Rapid Save/Load During Critical Choice
 *
 * Tests that save state is correctly restored each time,
 * all endings are reachable from the same save, and no
 * flag corruption occurs between loads.
 *
 * @see /docs/QA.md - Edge Case 4: Rapid Save/Load During Critical Choice
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCriticalChoiceState,
  createCriticalChoiceManifest,
  createTestEngine,
  GameState,
  GameEvent,
} from './setup';

describe('Edge Case 4: Rapid Save/Load During Critical Choice', () => {
  describe('State Restoration', () => {
    it('should correctly serialize and deserialize game state', () => {
      const originalState = createCriticalChoiceState();

      // Simulate save
      const serialized = JSON.stringify(originalState);

      // Simulate load
      const restored: GameState = JSON.parse(serialized);

      // Verify all core fields
      expect(restored.currentNodeId).toBe(originalState.currentNodeId);
      expect(restored.flags).toEqual(originalState.flags);
      expect(restored.stats).toEqual(originalState.stats);
      expect(restored.inventory).toEqual(originalState.inventory);
      expect(restored.factions).toEqual(originalState.factions);
      expect(restored.visitedNodes).toEqual(originalState.visitedNodes);
    });

    it('should preserve inventory items through save/load', () => {
      const state = createCriticalChoiceState();

      const saved = JSON.stringify(state);
      const loaded: GameState = JSON.parse(saved);

      expect(loaded.inventory).toContainEqual({
        itemId: 'ITEM_FACTION_A_ARTIFACT',
        quantity: 1,
      });
      expect(loaded.inventory).toContainEqual({
        itemId: 'ITEM_SACRED_AMULET',
        quantity: 1,
      });
    });

    it('should preserve all flags through save/load', () => {
      const state = createCriticalChoiceState();

      const saved = JSON.stringify(state);
      const loaded: GameState = JSON.parse(saved);

      // All critical flags should persist
      expect(loaded.flags.FACTION_A_JOINED).toBe(true);
      expect(loaded.flags.FACTION_LEADER_MET).toBe(true);
      expect(loaded.flags.FINAL_QUEST_ACCEPTED).toBe(true);
      expect(loaded.flags.ALLY_MARCUS_ALIVE).toBe(true);
      expect(loaded.flags.ALLY_ELENA_ALIVE).toBe(true);
      expect(loaded.flags.SACRIFICE_PATH_UNLOCKED).toBe(true);
      expect(loaded.flags.LOVED_ONE_IN_DANGER).toBe(true);
      expect(loaded.flags.NEUTRAL_PATH_AVAILABLE).toBe(true);
    });

    it('should preserve faction values through save/load', () => {
      const state = createCriticalChoiceState();

      const saved = JSON.stringify(state);
      const loaded: GameState = JSON.parse(saved);

      expect(loaded.factions.factionA).toBe(80);
      expect(loaded.factions.factionB).toBe(35);
      expect(loaded.factions.factionC).toBe(35);
    });
  });

  describe('Multiple Endings from Same Save', () => {
    it('should have multiple endings available at critical choice', () => {
      const manifest = createCriticalChoiceManifest();

      // Set up state with multiple ending paths available
      manifest.initialState = {
        currentNodeId: 'ACT3_FINAL_CONFRONTATION',
        flags: {
          FACTION_A_JOINED: true,
          FACTION_LEADER_MET: true,
          FINAL_QUEST_ACCEPTED: true,
          ALLY_MARCUS_ALIVE: true,
          ALLY_ELENA_ALIVE: true,
          SACRIFICE_PATH_UNLOCKED: true,
          LOVED_ONE_IN_DANGER: true,
          NEUTRAL_PATH_AVAILABLE: true,
          DOOM_SEALED: false,
        },
        stats: { health: 100 },
        inventory: [
          { itemId: 'ITEM_FACTION_A_ARTIFACT', quantity: 1 },
          { itemId: 'ITEM_SACRED_AMULET', quantity: 1 },
        ],
        factions: { factionA: 80, factionB: 35, factionC: 35 },
      };

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      const choices = engine.getAvailableChoices();
      const choiceIds = choices.map((c) => c.id);

      // All non-doom endings should be available
      expect(choiceIds).toContain('fight_for_victory');
      expect(choiceIds).toContain('sacrifice_self');
      expect(choiceIds).toContain('walk_away');
      expect(choiceIds).not.toContain('doomed_path'); // DOOM_SEALED is false
    });

    it('should reach victory ending from critical save', () => {
      const manifest = createCriticalChoiceManifest();
      manifest.initialState = {
        currentNodeId: 'ACT3_FINAL_CONFRONTATION',
        flags: {
          FACTION_A_JOINED: true,
          FACTION_LEADER_MET: true,
          FINAL_QUEST_ACCEPTED: true,
          DOOM_SEALED: false,
        },
        stats: { health: 100 },
        inventory: [{ itemId: 'ITEM_FACTION_A_ARTIFACT', quantity: 1 }],
        factions: { factionA: 80, factionB: 35, factionC: 35 },
      };

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();
      engine.makeChoice('fight_for_victory');

      expect(engine.getGameState()?.currentNodeId).toBe('ACT3_END_VICTORY');
    });

    it('should reach sacrifice ending from critical save', () => {
      const manifest = createCriticalChoiceManifest();
      manifest.initialState = {
        currentNodeId: 'ACT3_FINAL_CONFRONTATION',
        flags: {
          SACRIFICE_PATH_UNLOCKED: true,
          LOVED_ONE_IN_DANGER: true,
          DOOM_SEALED: false,
        },
        stats: { health: 100 },
        inventory: [{ itemId: 'ITEM_SACRED_AMULET', quantity: 1 }],
        factions: { factionA: 50, factionB: 50, factionC: 50 },
      };

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();
      engine.makeChoice('sacrifice_self');

      expect(engine.getGameState()?.currentNodeId).toBe('ACT3_END_SACRIFICE');
    });

    it('should reach neutral ending from critical save', () => {
      const manifest = createCriticalChoiceManifest();
      manifest.initialState = {
        currentNodeId: 'ACT3_FINAL_CONFRONTATION',
        flags: {
          NEUTRAL_PATH_AVAILABLE: true,
          DOOM_SEALED: false,
        },
        stats: { health: 100 },
        inventory: [],
        factions: { factionA: 40, factionB: 40, factionC: 40 },
      };

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();
      engine.makeChoice('walk_away');

      expect(engine.getGameState()?.currentNodeId).toBe('ACT3_END_NEUTRAL');
    });
  });

  describe('No Flag Corruption Between Loads', () => {
    it('should not carry over flag changes between save/load cycles', () => {
      const manifest = createCriticalChoiceManifest();

      // Save point state - includes NEUTRAL_PATH_AVAILABLE for walk_away choice
      const saveState = {
        currentNodeId: 'ACT3_FINAL_CONFRONTATION',
        flags: {
          SACRIFICE_PATH_UNLOCKED: true,
          LOVED_ONE_IN_DANGER: true,
          NEUTRAL_PATH_AVAILABLE: true,
          DOOM_SEALED: false,
        },
        stats: { health: 100 },
        inventory: [{ itemId: 'ITEM_SACRED_AMULET', quantity: 1 }],
        factions: { factionA: 50, factionB: 50, factionC: 50 },
      };

      // First playthrough - sacrifice
      manifest.initialState = { ...saveState };
      const { engine: engine1 } = createTestEngine(manifest);
      engine1.startNewGame();
      engine1.makeChoice('sacrifice_self');

      const stateAfterSacrifice = engine1.getGameState();
      expect(stateAfterSacrifice?.currentNodeId).toBe('ACT3_END_SACRIFICE');

      // Second playthrough from same save - should start fresh
      manifest.initialState = { ...saveState };
      const { engine: engine2 } = createTestEngine(manifest);
      engine2.startNewGame();

      const freshState = engine2.getGameState();
      expect(freshState?.currentNodeId).toBe('ACT3_FINAL_CONFRONTATION');
      expect(freshState?.flags.DOOM_SEALED).toBe(false);

      // Can still make different choice (walk_away requires NEUTRAL_PATH_AVAILABLE)
      engine2.makeChoice('walk_away');
      expect(engine2.getGameState()?.currentNodeId).toBe('ACT3_END_NEUTRAL');
    });

    it('should not corrupt visited nodes on repeated loads', () => {
      const initialVisited = [
        'ACT1_START',
        'ACT1_FACTION_CHOICE',
        'ACT3_FINAL_CONFRONTATION',
      ];

      const state = createCriticalChoiceState();
      state.visitedNodes = [...initialVisited];

      // Multiple save/load cycles
      for (let i = 0; i < 5; i++) {
        const saved = JSON.stringify(state);
        const loaded: GameState = JSON.parse(saved);

        expect(loaded.visitedNodes.length).toBe(initialVisited.length);
        expect(loaded.visitedNodes).toEqual(initialVisited);
      }
    });

    it('should maintain inventory integrity across rapid save/load', () => {
      const state = createCriticalChoiceState();

      for (let i = 0; i < 10; i++) {
        const saved = JSON.stringify(state);
        const loaded: GameState = JSON.parse(saved);

        expect(loaded.inventory.length).toBe(2);
        expect(loaded.inventory).toContainEqual({
          itemId: 'ITEM_FACTION_A_ARTIFACT',
          quantity: 1,
        });
        expect(loaded.inventory).toContainEqual({
          itemId: 'ITEM_SACRED_AMULET',
          quantity: 1,
        });
      }
    });
  });

  describe('Engine State Consistency', () => {
    it('should trigger correct events for each ending path', () => {
      const manifest = createCriticalChoiceManifest();

      // Test victory path events
      manifest.initialState = {
        currentNodeId: 'ACT3_FINAL_CONFRONTATION',
        flags: {
          FACTION_A_JOINED: true,
          FACTION_LEADER_MET: true,
          FINAL_QUEST_ACCEPTED: true,
          DOOM_SEALED: false,
        },
        stats: { health: 100 },
        inventory: [{ itemId: 'ITEM_FACTION_A_ARTIFACT', quantity: 1 }],
        factions: { factionA: 80, factionB: 35, factionC: 35 },
      };

      const victoryEvents: GameEvent[] = [];
      const { engine: victoryEngine } = createTestEngine(manifest, {
        onEvent: (event) => victoryEvents.push(event),
      });

      victoryEngine.startNewGame();
      victoryEngine.makeChoice('fight_for_victory');

      const victoryEndEvent = victoryEvents.find((e) => e.type === 'game_ended');
      expect(victoryEndEvent).toBeDefined();
      expect(victoryEndEvent?.data?.nodeId).toBe('ACT3_END_VICTORY');

      // Test neutral path events from fresh state
      manifest.initialState = {
        currentNodeId: 'ACT3_FINAL_CONFRONTATION',
        flags: {
          NEUTRAL_PATH_AVAILABLE: true,
          DOOM_SEALED: false,
        },
        stats: { health: 100 },
        inventory: [],
        factions: { factionA: 40, factionB: 40, factionC: 40 },
      };

      const neutralEvents: GameEvent[] = [];
      const { engine: neutralEngine } = createTestEngine(manifest, {
        onEvent: (event) => neutralEvents.push(event),
      });

      neutralEngine.startNewGame();
      neutralEngine.makeChoice('walk_away');

      const neutralEndEvent = neutralEvents.find((e) => e.type === 'game_ended');
      expect(neutralEndEvent).toBeDefined();
      expect(neutralEndEvent?.data?.nodeId).toBe('ACT3_END_NEUTRAL');
    });

    it('should transition to END_GAME phase after any ending', () => {
      const manifest = createCriticalChoiceManifest();
      manifest.initialState = {
        currentNodeId: 'ACT3_FINAL_CONFRONTATION',
        flags: {
          NEUTRAL_PATH_AVAILABLE: true,
          DOOM_SEALED: false,
        },
        stats: { health: 100 },
        inventory: [],
        factions: { factionA: 40, factionB: 40, factionC: 40 },
      };

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      expect(engine.getPhase()).toBe('DISPLAY_NODE');

      engine.makeChoice('walk_away');

      expect(engine.getPhase()).toBe('END_GAME');
    });
  });
});
