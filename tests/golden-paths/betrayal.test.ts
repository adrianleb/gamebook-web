/**
 * Golden Path 3: Betrayal Ending Tests
 *
 * Tests the betrayal ending path through the game.
 * Prerequisites per QA.md:
 * - Faction: Alignment < 25 with all factions OR BETRAYER_PATH flag
 * - Flags: SECRET_DEAL_MADE, ANTAGONIST_OFFER_ACCEPTED
 * - Items: ITEM_DARK_PACT_SCROLL
 * - Allies: All allies either dead or betrayed
 *
 * @see /docs/QA.md - Golden Path 3: Betrayal
 */

import { describe, it, expect } from 'vitest';
import {
  createBetrayalPathState,
  createInitialState,
  assertEndingReachable,
  createTestManifest,
  createTestEngine,
  GameEvent,
} from '../setup';
import act3Content from '../../src/content/act3-sample.json';

describe('Golden Path 3: Betrayal Ending', () => {
  describe('State Prerequisites', () => {
    it('should create valid betrayal path state', () => {
      const state = createBetrayalPathState();

      expect(state.flags.BETRAYER_PATH).toBe(true);
      expect(state.flags.SECRET_DEAL_MADE).toBe(true);
      expect(state.inventory).toContainEqual({
        itemId: 'ITEM_DARK_PACT_SCROLL',
        quantity: 1,
      });
    });

    it('should have all allies dead or betrayed', () => {
      const state = createBetrayalPathState();

      expect(state.flags.ALLY_MARCUS_ALIVE).toBe(false);
      expect(state.flags.ALLY_ELENA_ALIVE).toBe(false);
    });

    it('should have low faction standings', () => {
      const state = createBetrayalPathState();

      expect(state.factions.factionA).toBeLessThan(25);
      expect(state.factions.factionB).toBeLessThan(25);
      expect(state.factions.factionC).toBeLessThan(25);
    });
  });

  describe('Ending Reachability', () => {
    it('should satisfy betrayal ending requirements', () => {
      const state = createBetrayalPathState();
      assertEndingReachable(state, 'betrayal');
    });

    it('should not reach betrayal without Dark Pact Scroll', () => {
      const state = createBetrayalPathState();
      state.inventory = [];

      expect(() => assertEndingReachable(state, 'betrayal')).toThrow();
    });

    it('should not reach betrayal without BETRAYER_PATH', () => {
      const state = createBetrayalPathState();
      state.flags.BETRAYER_PATH = false;

      expect(() => assertEndingReachable(state, 'betrayal')).toThrow();
    });

    it('should not reach betrayal without SECRET_DEAL_MADE', () => {
      const state = createBetrayalPathState();
      state.flags.SECRET_DEAL_MADE = false;

      expect(() => assertEndingReachable(state, 'betrayal')).toThrow();
    });
  });

  describe('Critical Path Nodes', () => {
    it('should include Marcus leaving', () => {
      const state = createBetrayalPathState();
      expect(state.visitedNodes).toContain('ACT1_MARCUS_LEAVE');
    });

    it('should include temptation and embrace', () => {
      const state = createBetrayalPathState();
      expect(state.visitedNodes).toContain('ACT2_TEMPTATION');
      expect(state.visitedNodes).toContain('ACT2_EMBRACE');
    });

    it('should include secret deal', () => {
      const state = createBetrayalPathState();
      expect(state.visitedNodes).toContain('ACT2_SECRET_DEAL');
      expect(state.visitedNodes).toContain('ACT2_DEAL_MADE');
    });

    it('should include Elena lost', () => {
      const state = createBetrayalPathState();
      expect(state.visitedNodes).toContain('ACT2_ELENA_LOST');
    });
  });

  describe('Engine Integration', () => {
    it('should show antagonist offer at ACT3_FINAL_OFFER', () => {
      const manifest = createTestManifest({
        nodes: act3Content.nodes,
        items: act3Content.items,
        initialState: {
          currentNodeId: 'ACT3_FINAL_OFFER',
          flags: {
            BETRAYER_PATH: true,
            SECRET_DEAL_MADE: true,
          },
          stats: { health: 100 },
          inventory: [{ itemId: 'ITEM_DARK_PACT_SCROLL', quantity: 1 }],
          factions: { factionA: 20, factionB: 20, factionC: 20 },
        },
      });

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      const choices = engine.getAvailableChoices();
      const acceptChoice = choices.find((c) => c.id === 'accept_offer');
      expect(acceptChoice).toBeDefined();
      expect(acceptChoice?.tooltip).toContain('betrayal');
    });

    it('should transition to ACT3_END_BETRAYAL when offer accepted', () => {
      const manifest = createTestManifest({
        nodes: act3Content.nodes,
        items: act3Content.items,
        initialState: {
          currentNodeId: 'ACT3_FINAL_OFFER',
          flags: {
            BETRAYER_PATH: true,
            SECRET_DEAL_MADE: true,
          },
          stats: { health: 100 },
          inventory: [{ itemId: 'ITEM_DARK_PACT_SCROLL', quantity: 1 }],
          factions: { factionA: 20, factionB: 20, factionC: 20 },
        },
      });

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      // Accept the offer
      engine.makeChoice('accept_offer');
      expect(engine.getGameState()?.currentNodeId).toBe('ACT3_ACCEPT_DARKNESS');

      // Complete the betrayal
      engine.makeChoice('complete_betrayal');
      expect(engine.getGameState()?.currentNodeId).toBe('ACT3_END_BETRAYAL');
      expect(engine.getPhase()).toBe('END_GAME');
    });

    it('should display betrayal ending text correctly', () => {
      const manifest = createTestManifest({
        nodes: act3Content.nodes,
        items: act3Content.items,
        initialState: {
          currentNodeId: 'ACT3_END_BETRAYAL',
          flags: {},
          stats: { health: 100 },
          inventory: [],
          factions: { factionA: 50, factionB: 50, factionC: 50 },
        },
      });

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      const node = engine.getCurrentNode();
      expect(node?.title).toContain('Betrayal');
      expect(node?.body).toContain('END');
      expect(node?.tags).toContain('ending');
    });
  });
});
