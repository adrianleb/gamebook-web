/**
 * Golden Path 4: Neutral Ending Tests
 *
 * Tests the neutral "walk away" ending path through the game.
 * Prerequisites per QA.md:
 * - Faction: Alignment 25-50 with all factions
 * - Flags: NEUTRAL_PATH_AVAILABLE (auto-set if no faction ≥50)
 * - Items: None required
 * - Allies: None required
 *
 * @see /docs/QA.md - Golden Path 4: Neutral
 */

import { describe, it, expect } from 'vitest';
import {
  createNeutralPathState,
  createInitialState,
  assertEndingReachable,
  createTestManifest,
  createTestEngine,
  GameEvent,
} from '../setup';
import act3Content from '../../src/content/act3-sample.json';

describe('Golden Path 4: Neutral Ending', () => {
  describe('State Prerequisites', () => {
    it('should create valid neutral path state', () => {
      const state = createNeutralPathState();

      expect(state.flags.NEUTRAL_PATH_AVAILABLE).toBe(true);
      expect(state.factions.factionA).toBeGreaterThanOrEqual(25);
      expect(state.factions.factionA).toBeLessThanOrEqual(50);
      expect(state.factions.factionB).toBeGreaterThanOrEqual(25);
      expect(state.factions.factionB).toBeLessThanOrEqual(50);
      expect(state.factions.factionC).toBeGreaterThanOrEqual(25);
      expect(state.factions.factionC).toBeLessThanOrEqual(50);
    });

    it('should have no specific item requirements', () => {
      const state = createNeutralPathState();
      // Neutral path has no required items
      expect(state.inventory).toHaveLength(0);
    });

    it('should have refused the quest', () => {
      const state = createNeutralPathState();
      expect(state.visitedNodes).toContain('ACT2_REFUSE_QUEST');
    });
  });

  describe('Ending Reachability', () => {
    it('should satisfy neutral ending requirements', () => {
      const state = createNeutralPathState();
      assertEndingReachable(state, 'neutral');
    });

    it('should not reach neutral if any faction >= 51', () => {
      const state = createNeutralPathState();
      state.factions.factionA = 51;

      expect(() => assertEndingReachable(state, 'neutral')).toThrow();
    });

    it('should not reach neutral if any faction < 25', () => {
      const state = createNeutralPathState();
      state.factions.factionB = 24;

      expect(() => assertEndingReachable(state, 'neutral')).toThrow();
    });
  });

  describe('Faction Boundary Values', () => {
    // Per QA.md Edge Case 5: Boundary Faction Values
    it('should accept faction value of exactly 25', () => {
      const state = createNeutralPathState();
      state.factions.factionA = 25;
      state.factions.factionB = 25;
      state.factions.factionC = 25;

      assertEndingReachable(state, 'neutral');
    });

    it('should accept faction value of exactly 50', () => {
      const state = createNeutralPathState();
      state.factions.factionA = 50;
      state.factions.factionB = 50;
      state.factions.factionC = 50;

      assertEndingReachable(state, 'neutral');
    });

    it('should reject faction value of 24', () => {
      const state = createNeutralPathState();
      state.factions.factionA = 24;

      expect(() => assertEndingReachable(state, 'neutral')).toThrow();
    });

    it('should reject faction value of 51', () => {
      const state = createNeutralPathState();
      state.factions.factionA = 51;

      expect(() => assertEndingReachable(state, 'neutral')).toThrow();
    });
  });

  describe('Critical Path Nodes', () => {
    it('should end at final confrontation', () => {
      const state = createNeutralPathState();
      expect(state.currentNodeId).toBe('ACT3_FINAL_CONFRONTATION');
    });

    it('should have minimal path through acts', () => {
      const state = createNeutralPathState();
      expect(state.visitedNodes).toContain('ACT1_START');
      expect(state.visitedNodes).toContain('ACT1_ACT_END');
      expect(state.visitedNodes).toContain('ACT2_ACT_END');
    });
  });

  describe('Engine Integration', () => {
    it('should show "walk away" option at final confrontation', () => {
      const manifest = createTestManifest({
        nodes: act3Content.nodes,
        items: act3Content.items,
        initialState: {
          currentNodeId: 'ACT3_FINAL_CONFRONTATION',
          flags: {
            NEUTRAL_PATH_AVAILABLE: true,
          },
          stats: { health: 100 },
          inventory: [],
          factions: { factionA: 35, factionB: 40, factionC: 38 },
        },
      });

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      const choices = engine.getAvailableChoices();
      const walkAwayChoice = choices.find((c) => c.id === 'walk_away');
      expect(walkAwayChoice).toBeDefined();
      expect(walkAwayChoice?.text).toContain('leaving');
    });

    it('should transition to ACT3_END_NEUTRAL', () => {
      const manifest = createTestManifest({
        nodes: act3Content.nodes,
        items: act3Content.items,
        initialState: {
          currentNodeId: 'ACT3_FINAL_CONFRONTATION',
          flags: {
            NEUTRAL_PATH_AVAILABLE: true,
          },
          stats: { health: 100 },
          inventory: [],
          factions: { factionA: 35, factionB: 40, factionC: 38 },
        },
      });

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();
      engine.makeChoice('walk_away');

      // Should transition to walk away scene first
      expect(engine.getGameState()?.currentNodeId).toBe('ACT3_WALK_AWAY_SCENE');

      // Complete the walk away scene
      engine.makeChoice('leave_finally');

      expect(engine.getGameState()?.currentNodeId).toBe('ACT3_END_NEUTRAL');
      expect(engine.getPhase()).toBe('END_GAME');
    });

    it('should display neutral ending text correctly', () => {
      const manifest = createTestManifest({
        nodes: act3Content.nodes,
        items: act3Content.items,
        initialState: {
          currentNodeId: 'ACT3_END_NEUTRAL',
          flags: {},
          stats: { health: 100 },
          inventory: [],
          factions: { factionA: 50, factionB: 50, factionC: 50 },
        },
      });

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      const node = engine.getCurrentNode();
      expect(node?.title).toBe('Walking Away');
      expect(node?.body).toContain('THE END - NEUTRAL');
      expect(node?.tags).toContain('ending');
    });
  });
});
