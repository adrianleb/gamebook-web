/**
 * Golden Path 2: Sacrifice Ending Tests
 *
 * Tests the sacrifice ending path through the game.
 * Prerequisites per QA.md:
 * - Flags: SACRIFICE_PATH_UNLOCKED, LOVED_ONE_IN_DANGER
 * - Items: ITEM_SACRED_AMULET
 * - Allies: At least 1 ally alive to save
 * - Choice: Select sacrifice option at final confrontation
 *
 * @see /docs/QA.md - Golden Path 2: Sacrifice
 */

import { describe, it, expect } from 'vitest';
import {
  createSacrificePathState,
  createInitialState,
  assertEndingReachable,
  createTestManifest,
  createTestEngine,
  GameEvent,
} from '../setup';
import act3Content from '../../src/content/act3-sample.json';

describe('Golden Path 2: Sacrifice Ending', () => {
  describe('State Prerequisites', () => {
    it('should create valid sacrifice path state', () => {
      const state = createSacrificePathState();

      expect(state.flags.SACRIFICE_PATH_UNLOCKED).toBe(true);
      expect(state.flags.LOVED_ONE_IN_DANGER).toBe(true);
      expect(state.inventory).toContainEqual({
        itemId: 'ITEM_SACRED_AMULET',
        quantity: 1,
      });
    });

    it('should have at least one ally alive', () => {
      const state = createSacrificePathState();

      const hasAllyAlive =
        state.flags.ALLY_MARCUS_ALIVE ||
        state.flags.ALLY_ELENA_ALIVE ||
        state.flags.ALLY_THORNE_ALIVE;

      expect(hasAllyAlive).toBe(true);
    });

    it('should have visited the shrine in Act 1', () => {
      const state = createSacrificePathState();

      expect(state.visitedNodes).toContain('ACT1_SHRINE');
    });

    it('should have received the prophecy in Act 2', () => {
      const state = createSacrificePathState();

      expect(state.visitedNodes).toContain('ACT2_PROPHECY');
    });
  });

  describe('Ending Reachability', () => {
    it('should satisfy sacrifice ending requirements', () => {
      const state = createSacrificePathState();
      assertEndingReachable(state, 'sacrifice');
    });

    it('should not reach sacrifice without Sacred Amulet', () => {
      const state = createSacrificePathState();
      state.inventory = [];

      expect(() => assertEndingReachable(state, 'sacrifice')).toThrow();
    });

    it('should not reach sacrifice without SACRIFICE_PATH_UNLOCKED', () => {
      const state = createSacrificePathState();
      state.flags.SACRIFICE_PATH_UNLOCKED = false;

      expect(() => assertEndingReachable(state, 'sacrifice')).toThrow();
    });

    it('should not reach sacrifice without LOVED_ONE_IN_DANGER', () => {
      const state = createSacrificePathState();
      state.flags.LOVED_ONE_IN_DANGER = false;

      expect(() => assertEndingReachable(state, 'sacrifice')).toThrow();
    });
  });

  describe('Critical Path Nodes', () => {
    it('should include shrine visit', () => {
      const state = createSacrificePathState();
      expect(state.visitedNodes).toContain('ACT1_SHRINE');
    });

    it('should include prophecy event', () => {
      const state = createSacrificePathState();
      expect(state.visitedNodes).toContain('ACT2_PROPHECY');
    });

    it('should include kidnapping event', () => {
      const state = createSacrificePathState();
      expect(state.visitedNodes).toContain('ACT3_KIDNAPPING');
    });
  });

  describe('Engine Integration', () => {
    it('should show sacrifice option at final confrontation', () => {
      const manifest = createTestManifest({
        nodes: act3Content.nodes,
        items: act3Content.items,
        initialState: {
          currentNodeId: 'ACT3_FINAL_CONFRONTATION',
          flags: {
            SACRIFICE_PATH_UNLOCKED: true,
            LOVED_ONE_IN_DANGER: true,
            ALLY_MARCUS_ALIVE: true,
          },
          stats: { health: 100 },
          inventory: [{ itemId: 'ITEM_SACRED_AMULET', quantity: 1 }],
          factions: { factionA: 50, factionB: 50, factionC: 50 },
        },
      });

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      const choices = engine.getAvailableChoices();
      const sacrificeChoice = choices.find((c) => c.id === 'sacrifice_self');
      expect(sacrificeChoice).toBeDefined();
      expect(sacrificeChoice?.text).toContain('Sacred Amulet');
    });

    it('should transition to ACT3_END_SACRIFICE', () => {
      const manifest = createTestManifest({
        nodes: act3Content.nodes,
        items: act3Content.items,
        initialState: {
          currentNodeId: 'ACT3_FINAL_CONFRONTATION',
          flags: {
            SACRIFICE_PATH_UNLOCKED: true,
            LOVED_ONE_IN_DANGER: true,
            ALLY_MARCUS_ALIVE: true,
          },
          stats: { health: 100 },
          inventory: [{ itemId: 'ITEM_SACRED_AMULET', quantity: 1 }],
          factions: { factionA: 50, factionB: 50, factionC: 50 },
        },
      });

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();
      engine.makeChoice('sacrifice_self');

      expect(engine.getGameState()?.currentNodeId).toBe('ACT3_END_SACRIFICE');
      expect(engine.getPhase()).toBe('END_GAME');
    });

    it('should display sacrifice ending text correctly', () => {
      const manifest = createTestManifest({
        nodes: act3Content.nodes,
        items: act3Content.items,
        initialState: {
          currentNodeId: 'ACT3_END_SACRIFICE',
          flags: {},
          stats: { health: 100 },
          inventory: [],
          factions: { factionA: 50, factionB: 50, factionC: 50 },
        },
      });

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      const node = engine.getCurrentNode();
      expect(node?.title).toContain('Sacrifice');
      expect(node?.body).toContain('END');
      expect(node?.tags).toContain('ending');
    });
  });
});
