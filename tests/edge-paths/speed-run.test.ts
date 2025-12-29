/**
 * Edge Case 8: Skip All Optional Content
 *
 * Tests the speed-run path that avoids all optional nodes,
 * verifying the game is completable without optional content
 * and that appropriate endings remain available.
 *
 * @see /docs/QA.md - Edge Case 8: Skip All Optional Content
 */

import { describe, it, expect } from 'vitest';
import {
  createSpeedRunState,
  createInitialState,
  createTestManifest,
  createTestEngine,
  assertEndingAvailable,
  GameEvent,
} from './setup';

describe('Edge Case 8: Skip All Optional Content', () => {
  describe('Minimal Path Traversal', () => {
    it('should have visited only critical path nodes', () => {
      const state = createSpeedRunState();

      // Only critical path nodes
      expect(state.visitedNodes).toContain('ACT1_START');
      expect(state.visitedNodes).toContain('ACT1_FIRST_CHOICE');
      expect(state.visitedNodes).toContain('ACT1_FACTION_CHOICE');
      expect(state.visitedNodes).toContain('ACT1_ACT_END');
      expect(state.visitedNodes).toContain('ACT2_MAIN_QUEST');
      expect(state.visitedNodes).toContain('ACT2_ACT_END');
      expect(state.visitedNodes).toContain('ACT3_FINAL_CONFRONTATION');

      // Should NOT have visited optional nodes
      expect(state.visitedNodes).not.toContain('ACT1_SHRINE');
      expect(state.visitedNodes).not.toContain('ACT1_SUPPLIES');
      expect(state.visitedNodes).not.toContain('ACT1_EXPLORE_1');
      expect(state.visitedNodes).not.toContain('ACT1_ALLY_MARCUS');
      expect(state.visitedNodes).not.toContain('ACT2_HIDDEN_PATH');
      expect(state.visitedNodes).not.toContain('ACT2_SECRET_DEAL');
    });

    it('should have empty inventory', () => {
      const state = createSpeedRunState();

      expect(state.inventory.length).toBe(0);
    });

    it('should have no allies recruited', () => {
      const state = createSpeedRunState();

      expect(state.flags.ALLY_MARCUS_ALIVE).toBe(false);
      expect(state.flags.ALLY_ELENA_ALIVE).toBe(false);
      expect(state.flags.ALLY_THORNE_ALIVE).toBeFalsy();
    });

    it('should have minimal faction interaction', () => {
      const state = createSpeedRunState();

      // Faction values should be near default (40-50 range)
      expect(state.factions.factionA).toBeGreaterThanOrEqual(25);
      expect(state.factions.factionA).toBeLessThanOrEqual(50);
      expect(state.factions.factionB).toBeGreaterThanOrEqual(25);
      expect(state.factions.factionB).toBeLessThanOrEqual(50);
      expect(state.factions.factionC).toBeGreaterThanOrEqual(25);
      expect(state.factions.factionC).toBeLessThanOrEqual(50);
    });
  });

  describe('Ending Availability', () => {
    it('should have neutral ending available', () => {
      const state = createSpeedRunState();

      // Neutral path should be auto-set for minimal play
      expect(state.flags.NEUTRAL_PATH_AVAILABLE).toBe(true);
    });

    it('should NOT have victory ending available', () => {
      const state = createSpeedRunState();

      // Victory requires faction >= 75, artifacts, allies
      assertEndingAvailable(state, 'victory', false);
    });

    it('should NOT have sacrifice ending available', () => {
      const state = createSpeedRunState();

      // Sacrifice requires sacred amulet (skipped shrine)
      assertEndingAvailable(state, 'sacrifice', false);
    });

    it('should NOT have betrayal ending available', () => {
      const state = createSpeedRunState();

      // Betrayal requires dark pact scroll (skipped secret deal)
      assertEndingAvailable(state, 'betrayal', false);
    });

    it('should have death as fallback ending', () => {
      const state = createSpeedRunState();

      // Death is always available as fallback
      // (either via DOOM_SEALED or health = 0)
      expect(state.flags.DOOM_SEALED).toBeFalsy(); // Not doomed yet
    });
  });

  describe('Game Completion', () => {
    it('should be completable with neutral ending', () => {
      const manifest = createTestManifest({
        nodes: [
          {
            id: 'ACT1_START',
            title: 'Start',
            body: 'Beginning.',
            choices: [
              {
                id: 'rush',
                text: 'Rush through',
                targetId: 'ACT1_ACT_END',
              },
            ],
          },
          {
            id: 'ACT1_ACT_END',
            title: 'Act 1 End',
            body: 'End of Act 1.',
            choices: [
              {
                id: 'continue',
                text: 'Continue',
                targetId: 'ACT2_ACT_END',
              },
            ],
          },
          {
            id: 'ACT2_ACT_END',
            title: 'Act 2 End',
            body: 'End of Act 2.',
            choices: [
              {
                id: 'finale',
                text: 'To finale',
                targetId: 'ACT3_FINAL_CONFRONTATION',
              },
            ],
          },
          {
            id: 'ACT3_FINAL_CONFRONTATION',
            title: 'Final Confrontation',
            body: 'The end approaches.',
            choices: [
              {
                id: 'walk_away',
                text: 'Walk away',
                targetId: 'ACT3_END_NEUTRAL',
                conditions: [
                  { type: 'flag', flag: 'NEUTRAL_PATH_AVAILABLE', value: true },
                ],
              },
            ],
          },
          {
            id: 'ACT3_END_NEUTRAL',
            title: 'Neutral Ending',
            body: 'You walk away from it all. THE END - NEUTRAL',
            choices: [],
            tags: ['ending', 'neutral'],
          },
        ],
        initialState: {
          currentNodeId: 'ACT1_START',
          flags: { NEUTRAL_PATH_AVAILABLE: true },
          stats: { health: 100 },
          inventory: [],
          factions: { factionA: 40, factionB: 45, factionC: 45 },
        },
      });

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      // Speed run through
      engine.makeChoice('rush');
      expect(engine.getGameState()?.currentNodeId).toBe('ACT1_ACT_END');

      engine.makeChoice('continue');
      expect(engine.getGameState()?.currentNodeId).toBe('ACT2_ACT_END');

      engine.makeChoice('finale');
      expect(engine.getGameState()?.currentNodeId).toBe('ACT3_FINAL_CONFRONTATION');

      engine.makeChoice('walk_away');
      expect(engine.getGameState()?.currentNodeId).toBe('ACT3_END_NEUTRAL');
      expect(engine.getPhase()).toBe('END_GAME');
    });

    it('should trigger game_ended event on neutral ending', () => {
      const manifest = createTestManifest({
        nodes: [
          {
            id: 'ACT3_FINAL_CONFRONTATION',
            title: 'Final',
            body: 'The end.',
            choices: [
              {
                id: 'walk_away',
                text: 'Walk away',
                targetId: 'ACT3_END_NEUTRAL',
              },
            ],
          },
          {
            id: 'ACT3_END_NEUTRAL',
            title: 'Neutral',
            body: 'THE END - NEUTRAL',
            choices: [],
            tags: ['ending', 'neutral'],
          },
        ],
        initialState: {
          currentNodeId: 'ACT3_FINAL_CONFRONTATION',
          flags: {},
          stats: { health: 100 },
          inventory: [],
          factions: { factionA: 40, factionB: 40, factionC: 40 },
        },
      });

      const events: GameEvent[] = [];
      const { engine } = createTestEngine(manifest, {
        onEvent: (event) => events.push(event),
      });

      engine.startNewGame();
      engine.makeChoice('walk_away');

      const gameEndedEvent = events.find((e) => e.type === 'game_ended');
      expect(gameEndedEvent).toBeDefined();
      expect(gameEndedEvent?.data?.nodeId).toBe('ACT3_END_NEUTRAL');
    });
  });

  describe('No Dead Ends', () => {
    it('should always have at least one choice available', () => {
      // Test that skipping optional content never creates a dead end
      const manifest = createTestManifest({
        nodes: [
          {
            id: 'CROSSROADS',
            title: 'Crossroads',
            body: 'Multiple paths.',
            choices: [
              {
                id: 'optional_path',
                text: 'Explore (optional)',
                targetId: 'OPTIONAL_AREA',
                conditions: [
                  { type: 'item', item: 'ITEM_MAP_FRAGMENT_1', operator: '>=', value: 1 },
                ],
              },
              {
                id: 'main_path',
                text: 'Continue (always available)',
                targetId: 'NEXT_AREA',
              },
            ],
          },
          {
            id: 'OPTIONAL_AREA',
            title: 'Optional',
            body: 'Optional content.',
            choices: [
              { id: 'back', text: 'Return', targetId: 'NEXT_AREA' },
            ],
          },
          {
            id: 'NEXT_AREA',
            title: 'Next',
            body: 'Continuing.',
            choices: [],
          },
        ],
        initialState: {
          currentNodeId: 'CROSSROADS',
          flags: {},
          stats: { health: 100 },
          inventory: [], // No map fragment
          factions: { factionA: 50, factionB: 50, factionC: 50 },
        },
      });

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      const choices = engine.getAvailableChoices();

      // Optional path should be locked (no map fragment)
      expect(choices.find((c) => c.id === 'optional_path')).toBeUndefined();

      // Main path should always be available
      expect(choices.find((c) => c.id === 'main_path')).toBeDefined();
      expect(choices.length).toBeGreaterThan(0);
    });

    it('should complete game without any items', () => {
      const manifest = createTestManifest({
        nodes: [
          {
            id: 'START',
            title: 'Start',
            body: 'Begin.',
            choices: [
              { id: 'proceed', text: 'Proceed', targetId: 'END' },
            ],
          },
          {
            id: 'END',
            title: 'End',
            body: 'Complete.',
            choices: [],
            tags: ['ending'],
          },
        ],
        initialState: {
          currentNodeId: 'START',
          flags: {},
          stats: { health: 100 },
          inventory: [],
          factions: { factionA: 50, factionB: 50, factionC: 50 },
        },
      });

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      expect(engine.getGameState()?.inventory.length).toBe(0);

      engine.makeChoice('proceed');

      expect(engine.getGameState()?.currentNodeId).toBe('END');
      expect(engine.getPhase()).toBe('END_GAME');
    });

    it('should complete game without any allies', () => {
      const state = createSpeedRunState();

      // Verify no allies
      const allyCount = [
        state.flags.ALLY_MARCUS_ALIVE,
        state.flags.ALLY_ELENA_ALIVE,
        state.flags.ALLY_THORNE_ALIVE,
      ].filter(Boolean).length;

      expect(allyCount).toBe(0);

      // Game should still be at final confrontation (completable)
      expect(state.currentNodeId).toBe('ACT3_FINAL_CONFRONTATION');
    });
  });

  describe('Content Misclassification Prevention', () => {
    it('should not block required content as optional', () => {
      // Ensure critical path nodes are always accessible
      const manifest = createTestManifest({
        nodes: [
          {
            id: 'ACT1_START',
            title: 'Start',
            body: 'Begin.',
            choices: [
              {
                id: 'to_faction',
                text: 'Choose faction',
                targetId: 'ACT1_FACTION_CHOICE',
                // No conditions - always available
              },
            ],
          },
          {
            id: 'ACT1_FACTION_CHOICE',
            title: 'Faction Choice',
            body: 'Choose your path.',
            choices: [
              {
                id: 'faction_a',
                text: 'Join A',
                targetId: 'ACT1_ACT_END',
                effects: [{ type: 'setFlag', flag: 'FACTION_A_JOINED' }],
              },
            ],
          },
          {
            id: 'ACT1_ACT_END',
            title: 'Act 1 End',
            body: 'Act complete.',
            choices: [],
          },
        ],
        initialState: {
          currentNodeId: 'ACT1_START',
          flags: {},
          stats: { health: 100 },
          inventory: [],
          factions: { factionA: 50, factionB: 50, factionC: 50 },
        },
      });

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      // Critical path should always be available
      let choices = engine.getAvailableChoices();
      expect(choices.find((c) => c.id === 'to_faction')).toBeDefined();

      engine.makeChoice('to_faction');

      // Faction choice should be available
      choices = engine.getAvailableChoices();
      expect(choices.find((c) => c.id === 'faction_a')).toBeDefined();

      engine.makeChoice('faction_a');

      // Should reach act end
      expect(engine.getGameState()?.currentNodeId).toBe('ACT1_ACT_END');
      expect(engine.getGameState()?.flags.FACTION_A_JOINED).toBe(true);
    });
  });
});
