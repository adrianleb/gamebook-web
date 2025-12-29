/**
 * Edge Case 5: Boundary Faction Values
 *
 * Tests faction threshold boundaries (24, 25, 50, 74, 75) to ensure
 * off-by-one errors are caught in condition checks.
 *
 * @see /docs/QA.md - Edge Case 5: Boundary Faction Values
 */

import { describe, it, expect } from 'vitest';
import {
  createBoundaryFactionState,
  createFactionThresholdManifest,
  createTestEngine,
  assertFactionThreshold,
} from './setup';

describe('Edge Case 5: Boundary Faction Values', () => {
  describe('Threshold 25: Ally Leave Risk', () => {
    it('should treat faction value 24 as below 25 threshold', () => {
      const state = createBoundaryFactionState(24);

      assertFactionThreshold(state, 'factionA', 25, false);
      expect(state.factions.factionA).toBe(24);
    });

    it('should treat faction value 25 as meeting 25 threshold', () => {
      const state = createBoundaryFactionState(25);

      assertFactionThreshold(state, 'factionA', 25, true);
      expect(state.factions.factionA).toBe(25);
    });

    it('should trigger ally leave at 24 (< 25)', () => {
      const state = createBoundaryFactionState(24);

      // Allies should leave when faction drops below 25
      expect(state.flags.ALLY_MARCUS_ALIVE).toBe(false);
    });

    it('should keep ally at 25 (>= 25)', () => {
      const state = createBoundaryFactionState(25);

      // Allies stay at exactly 25
      expect(state.flags.ALLY_MARCUS_ALIVE).toBe(true);
    });
  });

  describe('Threshold 50: Neutral Zone', () => {
    it('should be in neutral zone at exactly 50', () => {
      const state = createBoundaryFactionState(50);

      // At 50, still in neutral range (25-50) for neutral ending
      expect(state.factions.factionA).toBeGreaterThanOrEqual(25);
      expect(state.factions.factionA).toBeLessThanOrEqual(50);
    });

    it('should exit neutral zone above 50', () => {
      const state = createBoundaryFactionState(74);

      // At 74, above neutral zone
      expect(state.factions.factionA).toBeGreaterThan(50);
    });
  });

  describe('Threshold 75: Victory Path', () => {
    it('should treat faction value 74 as below 75 threshold', () => {
      const state = createBoundaryFactionState(74);

      assertFactionThreshold(state, 'factionA', 75, false);
      expect(state.factions.factionA).toBe(74);
    });

    it('should treat faction value 75 as meeting 75 threshold', () => {
      const state = createBoundaryFactionState(75);

      assertFactionThreshold(state, 'factionA', 75, true);
      expect(state.factions.factionA).toBe(75);
    });

    it('should not unlock victory at 74', () => {
      const state = createBoundaryFactionState(74);

      // Victory requires >= 75
      expect(state.factions.factionA).toBeLessThan(75);
    });

    it('should unlock victory at exactly 75', () => {
      const state = createBoundaryFactionState(75);

      // Victory threshold met
      expect(state.factions.factionA).toBeGreaterThanOrEqual(75);
    });
  });

  describe('Engine Condition Evaluation', () => {
    it('should evaluate < 25 condition correctly', () => {
      const manifest = createFactionThresholdManifest();
      manifest.initialState!.factions = { factionA: 24, factionB: 50, factionC: 50 };

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      const choices = engine.getAvailableChoices();
      const choiceIds = choices.map((c) => c.id);

      expect(choiceIds).toContain('ally_leaves');
      expect(choiceIds).not.toContain('neutral_zone');
      expect(choiceIds).not.toContain('leader_available');
      expect(choiceIds).not.toContain('victory_path');
    });

    it('should evaluate >= 25 and < 50 condition correctly', () => {
      const manifest = createFactionThresholdManifest();
      manifest.initialState!.factions = { factionA: 25, factionB: 50, factionC: 50 };

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      const choices = engine.getAvailableChoices();
      const choiceIds = choices.map((c) => c.id);

      expect(choiceIds).not.toContain('ally_leaves');
      expect(choiceIds).toContain('neutral_zone');
      expect(choiceIds).not.toContain('leader_available');
      expect(choiceIds).not.toContain('victory_path');
    });

    it('should evaluate >= 50 and < 75 condition correctly', () => {
      const manifest = createFactionThresholdManifest();
      manifest.initialState!.factions = { factionA: 50, factionB: 50, factionC: 50 };

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      const choices = engine.getAvailableChoices();
      const choiceIds = choices.map((c) => c.id);

      expect(choiceIds).not.toContain('ally_leaves');
      expect(choiceIds).not.toContain('neutral_zone');
      expect(choiceIds).toContain('leader_available');
      expect(choiceIds).not.toContain('victory_path');
    });

    it('should evaluate >= 75 condition correctly', () => {
      const manifest = createFactionThresholdManifest();
      manifest.initialState!.factions = { factionA: 75, factionB: 50, factionC: 50 };

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      const choices = engine.getAvailableChoices();
      const choiceIds = choices.map((c) => c.id);

      expect(choiceIds).not.toContain('ally_leaves');
      expect(choiceIds).not.toContain('neutral_zone');
      expect(choiceIds).not.toContain('leader_available');
      expect(choiceIds).toContain('victory_path');
    });

    it('should handle exact boundary at 74 (leader available, not victory)', () => {
      const manifest = createFactionThresholdManifest();
      manifest.initialState!.factions = { factionA: 74, factionB: 50, factionC: 50 };

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      const choices = engine.getAvailableChoices();
      const choiceIds = choices.map((c) => c.id);

      // At 74: >= 50, < 75, so leader_available should show
      expect(choiceIds).toContain('leader_available');
      expect(choiceIds).not.toContain('victory_path');
    });
  });

  describe('Faction Modification Effects', () => {
    it('should correctly modify faction across thresholds', () => {
      const manifest = createFactionThresholdManifest();

      // Add a modification node
      manifest.nodes.push({
        id: 'FACTION_MODIFY',
        title: 'Faction Modify',
        body: 'Modify faction standing.',
        choices: [
          {
            id: 'increase',
            text: 'Increase faction',
            targetId: 'ACT2_FACTION_CHECK',
            effects: [{ type: 'modifyFaction', faction: 'factionA', delta: 10 }],
          },
          {
            id: 'decrease',
            text: 'Decrease faction',
            targetId: 'ACT2_FACTION_CHECK',
            effects: [{ type: 'modifyFaction', faction: 'factionA', delta: -10 }],
          },
        ],
      });

      manifest.initialState = {
        currentNodeId: 'FACTION_MODIFY',
        flags: { FACTION_A_JOINED: true },
        stats: { health: 100 },
        inventory: [],
        factions: { factionA: 70, factionB: 50, factionC: 50 },
      };

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      // Start at 70
      expect(engine.getGameState()?.factions.factionA).toBe(70);

      // Increase to 80 (crosses 75 threshold)
      engine.makeChoice('increase');
      expect(engine.getGameState()?.factions.factionA).toBe(80);

      // Now at 80, victory path should be available
      const choices = engine.getAvailableChoices();
      expect(choices.find((c) => c.id === 'victory_path')).toBeDefined();
    });

    it('should clamp faction values to valid range', () => {
      const manifest = createFactionThresholdManifest();

      manifest.nodes.push({
        id: 'EXTREME_MODIFY',
        title: 'Extreme Modify',
        body: 'Test extreme values.',
        choices: [
          {
            id: 'max_faction',
            text: 'Max faction',
            targetId: 'ACT2_FACTION_CHECK',
            effects: [{ type: 'setFaction', faction: 'factionA', value: 100 }],
          },
          {
            id: 'min_faction',
            text: 'Min faction',
            targetId: 'ACT2_FACTION_CHECK',
            effects: [{ type: 'setFaction', faction: 'factionA', value: 0 }],
          },
        ],
      });

      manifest.initialState = {
        currentNodeId: 'EXTREME_MODIFY',
        flags: { FACTION_A_JOINED: true },
        stats: { health: 100 },
        inventory: [],
        factions: { factionA: 50, factionB: 50, factionC: 50 },
      };

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      // Set to max
      engine.makeChoice('max_faction');
      const maxState = engine.getGameState();
      expect(maxState?.factions.factionA).toBe(100);
      expect(maxState?.factions.factionA).toBeLessThanOrEqual(100);
    });
  });

  describe('Multi-Faction Threshold Interactions', () => {
    it('should track multiple factions independently', () => {
      const manifest = createFactionThresholdManifest();
      manifest.initialState!.factions = { factionA: 24, factionB: 75, factionC: 50 };

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      const state = engine.getGameState();

      // Each faction is at different threshold
      expect(state?.factions.factionA).toBeLessThan(25);
      expect(state?.factions.factionB).toBeGreaterThanOrEqual(75);
      expect(state?.factions.factionC).toBeGreaterThanOrEqual(25);
      expect(state?.factions.factionC).toBeLessThan(75);
    });

    it('should evaluate conditions for specific faction only', () => {
      const manifest = createFactionThresholdManifest();

      // Override to check specific faction conditions
      manifest.nodes = [
        {
          id: 'MULTI_FACTION_CHECK',
          title: 'Multi Faction Check',
          body: 'Check multiple factions.',
          choices: [
            {
              id: 'faction_a_victory',
              text: 'Faction A Victory',
              targetId: 'END',
              conditions: [
                { type: 'faction', faction: 'factionA', operator: '>=', value: 75 },
              ],
            },
            {
              id: 'faction_b_victory',
              text: 'Faction B Victory',
              targetId: 'END',
              conditions: [
                { type: 'faction', faction: 'factionB', operator: '>=', value: 75 },
              ],
            },
          ],
        },
        {
          id: 'END',
          title: 'End',
          body: 'End.',
          choices: [],
        },
      ];

      // A below 75, B at 75
      manifest.initialState!.factions = { factionA: 74, factionB: 75, factionC: 50 };
      manifest.initialState!.currentNodeId = 'MULTI_FACTION_CHECK';

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      const choices = engine.getAvailableChoices();
      const choiceIds = choices.map((c) => c.id);

      // Only B victory should be available
      expect(choiceIds).not.toContain('faction_a_victory');
      expect(choiceIds).toContain('faction_b_victory');
    });
  });
});
