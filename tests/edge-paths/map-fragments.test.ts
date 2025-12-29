/**
 * Edge Case 6: Map Fragment Unlocks
 *
 * Tests that map fragments correctly unlock their respective hidden areas,
 * and that locked states are properly indicated without softlocks.
 *
 * @see /docs/QA.md - Edge Case 6: Map Fragment Unlocks
 */

import { describe, it, expect } from 'vitest';
import {
  createMapFragmentState,
  createMapFragmentManifest,
  createTestEngine,
  createTestManifest,
} from './setup';

describe('Edge Case 6: Map Fragment Unlocks', () => {
  describe('Fragment 1 Unlocks', () => {
    it('should unlock hidden path with fragment 1', () => {
      const state = createMapFragmentState([1]);

      expect(state.inventory).toContainEqual({
        itemId: 'ITEM_MAP_FRAGMENT_1',
        quantity: 1,
      });
      expect(state.flags.HIDDEN_PATH_1_UNLOCKED).toBe(true);
    });

    it('should position player at hidden path when fragment 1 collected', () => {
      const state = createMapFragmentState([1]);

      expect(state.currentNodeId).toBe('ACT2_HIDDEN_PATH');
    });

    it('should block hidden path without fragment 1', () => {
      const state = createMapFragmentState([]);

      expect(state.inventory.length).toBe(0);
      expect(state.flags.HIDDEN_PATH_1_UNLOCKED).toBeFalsy();
      expect(state.currentNodeId).toBe('ACT2_BLOCKED_PATH');
    });
  });

  describe('Fragment 2 Unlocks', () => {
    it('should unlock secret entrance with fragment 2', () => {
      const state = createMapFragmentState([2]);

      expect(state.inventory).toContainEqual({
        itemId: 'ITEM_MAP_FRAGMENT_2',
        quantity: 1,
      });
      expect(state.flags.HIDDEN_PATH_2_UNLOCKED).toBe(true);
    });

    it('should require both fragments for full secret access', () => {
      const state = createMapFragmentState([1, 2]);

      expect(state.inventory).toContainEqual({
        itemId: 'ITEM_MAP_FRAGMENT_1',
        quantity: 1,
      });
      expect(state.inventory).toContainEqual({
        itemId: 'ITEM_MAP_FRAGMENT_2',
        quantity: 1,
      });
      expect(state.flags.HIDDEN_PATH_1_UNLOCKED).toBe(true);
      expect(state.flags.HIDDEN_PATH_2_UNLOCKED).toBe(true);
      expect(state.currentNodeId).toBe('ACT3_SECRET_ENTRANCE');
    });
  });

  describe('Engine Integration', () => {
    it('should show hidden path choice when fragment 1 is present', () => {
      const manifest = createMapFragmentManifest();
      manifest.initialState!.inventory = [
        { itemId: 'ITEM_MAP_FRAGMENT_1', quantity: 1 },
      ];

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      const choices = engine.getAvailableChoices();
      const choiceIds = choices.map((c) => c.id);

      expect(choiceIds).toContain('hidden_path');
      expect(choiceIds).not.toContain('blocked_notice');
      expect(choiceIds).toContain('main_path');
    });

    it('should show blocked notice when fragment 1 is missing', () => {
      const manifest = createMapFragmentManifest();
      manifest.initialState!.inventory = [];

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      const choices = engine.getAvailableChoices();
      const choiceIds = choices.map((c) => c.id);

      expect(choiceIds).not.toContain('hidden_path');
      expect(choiceIds).toContain('blocked_notice');
      expect(choiceIds).toContain('main_path');
    });

    it('should allow main path regardless of fragment status', () => {
      // Without fragments
      const manifest1 = createMapFragmentManifest();
      manifest1.initialState!.inventory = [];

      const { engine: engine1 } = createTestEngine(manifest1);
      engine1.startNewGame();

      let choices = engine1.getAvailableChoices();
      expect(choices.find((c) => c.id === 'main_path')).toBeDefined();

      // With fragments
      const manifest2 = createMapFragmentManifest();
      manifest2.initialState!.inventory = [
        { itemId: 'ITEM_MAP_FRAGMENT_1', quantity: 1 },
        { itemId: 'ITEM_MAP_FRAGMENT_2', quantity: 1 },
      ];

      const { engine: engine2 } = createTestEngine(manifest2);
      engine2.startNewGame();

      choices = engine2.getAvailableChoices();
      expect(choices.find((c) => c.id === 'main_path')).toBeDefined();
    });
  });

  describe('No Softlock Guarantee', () => {
    it('should always have at least one valid path forward', () => {
      const manifest = createMapFragmentManifest();

      // Test without any fragments
      manifest.initialState!.inventory = [];
      const { engine: engine1 } = createTestEngine(manifest);
      engine1.startNewGame();

      let choices = engine1.getAvailableChoices();
      expect(choices.length).toBeGreaterThan(0);

      // Test with fragment 1 only
      manifest.initialState!.inventory = [
        { itemId: 'ITEM_MAP_FRAGMENT_1', quantity: 1 },
      ];
      const { engine: engine2 } = createTestEngine(manifest);
      engine2.startNewGame();

      choices = engine2.getAvailableChoices();
      expect(choices.length).toBeGreaterThan(0);

      // Test with both fragments
      manifest.initialState!.inventory = [
        { itemId: 'ITEM_MAP_FRAGMENT_1', quantity: 1 },
        { itemId: 'ITEM_MAP_FRAGMENT_2', quantity: 1 },
      ];
      const { engine: engine3 } = createTestEngine(manifest);
      engine3.startNewGame();

      choices = engine3.getAvailableChoices();
      expect(choices.length).toBeGreaterThan(0);
    });

    it('should complete game without collecting any fragments', () => {
      // Create a minimal manifest that allows completion without fragments
      const manifest = createTestManifest({
        nodes: [
          {
            id: 'START',
            title: 'Start',
            body: 'Beginning.',
            choices: [
              {
                id: 'skip_exploration',
                text: 'Skip exploration',
                targetId: 'ACT_END',
              },
            ],
          },
          {
            id: 'ACT_END',
            title: 'Act End',
            body: 'End of act.',
            choices: [
              {
                id: 'proceed',
                text: 'Continue',
                targetId: 'ENDING',
              },
            ],
          },
          {
            id: 'ENDING',
            title: 'Ending',
            body: 'The End.',
            choices: [],
            tags: ['ending'],
          },
        ],
        initialState: {
          currentNodeId: 'START',
          flags: {},
          stats: { health: 100 },
          inventory: [], // No fragments
          factions: { factionA: 50, factionB: 50, factionC: 50 },
        },
      });

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      // Should be able to skip exploration
      engine.makeChoice('skip_exploration');
      expect(engine.getGameState()?.currentNodeId).toBe('ACT_END');

      // Should be able to reach ending
      engine.makeChoice('proceed');
      expect(engine.getGameState()?.currentNodeId).toBe('ENDING');
    });
  });

  describe('Fragment Collection Tracking', () => {
    it('should track fragment collection in visited nodes', () => {
      const state = createMapFragmentState([1]);

      expect(state.visitedNodes).toContain('ACT1_EXPLORE_1');
    });

    it('should track second fragment in visited nodes', () => {
      const state = createMapFragmentState([1, 2]);

      expect(state.visitedNodes).toContain('ACT1_EXPLORE_1');
      expect(state.visitedNodes).toContain('ACT2_EXPLORE_2');
    });

    it('should not have exploration nodes if fragments not collected', () => {
      const state = createMapFragmentState([]);

      expect(state.visitedNodes).not.toContain('ACT1_EXPLORE_1');
      expect(state.visitedNodes).not.toContain('ACT2_EXPLORE_2');
    });
  });

  describe('Item-Gated Progressive Unlocks', () => {
    it('should require fragment 1 before accessing fragment 2 area', () => {
      const manifest = createTestManifest({
        nodes: [
          {
            id: 'ACT2_CROSSROADS',
            title: 'Crossroads',
            body: 'Multiple paths.',
            choices: [
              {
                id: 'to_secret_entrance',
                text: 'Enter secret passage',
                targetId: 'ACT3_SECRET_ENTRANCE',
                conditions: [
                  { type: 'item', itemId: 'ITEM_MAP_FRAGMENT_1', operator: 'has' },
                  { type: 'item', itemId: 'ITEM_MAP_FRAGMENT_2', operator: 'has' },
                ],
              },
              {
                id: 'to_hidden_path',
                text: 'Take hidden path',
                targetId: 'ACT2_HIDDEN_PATH',
                conditions: [
                  { type: 'item', itemId: 'ITEM_MAP_FRAGMENT_1', operator: 'has' },
                ],
              },
              {
                id: 'to_main',
                text: 'Main path',
                targetId: 'ACT2_MAIN',
              },
            ],
          },
          {
            id: 'ACT2_HIDDEN_PATH',
            title: 'Hidden Path',
            body: 'A secret way.',
            choices: [],
          },
          {
            id: 'ACT3_SECRET_ENTRANCE',
            title: 'Secret Entrance',
            body: 'The ultimate secret.',
            choices: [],
          },
          {
            id: 'ACT2_MAIN',
            title: 'Main Path',
            body: 'Normal route.',
            choices: [],
          },
        ],
        initialState: {
          currentNodeId: 'ACT2_CROSSROADS',
          flags: {},
          stats: { health: 100 },
          inventory: [{ itemId: 'ITEM_MAP_FRAGMENT_1', quantity: 1 }], // Only fragment 1
          factions: { factionA: 50, factionB: 50, factionC: 50 },
        },
      });

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      const choices = engine.getAvailableChoices();
      const choiceIds = choices.map((c) => c.id);

      // Hidden path available (has fragment 1)
      expect(choiceIds).toContain('to_hidden_path');

      // Secret entrance not available (missing fragment 2)
      expect(choiceIds).not.toContain('to_secret_entrance');

      // Main always available
      expect(choiceIds).toContain('to_main');
    });
  });
});
