/**
 * Unit tests for the effect application system.
 */

import { describe, it, expect } from 'vitest';
import { applyEffect, applyEffects, createDefaultContext } from '../effects';
import type { GameState, Effect, Item, GameEvent } from '../types';
import type { EffectContext } from '../effects';

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

function createTestContext(items: Record<string, Item> = {}): EffectContext {
  const events: GameEvent[] = [];
  return {
    getItem: (itemId) => items[itemId],
    emitEvent: (event) => events.push(event),
  };
}

describe('applyEffect', () => {
  describe('setFlag', () => {
    it('sets a flag to true', () => {
      const state = createTestState({ flags: {} });
      const effect: Effect = { type: 'setFlag', flag: 'MY_FLAG' };
      const newState = applyEffect(state, effect, createDefaultContext());
      expect(newState.flags.MY_FLAG).toBe(true);
    });

    it('does not mutate original state', () => {
      const state = createTestState({ flags: {} });
      const effect: Effect = { type: 'setFlag', flag: 'MY_FLAG' };
      applyEffect(state, effect, createDefaultContext());
      expect(state.flags.MY_FLAG).toBeUndefined();
    });
  });

  describe('clearFlag', () => {
    it('sets a flag to false', () => {
      const state = createTestState({ flags: { MY_FLAG: true } });
      const effect: Effect = { type: 'clearFlag', flag: 'MY_FLAG' };
      const newState = applyEffect(state, effect, createDefaultContext());
      expect(newState.flags.MY_FLAG).toBe(false);
    });
  });

  describe('modifyStat', () => {
    it('adds positive delta to stat', () => {
      const state = createTestState({ stats: { health: 50, maxHealth: 100 } });
      const effect: Effect = { type: 'modifyStat', stat: 'health', delta: 25 };
      const newState = applyEffect(state, effect, createDefaultContext());
      expect(newState.stats.health).toBe(75);
    });

    it('subtracts negative delta from stat', () => {
      const state = createTestState({ stats: { health: 50, maxHealth: 100 } });
      const effect: Effect = { type: 'modifyStat', stat: 'health', delta: -25 };
      const newState = applyEffect(state, effect, createDefaultContext());
      expect(newState.stats.health).toBe(25);
    });

    it('clamps to maxHealth by default', () => {
      const state = createTestState({ stats: { health: 90, maxHealth: 100 } });
      const effect: Effect = { type: 'modifyStat', stat: 'health', delta: 50 };
      const newState = applyEffect(state, effect, createDefaultContext());
      expect(newState.stats.health).toBe(100);
    });

    it('clamps to 0 by default', () => {
      const state = createTestState({ stats: { health: 10, maxHealth: 100 } });
      const effect: Effect = { type: 'modifyStat', stat: 'health', delta: -50 };
      const newState = applyEffect(state, effect, createDefaultContext());
      expect(newState.stats.health).toBe(0);
    });

    it('respects custom clampMin and clampMax', () => {
      const state = createTestState({ stats: { energy: 50 } });
      const effect: Effect = {
        type: 'modifyStat',
        stat: 'energy',
        delta: 100,
        clampMin: 10,
        clampMax: 75,
      };
      const newState = applyEffect(state, effect, createDefaultContext());
      expect(newState.stats.energy).toBe(75);
    });
  });

  describe('setStat', () => {
    it('sets stat to exact value', () => {
      const state = createTestState({ stats: { health: 100 } });
      const effect: Effect = { type: 'setStat', stat: 'health', value: 42 };
      const newState = applyEffect(state, effect, createDefaultContext());
      expect(newState.stats.health).toBe(42);
    });

    it('creates new stat if it does not exist', () => {
      const state = createTestState({ stats: {} });
      const effect: Effect = { type: 'setStat', stat: 'mana', value: 50 };
      const newState = applyEffect(state, effect, createDefaultContext());
      expect(newState.stats.mana).toBe(50);
    });
  });

  describe('addItem', () => {
    it('adds item to empty inventory', () => {
      const state = createTestState({ inventory: [] });
      const context = createTestContext({
        ITEM_SWORD: {
          id: 'ITEM_SWORD',
          name: 'Sword',
          description: 'A sword',
          stackable: false,
          usable: false,
          consumable: false,
        },
      });
      const effect: Effect = { type: 'addItem', itemId: 'ITEM_SWORD' };
      const newState = applyEffect(state, effect, context);
      expect(newState.inventory).toEqual([{ itemId: 'ITEM_SWORD', quantity: 1 }]);
    });

    it('stacks stackable items', () => {
      const state = createTestState({
        inventory: [{ itemId: 'ITEM_POTION', quantity: 2 }],
      });
      const context = createTestContext({
        ITEM_POTION: {
          id: 'ITEM_POTION',
          name: 'Potion',
          description: 'A potion',
          stackable: true,
          usable: true,
          consumable: true,
        },
      });
      const effect: Effect = { type: 'addItem', itemId: 'ITEM_POTION', quantity: 3 };
      const newState = applyEffect(state, effect, context);
      expect(newState.inventory).toEqual([{ itemId: 'ITEM_POTION', quantity: 5 }]);
    });

    it('respects maxStack limit', () => {
      const state = createTestState({
        inventory: [{ itemId: 'ITEM_ARROW', quantity: 95 }],
      });
      const context = createTestContext({
        ITEM_ARROW: {
          id: 'ITEM_ARROW',
          name: 'Arrow',
          description: 'An arrow',
          stackable: true,
          maxStack: 99,
          usable: false,
          consumable: false,
        },
      });
      const effect: Effect = { type: 'addItem', itemId: 'ITEM_ARROW', quantity: 10 };
      const newState = applyEffect(state, effect, context);
      expect(newState.inventory).toEqual([{ itemId: 'ITEM_ARROW', quantity: 99 }]);
    });

    it('does not add duplicate non-stackable items', () => {
      const state = createTestState({
        inventory: [{ itemId: 'ITEM_AMULET', quantity: 1 }],
      });
      const context = createTestContext({
        ITEM_AMULET: {
          id: 'ITEM_AMULET',
          name: 'Amulet',
          description: 'An amulet',
          stackable: false,
          usable: false,
          consumable: false,
        },
      });
      const effect: Effect = { type: 'addItem', itemId: 'ITEM_AMULET' };
      const newState = applyEffect(state, effect, context);
      expect(newState.inventory).toEqual([{ itemId: 'ITEM_AMULET', quantity: 1 }]);
    });

    it('throws if item not found', () => {
      const state = createTestState({ inventory: [] });
      const context = createTestContext({});
      const effect: Effect = { type: 'addItem', itemId: 'UNKNOWN_ITEM' };
      expect(() => applyEffect(state, effect, context)).toThrow('Item not found');
    });
  });

  describe('removeItem', () => {
    it('removes all when quantity is undefined', () => {
      const state = createTestState({
        inventory: [{ itemId: 'ITEM_SWORD', quantity: 5 }],
      });
      const effect: Effect = { type: 'removeItem', itemId: 'ITEM_SWORD' };
      const newState = applyEffect(state, effect, createDefaultContext());
      expect(newState.inventory).toEqual([]);
    });

    it('removes specified quantity', () => {
      const state = createTestState({
        inventory: [{ itemId: 'ITEM_POTION', quantity: 5 }],
      });
      const effect: Effect = { type: 'removeItem', itemId: 'ITEM_POTION', quantity: 2 };
      const newState = applyEffect(state, effect, createDefaultContext());
      expect(newState.inventory).toEqual([{ itemId: 'ITEM_POTION', quantity: 3 }]);
    });

    it('removes item from inventory when quantity reaches 0', () => {
      const state = createTestState({
        inventory: [{ itemId: 'ITEM_POTION', quantity: 2 }],
      });
      const effect: Effect = { type: 'removeItem', itemId: 'ITEM_POTION', quantity: 2 };
      const newState = applyEffect(state, effect, createDefaultContext());
      expect(newState.inventory).toEqual([]);
    });
  });

  describe('modifyFaction', () => {
    it('adds positive delta to faction', () => {
      const state = createTestState({ factions: { factionA: 50 } });
      const effect: Effect = { type: 'modifyFaction', faction: 'factionA', delta: 25 };
      const newState = applyEffect(state, effect, createDefaultContext());
      expect(newState.factions.factionA).toBe(75);
    });

    it('clamps to 0-100 by default', () => {
      const state = createTestState({ factions: { factionA: 90 } });
      const effect: Effect = { type: 'modifyFaction', faction: 'factionA', delta: 50 };
      const newState = applyEffect(state, effect, createDefaultContext());
      expect(newState.factions.factionA).toBe(100);
    });

    it('respects custom clampMin and clampMax', () => {
      const state = createTestState({ factions: { factionA: 50 } });
      const effect: Effect = {
        type: 'modifyFaction',
        faction: 'factionA',
        delta: -100,
        clampMin: 25,
      };
      const newState = applyEffect(state, effect, createDefaultContext());
      expect(newState.factions.factionA).toBe(25);
    });
  });

  describe('setFaction', () => {
    it('sets faction to exact value', () => {
      const state = createTestState({ factions: { factionA: 50 } });
      const effect: Effect = { type: 'setFaction', faction: 'factionA', value: 75 };
      const newState = applyEffect(state, effect, createDefaultContext());
      expect(newState.factions.factionA).toBe(75);
    });
  });

  describe('triggerEvent', () => {
    it('emits event and returns unchanged state', () => {
      const state = createTestState();
      const events: GameEvent[] = [];
      const context: EffectContext = {
        getItem: () => undefined,
        emitEvent: (event) => events.push(event),
      };
      const effect: Effect = {
        type: 'triggerEvent',
        event: 'item_acquired',
        data: { itemId: 'ITEM_SWORD' },
      };
      const newState = applyEffect(state, effect, context);

      expect(newState).toEqual(state);
      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe('item_acquired');
      expect(events[0]!.data).toEqual({ itemId: 'ITEM_SWORD' });
    });
  });
});

