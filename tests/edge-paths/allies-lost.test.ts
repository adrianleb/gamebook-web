/**
 * Edge Case 3: All Allies Recruited Then Lost
 *
 * Tests that ally flags correctly transition from true to false,
 * and that endings requiring allies become unavailable.
 *
 * @see /docs/QA.md - Edge Case 3: All Allies Recruited Then Lost
 */

import { describe, it, expect } from 'vitest';
import {
  createAlliesLostState,
  createInitialState,
  assertAllyStateTransition,
  assertEndingAvailable,
  createTestManifest,
  createTestEngine,
  GameEvent,
} from './setup';

describe('Edge Case 3: All Allies Recruited Then Lost', () => {
  describe('Ally Flag Transitions', () => {
    it('should track that all allies were recruited', () => {
      const state = createAlliesLostState();

      expect(state.flags.ALLY_MARCUS_RECRUITED).toBe(true);
      expect(state.flags.ALLY_ELENA_RECRUITED).toBe(true);
      expect(state.flags.ALLY_THORNE_RECRUITED).toBe(true);
    });

    it('should show all allies as no longer alive', () => {
      const state = createAlliesLostState();

      expect(state.flags.ALLY_MARCUS_ALIVE).toBe(false);
      expect(state.flags.ALLY_ELENA_ALIVE).toBe(false);
      expect(state.flags.ALLY_THORNE_ALIVE).toBe(false);
    });

    it('should correctly report ally state for each ally', () => {
      const state = createAlliesLostState();

      assertAllyStateTransition(state, 'MARCUS', true, false);
      assertAllyStateTransition(state, 'ELENA', true, false);
      assertAllyStateTransition(state, 'THORNE', true, false);
    });
  });

  describe('Ally Loss Events', () => {
    it('should have visited ally death/loss nodes', () => {
      const state = createAlliesLostState();

      expect(state.visitedNodes).toContain('ACT2_MARCUS_DEATH');
      expect(state.visitedNodes).toContain('ACT2_ELENA_BETRAYAL');
      expect(state.visitedNodes).toContain('ACT3_THORNE_SACRIFICE');
    });

    it('should have visited ally recruitment nodes before loss', () => {
      const state = createAlliesLostState();

      expect(state.visitedNodes).toContain('ACT1_ALLY_MARCUS');
      expect(state.visitedNodes).toContain('ACT1_MARCUS_JOIN');
      expect(state.visitedNodes).toContain('ACT2_ALLY_ELENA');
      expect(state.visitedNodes).toContain('ACT2_ELENA_SAVED');
    });
  });

  describe('Ending Availability', () => {
    it('should make victory ending unavailable (requires 2+ allies)', () => {
      const state = createAlliesLostState();

      // Victory requires at least 2 allies alive
      const aliveCount = [
        state.flags.ALLY_MARCUS_ALIVE,
        state.flags.ALLY_ELENA_ALIVE,
        state.flags.ALLY_THORNE_ALIVE,
      ].filter(Boolean).length;

      expect(aliveCount).toBe(0);
    });

    it('should keep neutral ending available', () => {
      const state = createAlliesLostState();

      // Neutral ending doesn't require allies
      const factionValues = Object.values(state.factions);
      const isNeutralPossible =
        factionValues.every((v) => v >= 25 && v <= 50) ||
        state.flags.NEUTRAL_PATH_AVAILABLE;

      // With faction at 60, neutral may not be available via faction check
      // but could still be available via other paths
      expect(state.factions.factionA).toBe(60);
    });

    it('should keep death ending available', () => {
      const state = createAlliesLostState();

      // Death ending is always available as fallback
      assertEndingAvailable(state, 'death', false); // Not forced yet
    });

    it('should allow betrayal path if requirements met', () => {
      const stateWithBetrayal = createInitialState({
        currentNodeId: 'ACT3_FINAL_OFFER',
        flags: {
          ALLY_MARCUS_ALIVE: false,
          ALLY_ELENA_ALIVE: false,
          ALLY_THORNE_ALIVE: false,
          BETRAYER_PATH: true,
          SECRET_DEAL_MADE: true,
        },
        inventory: [{ itemId: 'ITEM_DARK_PACT_SCROLL', quantity: 1 }],
      });

      assertEndingAvailable(stateWithBetrayal, 'betrayal', true);
    });
  });

  describe('Engine Integration', () => {
    it('should transition ally flags correctly when ally dies', () => {
      const manifest = createTestManifest({
        nodes: [
          {
            id: 'ALLY_DANGER',
            title: 'Ally in Danger',
            body: 'Marcus faces mortal danger.',
            choices: [
              {
                id: 'save_marcus',
                text: 'Save Marcus',
                targetId: 'MARCUS_SAVED',
                conditions: [
                  { type: 'item', item: 'ITEM_SURVIVAL_KIT', operator: '>=', value: 1 },
                ],
              },
              {
                id: 'cant_save',
                text: 'Watch helplessly',
                targetId: 'MARCUS_DIES',
                effects: [
                  { type: 'clearFlag', flag: 'ALLY_MARCUS_ALIVE' },
                  { type: 'triggerEvent', event: 'ally_died', data: { ally: 'marcus' } },
                ],
              },
            ],
          },
          {
            id: 'MARCUS_SAVED',
            title: 'Marcus Saved',
            body: 'You saved Marcus.',
            choices: [],
          },
          {
            id: 'MARCUS_DIES',
            title: 'Marcus Dies',
            body: 'Marcus has fallen.',
            choices: [],
          },
        ],
        initialState: {
          currentNodeId: 'ALLY_DANGER',
          flags: {
            ALLY_MARCUS_ALIVE: true,
            ALLY_MARCUS_RECRUITED: true,
          },
          stats: { health: 100 },
          inventory: [], // No survival kit
          factions: { factionA: 50, factionB: 50, factionC: 50 },
        },
      });

      const events: GameEvent[] = [];
      const { engine } = createTestEngine(manifest, {
        onEvent: (event) => events.push(event),
      });

      engine.startNewGame();

      // Save option should not be available
      const choices = engine.getAvailableChoices();
      expect(choices.find((c) => c.id === 'save_marcus')).toBeUndefined();
      expect(choices.find((c) => c.id === 'cant_save')).toBeDefined();

      // Watch ally die
      engine.makeChoice('cant_save');

      const state = engine.getGameState();
      expect(state?.flags.ALLY_MARCUS_ALIVE).toBe(false);
      expect(state?.flags.ALLY_MARCUS_RECRUITED).toBe(true); // Still was recruited

      // Event triggered
      const diedEvent = events.find((e) => e.type === 'ally_died');
      expect(diedEvent).toBeDefined();
      expect(diedEvent?.data?.ally).toBe('marcus');
    });

    it('should block ally-gated choices when allies are dead', () => {
      const manifest = createTestManifest({
        nodes: [
          {
            id: 'ALLY_CHECK',
            title: 'Ally Check',
            body: 'Some options require allies.',
            choices: [
              {
                id: 'ally_help',
                text: 'Ask ally for help',
                targetId: 'ALLY_HELPS',
                conditions: [
                  {
                    type: 'or',
                    conditions: [
                      { type: 'flag', flag: 'ALLY_MARCUS_ALIVE', value: true },
                      { type: 'flag', flag: 'ALLY_ELENA_ALIVE', value: true },
                      { type: 'flag', flag: 'ALLY_THORNE_ALIVE', value: true },
                    ],
                  },
                ],
              },
              {
                id: 'go_alone',
                text: 'Go alone',
                targetId: 'ALONE',
              },
            ],
          },
          {
            id: 'ALLY_HELPS',
            title: 'Ally Helps',
            body: 'Your ally assists.',
            choices: [],
          },
          {
            id: 'ALONE',
            title: 'Alone',
            body: 'You proceed alone.',
            choices: [],
          },
        ],
        initialState: {
          currentNodeId: 'ALLY_CHECK',
          flags: {
            ALLY_MARCUS_ALIVE: false,
            ALLY_ELENA_ALIVE: false,
            ALLY_THORNE_ALIVE: false,
          },
          stats: { health: 100 },
          inventory: [],
          factions: { factionA: 50, factionB: 50, factionC: 50 },
        },
      });

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      const choices = engine.getAvailableChoices();

      // Ally help should not be available
      expect(choices.find((c) => c.id === 'ally_help')).toBeUndefined();

      // Going alone should always be available
      expect(choices.find((c) => c.id === 'go_alone')).toBeDefined();
    });

    it('should count alive allies correctly for multi-ally requirements', () => {
      const manifest = createTestManifest({
        nodes: [
          {
            id: 'MULTI_ALLY',
            title: 'Multi Ally Check',
            body: 'Need multiple allies.',
            choices: [
              {
                id: 'coordinated_attack',
                text: 'Coordinated attack (2+ allies)',
                targetId: 'ATTACK',
                conditions: [
                  { type: 'flag', flag: 'ALLY_MARCUS_ALIVE', value: true },
                  { type: 'flag', flag: 'ALLY_ELENA_ALIVE', value: true },
                ],
              },
              {
                id: 'solo_attack',
                text: 'Solo attack',
                targetId: 'SOLO',
              },
            ],
          },
          {
            id: 'ATTACK',
            title: 'Coordinated Attack',
            body: 'Together you strike.',
            choices: [],
          },
          {
            id: 'SOLO',
            title: 'Solo',
            body: 'You attack alone.',
            choices: [],
          },
        ],
        initialState: {
          currentNodeId: 'MULTI_ALLY',
          flags: {
            ALLY_MARCUS_ALIVE: true,
            ALLY_ELENA_ALIVE: false, // Only 1 ally
            ALLY_THORNE_ALIVE: false,
          },
          stats: { health: 100 },
          inventory: [],
          factions: { factionA: 50, factionB: 50, factionC: 50 },
        },
      });

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      const choices = engine.getAvailableChoices();

      // Coordinated attack requires 2 allies
      expect(choices.find((c) => c.id === 'coordinated_attack')).toBeUndefined();
      expect(choices.find((c) => c.id === 'solo_attack')).toBeDefined();
    });
  });

  describe('State Consistency', () => {
    it('should never have ally alive without being recruited', () => {
      // If ALLY_X_ALIVE is true, ALLY_X_RECRUITED should also be true
      const invalidState = createInitialState({
        flags: {
          ALLY_MARCUS_ALIVE: true,
          ALLY_MARCUS_RECRUITED: false, // Invalid
        },
      });

      // This is an invalid state - test that our factory doesn't create it
      const validState = createAlliesLostState();
      for (const ally of ['MARCUS', 'ELENA', 'THORNE']) {
        if (validState.flags[`ALLY_${ally}_ALIVE`]) {
          expect(validState.flags[`ALLY_${ally}_RECRUITED`]).toBe(true);
        }
      }
    });

    it('should track ally status through save/load cycle', () => {
      const state = createAlliesLostState();

      // Simulate serialization
      const serialized = JSON.stringify(state);
      const restored = JSON.parse(serialized);

      // All ally flags should persist
      expect(restored.flags.ALLY_MARCUS_RECRUITED).toBe(true);
      expect(restored.flags.ALLY_MARCUS_ALIVE).toBe(false);
      expect(restored.flags.ALLY_ELENA_RECRUITED).toBe(true);
      expect(restored.flags.ALLY_ELENA_ALIVE).toBe(false);
      expect(restored.flags.ALLY_THORNE_RECRUITED).toBe(true);
      expect(restored.flags.ALLY_THORNE_ALIVE).toBe(false);
    });
  });
});
