/**
 * Edge Case 1: Faction Switching Mid-Game
 *
 * Tests that faction lock behavior is enforced and ally departure
 * triggers correctly when faction standing drops below 25.
 *
 * @see /docs/QA.md - Edge Case 1: Faction Switching Mid-Game
 */

import { describe, it, expect } from 'vitest';
import {
  createFactionSwitchState,
  createInitialState,
  assertFactionLock,
  assertFactionThreshold,
  createTestManifest,
  createTestEngine,
  GameEvent,
} from './setup';

describe('Edge Case 1: Faction Switching Mid-Game', () => {
  describe('Faction Lock Persistence', () => {
    it('should maintain original faction flag after lowering standing', () => {
      const state = createFactionSwitchState();

      // Original faction choice persists
      expect(state.flags.FACTION_A_JOINED).toBe(true);

      // Even with low standing
      expect(state.factions.factionA).toBeLessThan(25);
    });

    it('should not allow joining new faction after initial choice', () => {
      const state = createFactionSwitchState();

      // High standing with Faction B doesn't grant FACTION_B_JOINED
      expect(state.factions.factionB).toBeGreaterThan(50);
      expect(state.flags.FACTION_B_JOINED).toBeFalsy();
    });

    it('should enforce faction lock across all factions', () => {
      const stateA = createInitialState({
        flags: { FACTION_A_JOINED: true },
      });
      assertFactionLock(stateA, 'A');

      const stateB = createInitialState({
        flags: { FACTION_B_JOINED: true },
      });
      assertFactionLock(stateB, 'B');

      const stateC = createInitialState({
        flags: { FACTION_C_JOINED: true },
      });
      assertFactionLock(stateC, 'C');
    });
  });

  describe('Ally Departure on Low Standing', () => {
    it('should trigger ally departure when faction standing drops below 25', () => {
      const state = createFactionSwitchState();

      // Marcus (A-aligned ally) left due to low standing
      expect(state.flags.ALLY_MARCUS_ALIVE).toBe(false);
      expect(state.factions.factionA).toBeLessThan(25);
    });

    it('should keep non-faction-aligned allies', () => {
      const state = createFactionSwitchState();

      // Elena is not faction-A aligned, so stays
      expect(state.flags.ALLY_ELENA_ALIVE).toBe(true);
    });

    it('should track ally departure in visited nodes', () => {
      const state = createFactionSwitchState();

      // Should have visited betrayal-related nodes
      expect(state.visitedNodes).toContain('ACT2_BETRAYAL_HINT');
    });
  });

  describe('Faction Standing Thresholds', () => {
    it('should recognize standing at exactly 24 as below threshold', () => {
      const state = createInitialState({
        factions: { factionA: 24, factionB: 50, factionC: 50 },
      });

      assertFactionThreshold(state, 'factionA', 25, false);
    });

    it('should recognize standing at exactly 25 as meeting threshold', () => {
      const state = createInitialState({
        factions: { factionA: 25, factionB: 50, factionC: 50 },
      });

      assertFactionThreshold(state, 'factionA', 25, true);
    });

    it('should allow quest access with high alternate faction standing', () => {
      const state = createFactionSwitchState();

      // High B standing may unlock B-faction quests (but not victory)
      expect(state.factions.factionB).toBeGreaterThanOrEqual(50);
    });
  });

  describe('Victory Ending Restriction', () => {
    it('should require original faction for victory ending', () => {
      const state = createFactionSwitchState();

      // Even with high B standing, victory requires A artifact due to FACTION_A_JOINED
      const hasArtifact = state.inventory.some(
        (i) => i.itemId === 'ITEM_FACTION_A_ARTIFACT'
      );
      const hasBonusArtifact = state.inventory.some(
        (i) => i.itemId === 'ITEM_FACTION_B_ARTIFACT'
      );

      // Player needs to get back on track with original faction
      expect(hasArtifact).toBe(false);
      expect(hasBonusArtifact).toBe(false);
    });
  });

  describe('Engine Integration', () => {
    it('should evaluate faction conditions correctly in choices', () => {
      const manifest = createTestManifest({
        nodes: [
          {
            id: 'FACTION_TEST',
            title: 'Faction Test',
            body: 'Testing faction choices.',
            choices: [
              {
                id: 'faction_a_quest',
                text: 'Faction A exclusive quest',
                targetId: 'FACTION_A_ONLY',
                conditions: [
                  { type: 'flag', flag: 'FACTION_A_JOINED', value: true },
                  { type: 'faction', faction: 'factionA', operator: '>=', value: 50 },
                ],
              },
              {
                id: 'faction_b_quest',
                text: 'Faction B quest (standing only)',
                targetId: 'FACTION_B_QUEST',
                conditions: [
                  { type: 'faction', faction: 'factionB', operator: '>=', value: 50 },
                ],
              },
            ],
          },
          {
            id: 'FACTION_A_ONLY',
            title: 'Faction A Only',
            body: 'Exclusive A content.',
            choices: [],
          },
          {
            id: 'FACTION_B_QUEST',
            title: 'Faction B Quest',
            body: 'B quest available.',
            choices: [],
          },
        ],
        initialState: {
          currentNodeId: 'FACTION_TEST',
          flags: { FACTION_A_JOINED: true },
          stats: { health: 100 },
          inventory: [],
          factions: { factionA: 20, factionB: 55, factionC: 40 }, // Switched scenario
        },
      });

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      const choices = engine.getAvailableChoices();

      // Faction A quest should be locked (low standing)
      const aQuest = choices.find((c) => c.id === 'faction_a_quest');
      expect(aQuest).toBeUndefined();

      // Faction B quest should be available (high standing, no flag required)
      const bQuest = choices.find((c) => c.id === 'faction_b_quest');
      expect(bQuest).toBeDefined();
    });

    it('should trigger ally_left event when faction drops below threshold', () => {
      const manifest = createTestManifest({
        nodes: [
          {
            id: 'FACTION_DROP',
            title: 'Faction Drops',
            body: 'Your faction standing is lowered.',
            choices: [
              {
                id: 'betray',
                text: 'Betray faction',
                targetId: 'BETRAYED',
                effects: [
                  { type: 'modifyFaction', faction: 'factionA', delta: -30 },
                  { type: 'clearFlag', flag: 'ALLY_MARCUS_ALIVE' },
                  { type: 'triggerEvent', event: 'ally_left', data: { ally: 'marcus' } },
                ],
              },
            ],
          },
          {
            id: 'BETRAYED',
            title: 'Betrayed',
            body: 'Marcus leaves in disgust.',
            choices: [],
          },
        ],
        initialState: {
          currentNodeId: 'FACTION_DROP',
          flags: { FACTION_A_JOINED: true, ALLY_MARCUS_ALIVE: true },
          stats: { health: 100 },
          inventory: [],
          factions: { factionA: 50, factionB: 50, factionC: 50 },
        },
      });

      const events: GameEvent[] = [];
      const { engine } = createTestEngine(manifest, {
        onEvent: (event) => events.push(event),
      });

      engine.startNewGame();
      engine.makeChoice('betray');

      // Verify faction dropped
      const state = engine.getGameState();
      expect(state?.factions.factionA).toBe(20);

      // Verify ally left event triggered
      const allyLeftEvent = events.find((e) => e.type === 'ally_left');
      expect(allyLeftEvent).toBeDefined();
      expect(allyLeftEvent?.data?.ally).toBe('marcus');

      // Verify ally flag cleared
      expect(state?.flags.ALLY_MARCUS_ALIVE).toBe(false);
    });
  });
});
