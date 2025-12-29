/**
 * Unit tests for the condition evaluation system.
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateCondition,
  evaluateConditions,
  getAvailableChoices,
} from '../conditions';
import type { GameState, Condition } from '../types';

function createTestState(overrides: Partial<GameState> = {}): GameState {
  return {
    currentNodeId: 'TEST_NODE',
    previousNodeId: null,
    flags: {},
    stats: { health: 100, maxHealth: 100 },
    inventory: [],
    factions: { factionA: 50, factionB: 50, factionC: 50 },
    visitedNodes: ['TEST_NODE'],
    choicesMade: [],
    isTransitioning: false,
    pendingEffects: [],
    ...overrides,
  };
}

describe('evaluateCondition', () => {
  describe('flag conditions', () => {
    it('returns true when flag is set and value is true', () => {
      const state = createTestState({ flags: { MY_FLAG: true } });
      const condition: Condition = { type: 'flag', flag: 'MY_FLAG', value: true };
      expect(evaluateCondition(condition, state)).toBe(true);
    });

    it('returns false when flag is set but value is false', () => {
      const state = createTestState({ flags: { MY_FLAG: true } });
      const condition: Condition = { type: 'flag', flag: 'MY_FLAG', value: false };
      expect(evaluateCondition(condition, state)).toBe(false);
    });

    it('returns true when flag is unset and value is false', () => {
      const state = createTestState({ flags: {} });
      const condition: Condition = { type: 'flag', flag: 'UNSET_FLAG', value: false };
      expect(evaluateCondition(condition, state)).toBe(true);
    });

    it('returns false when flag is unset and value is true', () => {
      const state = createTestState({ flags: {} });
      const condition: Condition = { type: 'flag', flag: 'UNSET_FLAG', value: true };
      expect(evaluateCondition(condition, state)).toBe(false);
    });
  });

  describe('stat conditions', () => {
    it('handles == operator', () => {
      const state = createTestState({ stats: { health: 50 } });
      expect(
        evaluateCondition({ type: 'stat', stat: 'health', operator: '==', value: 50 }, state)
      ).toBe(true);
      expect(
        evaluateCondition({ type: 'stat', stat: 'health', operator: '==', value: 51 }, state)
      ).toBe(false);
    });

    it('handles != operator', () => {
      const state = createTestState({ stats: { health: 50 } });
      expect(
        evaluateCondition({ type: 'stat', stat: 'health', operator: '!=', value: 49 }, state)
      ).toBe(true);
      expect(
        evaluateCondition({ type: 'stat', stat: 'health', operator: '!=', value: 50 }, state)
      ).toBe(false);
    });

    it('handles > operator', () => {
      const state = createTestState({ stats: { health: 50 } });
      expect(
        evaluateCondition({ type: 'stat', stat: 'health', operator: '>', value: 49 }, state)
      ).toBe(true);
      expect(
        evaluateCondition({ type: 'stat', stat: 'health', operator: '>', value: 50 }, state)
      ).toBe(false);
    });

    it('handles >= operator', () => {
      const state = createTestState({ stats: { health: 50 } });
      expect(
        evaluateCondition({ type: 'stat', stat: 'health', operator: '>=', value: 50 }, state)
      ).toBe(true);
      expect(
        evaluateCondition({ type: 'stat', stat: 'health', operator: '>=', value: 51 }, state)
      ).toBe(false);
    });

    it('handles < operator', () => {
      const state = createTestState({ stats: { health: 50 } });
      expect(
        evaluateCondition({ type: 'stat', stat: 'health', operator: '<', value: 51 }, state)
      ).toBe(true);
      expect(
        evaluateCondition({ type: 'stat', stat: 'health', operator: '<', value: 50 }, state)
      ).toBe(false);
    });

    it('handles <= operator', () => {
      const state = createTestState({ stats: { health: 50 } });
      expect(
        evaluateCondition({ type: 'stat', stat: 'health', operator: '<=', value: 50 }, state)
      ).toBe(true);
      expect(
        evaluateCondition({ type: 'stat', stat: 'health', operator: '<=', value: 49 }, state)
      ).toBe(false);
    });

    it('defaults missing stat to 0', () => {
      const state = createTestState({ stats: {} });
      expect(
        evaluateCondition({ type: 'stat', stat: 'unknown', operator: '==', value: 0 }, state)
      ).toBe(true);
    });
  });

  describe('item conditions', () => {
    it('has operator returns true when item exists', () => {
      const state = createTestState({
        inventory: [{ itemId: 'ITEM_SWORD', quantity: 1 }],
      });
      expect(
        evaluateCondition({ type: 'item', itemId: 'ITEM_SWORD', operator: 'has' }, state)
      ).toBe(true);
    });

    it('has operator returns false when item missing', () => {
      const state = createTestState({ inventory: [] });
      expect(
        evaluateCondition({ type: 'item', itemId: 'ITEM_SWORD', operator: 'has' }, state)
      ).toBe(false);
    });

    it('lacks operator returns true when item missing', () => {
      const state = createTestState({ inventory: [] });
      expect(
        evaluateCondition({ type: 'item', itemId: 'ITEM_SWORD', operator: 'lacks' }, state)
      ).toBe(true);
    });

    it('lacks operator returns false when item exists', () => {
      const state = createTestState({
        inventory: [{ itemId: 'ITEM_SWORD', quantity: 1 }],
      });
      expect(
        evaluateCondition({ type: 'item', itemId: 'ITEM_SWORD', operator: 'lacks' }, state)
      ).toBe(false);
    });

    it('count operator checks minimum quantity', () => {
      const state = createTestState({
        inventory: [{ itemId: 'ITEM_POTION', quantity: 3 }],
      });
      expect(
        evaluateCondition({ type: 'item', itemId: 'ITEM_POTION', operator: 'count', count: 3 }, state)
      ).toBe(true);
      expect(
        evaluateCondition({ type: 'item', itemId: 'ITEM_POTION', operator: 'count', count: 4 }, state)
      ).toBe(false);
    });

    it('count operator defaults to 1', () => {
      const state = createTestState({
        inventory: [{ itemId: 'ITEM_POTION', quantity: 1 }],
      });
      expect(
        evaluateCondition({ type: 'item', itemId: 'ITEM_POTION', operator: 'count' }, state)
      ).toBe(true);
    });
  });

  describe('faction conditions', () => {
    it('compares faction values correctly', () => {
      const state = createTestState({ factions: { factionA: 75 } });
      expect(
        evaluateCondition({ type: 'faction', faction: 'factionA', operator: '>=', value: 75 }, state)
      ).toBe(true);
      expect(
        evaluateCondition({ type: 'faction', faction: 'factionA', operator: '>', value: 75 }, state)
      ).toBe(false);
    });

    it('defaults missing faction to 50', () => {
      const state = createTestState({ factions: {} });
      expect(
        evaluateCondition({ type: 'faction', faction: 'unknown', operator: '==', value: 50 }, state)
      ).toBe(true);
    });
  });

  describe('visited conditions', () => {
    it('returns true when node was visited and value is true', () => {
      const state = createTestState({ visitedNodes: ['NODE_A', 'NODE_B'] });
      expect(
        evaluateCondition({ type: 'visited', nodeId: 'NODE_A', value: true }, state)
      ).toBe(true);
    });

    it('returns false when node was not visited and value is true', () => {
      const state = createTestState({ visitedNodes: ['NODE_A'] });
      expect(
        evaluateCondition({ type: 'visited', nodeId: 'NODE_B', value: true }, state)
      ).toBe(false);
    });

    it('returns true when node was not visited and value is false', () => {
      const state = createTestState({ visitedNodes: ['NODE_A'] });
      expect(
        evaluateCondition({ type: 'visited', nodeId: 'NODE_B', value: false }, state)
      ).toBe(true);
    });
  });

  describe('compound conditions', () => {
    it('not condition negates inner condition', () => {
      const state = createTestState({ flags: { MY_FLAG: true } });
      const condition: Condition = {
        type: 'not',
        condition: { type: 'flag', flag: 'MY_FLAG', value: true },
      };
      expect(evaluateCondition(condition, state)).toBe(false);
    });

    it('and condition requires all to pass', () => {
      const state = createTestState({
        flags: { FLAG_A: true, FLAG_B: true },
      });
      const condition: Condition = {
        type: 'and',
        conditions: [
          { type: 'flag', flag: 'FLAG_A', value: true },
          { type: 'flag', flag: 'FLAG_B', value: true },
        ],
      };
      expect(evaluateCondition(condition, state)).toBe(true);

      const stateFailing = createTestState({
        flags: { FLAG_A: true, FLAG_B: false },
      });
      expect(evaluateCondition(condition, stateFailing)).toBe(false);
    });

    it('or condition requires any to pass', () => {
      const state = createTestState({
        flags: { FLAG_A: false, FLAG_B: true },
      });
      const condition: Condition = {
        type: 'or',
        conditions: [
          { type: 'flag', flag: 'FLAG_A', value: true },
          { type: 'flag', flag: 'FLAG_B', value: true },
        ],
      };
      expect(evaluateCondition(condition, state)).toBe(true);

      const stateFailing = createTestState({
        flags: { FLAG_A: false, FLAG_B: false },
      });
      expect(evaluateCondition(condition, stateFailing)).toBe(false);
    });

    it('handles nested compound conditions', () => {
      const state = createTestState({
        flags: { FLAG_A: true },
        stats: { health: 50 },
      });
      const condition: Condition = {
        type: 'and',
        conditions: [
          { type: 'flag', flag: 'FLAG_A', value: true },
          {
            type: 'or',
            conditions: [
              { type: 'stat', stat: 'health', operator: '>=', value: 75 },
              { type: 'stat', stat: 'health', operator: '<=', value: 50 },
            ],
          },
        ],
      };
      expect(evaluateCondition(condition, state)).toBe(true);
    });
  });
});

describe('evaluateConditions', () => {
  it('returns true for empty array', () => {
    const state = createTestState();
    expect(evaluateConditions([], state)).toBe(true);
  });

  it('returns true for undefined', () => {
    const state = createTestState();
    expect(evaluateConditions(undefined, state)).toBe(true);
  });

  it('returns true when all conditions pass', () => {
    const state = createTestState({
      flags: { FLAG_A: true },
      stats: { health: 100 },
    });
    const conditions: Condition[] = [
      { type: 'flag', flag: 'FLAG_A', value: true },
      { type: 'stat', stat: 'health', operator: '>=', value: 50 },
    ];
    expect(evaluateConditions(conditions, state)).toBe(true);
  });

  it('returns false when any condition fails', () => {
    const state = createTestState({
      flags: { FLAG_A: true },
      stats: { health: 25 },
    });
    const conditions: Condition[] = [
      { type: 'flag', flag: 'FLAG_A', value: true },
      { type: 'stat', stat: 'health', operator: '>=', value: 50 },
    ];
    expect(evaluateConditions(conditions, state)).toBe(false);
  });
});

describe('getAvailableChoices', () => {
  it('returns all choice IDs when no conditions', () => {
    const state = createTestState();
    const choices = [
      { id: 'choice_a' },
      { id: 'choice_b' },
    ];
    expect(getAvailableChoices(choices, state)).toEqual(['choice_a', 'choice_b']);
  });

  it('filters out choices with failing conditions', () => {
    const state = createTestState({ flags: { CAN_FLY: false } });
    const choices = [
      { id: 'walk', conditions: [] },
      { id: 'fly', conditions: [{ type: 'flag' as const, flag: 'CAN_FLY', value: true }] },
    ];
    expect(getAvailableChoices(choices, state)).toEqual(['walk']);
  });
});
