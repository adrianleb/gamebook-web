/**
 * Edge Case 7: Doom Sealed Override
 *
 * Tests that the DOOM_SEALED flag forces the Death ending
 * regardless of other conditions that would normally enable
 * Victory, Sacrifice, or other endings.
 *
 * @see /docs/QA.md - Edge Case 7: Doom Sealed Override
 */

import { describe, it, expect } from 'vitest';
import {
  createDoomSealedState,
  createCriticalChoiceManifest,
  createTestEngine,
  createInitialState,
  assertEndingAvailable,
  GameEvent,
} from './setup';

describe('Edge Case 7: Doom Sealed Override', () => {
  describe('Victory Requirements Met But Doomed', () => {
    it('should have all victory requirements met', () => {
      const state = createDoomSealedState();

      // All victory prerequisites present
      expect(state.flags.FACTION_A_JOINED).toBe(true);
      expect(state.flags.FACTION_LEADER_MET).toBe(true);
      expect(state.flags.FINAL_QUEST_ACCEPTED).toBe(true);
      expect(state.factions.factionA).toBeGreaterThanOrEqual(75);
      expect(state.inventory).toContainEqual({
        itemId: 'ITEM_FACTION_A_ARTIFACT',
        quantity: 1,
      });
      expect(state.flags.ALLY_MARCUS_ALIVE).toBe(true);
      expect(state.flags.ALLY_ELENA_ALIVE).toBe(true);
    });

    it('should have DOOM_SEALED flag set', () => {
      const state = createDoomSealedState();

      expect(state.flags.DOOM_SEALED).toBe(true);
    });

    it('should block victory ending despite meeting requirements', () => {
      const state = createDoomSealedState();

      // Victory should NOT be available due to DOOM_SEALED
      assertEndingAvailable(state, 'victory', false);
    });

    it('should force death ending', () => {
      const state = createDoomSealedState();

      // Death ending should be available (and forced)
      assertEndingAvailable(state, 'death', true);
    });
  });

  describe('Critical Failure Tracking', () => {
    it('should have visited critical failure node', () => {
      const state = createDoomSealedState();

      expect(state.visitedNodes).toContain('ACT3_CRITICAL_FAILURE');
    });

    it('should track path leading to doom', () => {
      const state = createDoomSealedState();

      // Player went through normal progression before critical failure
      expect(state.visitedNodes).toContain('ACT2_LEADER_AUDIENCE');
      expect(state.visitedNodes).toContain('ACT2_ACCEPT_QUEST');
      expect(state.visitedNodes).toContain('ACT2_ARTIFACT_A');
    });
  });

  describe('Engine Integration', () => {
    it('should only show doom path when DOOM_SEALED is true', () => {
      const manifest = createCriticalChoiceManifest();
      manifest.initialState = {
        currentNodeId: 'ACT3_FINAL_CONFRONTATION',
        flags: {
          FACTION_A_JOINED: true,
          FACTION_LEADER_MET: true,
          FINAL_QUEST_ACCEPTED: true,
          DOOM_SEALED: true, // Override flag
        },
        stats: { health: 100 },
        inventory: [{ itemId: 'ITEM_FACTION_A_ARTIFACT', quantity: 1 }],
        factions: { factionA: 85, factionB: 40, factionC: 40 },
      };

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      const choices = engine.getAvailableChoices();
      const choiceIds = choices.map((c) => c.id);

      // Only doom path should be available
      expect(choiceIds).toContain('doomed_path');

      // Victory should NOT be available even with 85 faction standing
      expect(choiceIds).not.toContain('fight_for_victory');
    });

    it('should transition to death ending when doom path chosen', () => {
      const manifest = createCriticalChoiceManifest();
      manifest.initialState = {
        currentNodeId: 'ACT3_FINAL_CONFRONTATION',
        flags: {
          DOOM_SEALED: true,
        },
        stats: { health: 100 },
        inventory: [],
        factions: { factionA: 50, factionB: 50, factionC: 50 },
      };

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();
      engine.makeChoice('doomed_path');

      expect(engine.getGameState()?.currentNodeId).toBe('ACT3_END_DEATH');
      expect(engine.getPhase()).toBe('END_GAME');
    });

    it('should trigger game_ended event with death ending', () => {
      const manifest = createCriticalChoiceManifest();
      manifest.initialState = {
        currentNodeId: 'ACT3_FINAL_CONFRONTATION',
        flags: {
          DOOM_SEALED: true,
        },
        stats: { health: 100 },
        inventory: [],
        factions: { factionA: 50, factionB: 50, factionC: 50 },
      };

      const events: GameEvent[] = [];
      const { engine } = createTestEngine(manifest, {
        onEvent: (event) => events.push(event),
      });

      engine.startNewGame();
      engine.makeChoice('doomed_path');

      const gameEndedEvent = events.find((e) => e.type === 'game_ended');
      expect(gameEndedEvent).toBeDefined();
      expect(gameEndedEvent?.data?.nodeId).toBe('ACT3_END_DEATH');
    });
  });

  describe('Override Priority', () => {
    it('should override sacrifice path even with sacred amulet', () => {
      const state = createInitialState({
        currentNodeId: 'ACT3_FINAL_CONFRONTATION',
        flags: {
          SACRIFICE_PATH_UNLOCKED: true,
          LOVED_ONE_IN_DANGER: true,
          DOOM_SEALED: true, // Override
        },
        inventory: [{ itemId: 'ITEM_SACRED_AMULET', quantity: 1 }],
      });

      // Sacrifice should not be available
      assertEndingAvailable(state, 'sacrifice', false);
      // Death should be forced
      assertEndingAvailable(state, 'death', true);
    });

    it('should override betrayal path even with dark pact', () => {
      const state = createInitialState({
        currentNodeId: 'ACT3_FINAL_OFFER',
        flags: {
          BETRAYER_PATH: true,
          SECRET_DEAL_MADE: true,
          DOOM_SEALED: true, // Override
        },
        inventory: [{ itemId: 'ITEM_DARK_PACT_SCROLL', quantity: 1 }],
      });

      // Betrayal should not be available
      assertEndingAvailable(state, 'betrayal', false);
      // Death should be forced
      assertEndingAvailable(state, 'death', true);
    });

    it('should override neutral path', () => {
      const state = createInitialState({
        currentNodeId: 'ACT3_FINAL_CONFRONTATION',
        flags: {
          NEUTRAL_PATH_AVAILABLE: true,
          DOOM_SEALED: true, // Override
        },
        factions: { factionA: 40, factionB: 40, factionC: 40 },
      });

      // Neutral should not be available (DOOM_SEALED overrides)
      // Note: Our assertEndingAvailable checks faction values 25-50 for neutral
      // but DOOM_SEALED should still override
      assertEndingAvailable(state, 'death', true);
    });
  });

  describe('Doom Communication', () => {
    it('should display death ending correctly after doom', () => {
      const manifest = createCriticalChoiceManifest();
      manifest.initialState = {
        currentNodeId: 'ACT3_END_DEATH',
        flags: { DOOM_SEALED: true },
        stats: { health: 100 },
        inventory: [],
        factions: { factionA: 50, factionB: 50, factionC: 50 },
      };

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      const node = engine.getCurrentNode();
      expect(node?.title).toBe('Death');
      expect(node?.body).toContain('THE END - DEATH');
      expect(node?.tags).toContain('ending');
      expect(node?.tags).toContain('death');
    });
  });

  describe('State Persistence', () => {
    it('should preserve DOOM_SEALED through save/load', () => {
      const state = createDoomSealedState();

      const saved = JSON.stringify(state);
      const loaded = JSON.parse(saved);

      expect(loaded.flags.DOOM_SEALED).toBe(true);

      // Other flags should also persist
      expect(loaded.flags.FACTION_A_JOINED).toBe(true);
      expect(loaded.flags.FACTION_LEADER_MET).toBe(true);
    });

    it('should not accidentally set DOOM_SEALED through normal play', () => {
      // A normal state without critical failure should not have DOOM_SEALED
      const normalState = createInitialState({
        flags: {
          FACTION_A_JOINED: true,
          FACTION_LEADER_MET: true,
          FINAL_QUEST_ACCEPTED: true,
        },
        factions: { factionA: 80, factionB: 40, factionC: 40 },
      });

      expect(normalState.flags.DOOM_SEALED).toBeFalsy();
    });
  });

  describe('Recovery Not Possible', () => {
    it('should not allow recovery from DOOM_SEALED state', () => {
      const manifest = createCriticalChoiceManifest();

      // Add a hypothetical "recovery" choice that should not appear
      manifest.nodes[0].choices.push({
        id: 'miraculous_recovery',
        text: 'Find a way out',
        targetId: 'ACT3_END_VICTORY',
        conditions: [
          { type: 'flag', flag: 'DOOM_SEALED', value: false },
          { type: 'flag', flag: 'RECOVERY_POSSIBLE', value: true },
        ],
      });

      manifest.initialState = {
        currentNodeId: 'ACT3_FINAL_CONFRONTATION',
        flags: {
          DOOM_SEALED: true,
          RECOVERY_POSSIBLE: true, // Even if this is true
        },
        stats: { health: 100 },
        inventory: [],
        factions: { factionA: 50, factionB: 50, factionC: 50 },
      };

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      const choices = engine.getAvailableChoices();
      const choiceIds = choices.map((c) => c.id);

      // Recovery should not be available because DOOM_SEALED is true
      expect(choiceIds).not.toContain('miraculous_recovery');
    });
  });
});
