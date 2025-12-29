/**
 * Golden Path 1: Victory Ending Tests
 *
 * Tests the faction-aligned victory path through the game.
 * Prerequisites per QA.md:
 * - Faction alignment ≥ 75 with chosen faction
 * - Flags: FACTION_LEADER_MET, FINAL_QUEST_ACCEPTED
 * - Items: Faction artifact
 * - Allies: At least 2 faction-aligned allies alive
 *
 * @see /docs/QA.md - Golden Path 1: Victory (Faction-Aligned)
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createVictoryPathState,
  createInitialState,
  assertEndingReachable,
  createTestManifest,
  createTestEngine,
  GameEvent,
} from '../setup';
import act3Content from '../../src/content/act3-sample.json';

describe('Golden Path 1: Victory Ending', () => {
  describe('State Prerequisites', () => {
    it('should create valid victory path state for Faction A', () => {
      const state = createVictoryPathState('A');

      expect(state.flags.FACTION_A_JOINED).toBe(true);
      expect(state.flags.FACTION_LEADER_MET).toBe(true);
      expect(state.flags.FINAL_QUEST_ACCEPTED).toBe(true);
      expect(state.factions.factionA).toBeGreaterThanOrEqual(75);
      expect(state.inventory).toContainEqual({
        itemId: 'ITEM_FACTION_A_ARTIFACT',
        quantity: 1,
      });
    });

    it('should create valid victory path state for Faction B', () => {
      const state = createVictoryPathState('B');

      expect(state.flags.FACTION_B_JOINED).toBe(true);
      expect(state.factions.factionB).toBeGreaterThanOrEqual(75);
      expect(state.inventory).toContainEqual({
        itemId: 'ITEM_FACTION_B_ARTIFACT',
        quantity: 1,
      });
    });

    it('should create valid victory path state for Faction C', () => {
      const state = createVictoryPathState('C');

      expect(state.flags.FACTION_C_JOINED).toBe(true);
      expect(state.factions.factionC).toBeGreaterThanOrEqual(75);
      expect(state.inventory).toContainEqual({
        itemId: 'ITEM_FACTION_C_ARTIFACT',
        quantity: 1,
      });
    });

    it('should have at least 2 allies alive', () => {
      const state = createVictoryPathState();

      const aliveCount = [
        state.flags.ALLY_MARCUS_ALIVE,
        state.flags.ALLY_ELENA_ALIVE,
        state.flags.ALLY_THORNE_ALIVE,
      ].filter(Boolean).length;

      expect(aliveCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Ending Reachability', () => {
    it('should satisfy victory ending requirements', () => {
      const state = createVictoryPathState();
      assertEndingReachable(state, 'victory');
    });

    it('should not reach victory without faction artifact', () => {
      const state = createVictoryPathState();
      state.inventory = [];

      expect(() => assertEndingReachable(state, 'victory')).toThrow();
    });

    it('should not reach victory with faction alignment < 75', () => {
      const state = createVictoryPathState();
      state.factions.factionA = 74;
      state.factions.factionB = 40;
      state.factions.factionC = 40;

      expect(() => assertEndingReachable(state, 'victory')).toThrow();
    });
  });

  describe('Critical Path Nodes', () => {
    it('should have visited required Act 1 nodes', () => {
      const state = createVictoryPathState();

      expect(state.visitedNodes).toContain('ACT1_START');
      expect(state.visitedNodes).toContain('ACT1_FACTION_CHOICE');
      expect(state.visitedNodes).toContain('ACT1_ALLY_MARCUS');
    });

    it('should have visited required Act 2 nodes', () => {
      const state = createVictoryPathState();

      expect(state.visitedNodes).toContain('ACT2_LEADER_AUDIENCE');
      expect(state.visitedNodes).toContain('ACT2_QUEST_DECISION');
      expect(state.visitedNodes).toContain('ACT2_ACCEPT_QUEST');
    });

    it('should end at final confrontation', () => {
      const state = createVictoryPathState();

      expect(state.currentNodeId).toBe('ACT3_FINAL_CONFRONTATION');
    });
  });

  describe('Engine Integration', () => {
    it('should transition to ACT3_END_VICTORY from final confrontation', () => {
      // Create manifest with act3 content nodes
      const manifest = createTestManifest({
        nodes: act3Content.nodes,
        items: act3Content.items,
        initialState: {
          currentNodeId: 'ACT3_FINAL_CONFRONTATION',
          flags: {
            FACTION_A_JOINED: true,
            FACTION_LEADER_MET: true,
            FINAL_QUEST_ACCEPTED: true,
            ALLY_MARCUS_ALIVE: true,
            ALLY_ELENA_ALIVE: true,
          },
          stats: { health: 100 },
          inventory: [{ itemId: 'ITEM_FACTION_A_ARTIFACT', quantity: 1 }],
          factions: { factionA: 80, factionB: 40, factionC: 40 },
        },
      });

      const events: GameEvent[] = [];
      const { engine } = createTestEngine(manifest, {
        onEvent: (event) => events.push(event),
      });

      // Start the game at the final confrontation
      engine.startNewGame();

      expect(engine.getPhase()).toBe('DISPLAY_NODE');
      expect(engine.getGameState()?.currentNodeId).toBe('ACT3_FINAL_CONFRONTATION');

      // Victory choice should be available
      const choices = engine.getAvailableChoices();
      const victoryChoice = choices.find((c) => c.id === 'fight_for_victory');
      expect(victoryChoice).toBeDefined();

      // Make the victory choice - goes to intermediate battle node first
      engine.makeChoice('fight_for_victory');

      // Should transition to victory battle scene
      expect(engine.getGameState()?.currentNodeId).toBe('ACT3_VICTORY_BATTLE');

      // Complete the victory battle by delivering the final blow
      engine.makeChoice('deliver_blow');

      // Now should be at victory ending
      expect(engine.getGameState()?.currentNodeId).toBe('ACT3_END_VICTORY');
      expect(engine.getPhase()).toBe('END_GAME');
    });

    it('should display victory text correctly', () => {
      const manifest = createTestManifest({
        nodes: act3Content.nodes,
        items: act3Content.items,
        initialState: {
          currentNodeId: 'ACT3_END_VICTORY',
          flags: {},
          stats: { health: 100 },
          inventory: [],
          factions: { factionA: 50, factionB: 50, factionC: 50 },
        },
      });

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      const node = engine.getCurrentNode();
      expect(node?.title).toBe('Victory');
      expect(node?.body).toContain('THE END - VICTORY');
      expect(node?.tags).toContain('ending');
    });

    it('should trigger game_ended event after reaching ending', () => {
      const manifest = createTestManifest({
        nodes: act3Content.nodes,
        items: act3Content.items,
        initialState: {
          currentNodeId: 'ACT3_FINAL_CONFRONTATION',
          flags: {
            FACTION_A_JOINED: true,
            FACTION_LEADER_MET: true,
            FINAL_QUEST_ACCEPTED: true,
            ALLY_MARCUS_ALIVE: true,
            ALLY_ELENA_ALIVE: true,
          },
          stats: { health: 100 },
          inventory: [{ itemId: 'ITEM_FACTION_A_ARTIFACT', quantity: 1 }],
          factions: { factionA: 80, factionB: 40, factionC: 40 },
        },
      });

      const events: GameEvent[] = [];
      const { engine } = createTestEngine(manifest, {
        onEvent: (event) => events.push(event),
      });

      engine.startNewGame();
      engine.makeChoice('fight_for_victory');
      engine.makeChoice('deliver_blow');

      // Should have triggered game_ended event
      const gameEndedEvent = events.find((e) => e.type === 'game_ended');
      expect(gameEndedEvent).toBeDefined();
      expect(gameEndedEvent?.data).toHaveProperty('nodeId', 'ACT3_END_VICTORY');
    });
  });
});