describe('applyEffects', () => {
  it('returns original state for empty array', () => {
    const state = createTestState();
    const newState = applyEffects(state, [], createDefaultContext());
    expect(newState).toEqual(state);
  });

  it('returns original state for undefined', () => {
    const state = createTestState();
    const newState = applyEffects(state, undefined, createDefaultContext());
    expect(newState).toEqual(state);
  });

  it('applies effects in order', () => {
    const state = createTestState({ stats: { health: 100 } });
    const effects: Effect[] = [
      { type: 'modifyStat', stat: 'health', delta: -50 },
      { type: 'modifyStat', stat: 'health', delta: -30 },
    ];
    const newState = applyEffects(state, effects, createDefaultContext());
    expect(newState.stats.health).toBe(20);
  });

  it('accumulates changes across effects', () => {
    const state = createTestState({ flags: {}, factions: { factionA: 50 } });
    const effects: Effect[] = [
      { type: 'setFlag', flag: 'FLAG_A' },
      { type: 'setFlag', flag: 'FLAG_B' },
      { type: 'modifyFaction', faction: 'factionA', delta: 25 },
    ];
    const newState = applyEffects(state, effects, createDefaultContext());
    expect(newState.flags.FLAG_A).toBe(true);
    expect(newState.flags.FLAG_B).toBe(true);
    expect(newState.factions.factionA).toBe(75);
  });
});
