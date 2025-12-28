/**
 * Effect application system.
 * Based on ENGINE.md specification v1.0.0
 *
 * Supports 9 effect types:
 * - setFlag: Set a flag to true
 * - clearFlag: Set a flag to false
 * - modifyStat: Add/subtract from a stat with optional clamping
 * - setStat: Set a stat to a specific value
 * - addItem: Add item(s) to inventory
 * - removeItem: Remove item(s) from inventory
 * - modifyFaction: Add/subtract from faction standing
 * - setFaction: Set faction to a specific value
 * - triggerEvent: Emit an event for UI/audio hooks
 *
 * @module engine/effects
 */

import type { Effect, GameState, Item, GameEvent, GameEventHandler } from './types';
import { EngineError } from './errors';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export interface EffectContext {
  getItem: (itemId: string) => Item | undefined;
  emitEvent: GameEventHandler;
}

/**
 * Applies a single effect to the game state.
 * Returns a new state object (immutable).
 *
 * @param state - Current game state
 * @param effect - Effect to apply
 * @param context - Context with item lookup and event emitter
 * @returns New game state after applying the effect
 */
export function applyEffect(
  state: GameState,
  effect: Effect,
  context: EffectContext
): GameState {
  switch (effect.type) {
    case 'setFlag':
      return {
        ...state,
        flags: { ...state.flags, [effect.flag]: true },
      };

    case 'clearFlag':
      return {
        ...state,
        flags: { ...state.flags, [effect.flag]: false },
      };

    case 'modifyStat': {
      const current = state.stats[effect.stat] ?? 0;
      const maxStatKey = `max${capitalize(effect.stat)}`;
      const defaultMax = state.stats[maxStatKey] ?? Infinity;
      const newValue = clamp(
        current + effect.delta,
        effect.clampMin ?? 0,
        effect.clampMax ?? defaultMax
      );
      return {
        ...state,
        stats: { ...state.stats, [effect.stat]: newValue },
      };
    }

    case 'setStat':
      return {
        ...state,
        stats: { ...state.stats, [effect.stat]: effect.value },
      };

    case 'addItem': {
      const quantity = effect.quantity ?? 1;
      const existing = state.inventory.find((e) => e.itemId === effect.itemId);
      const item = context.getItem(effect.itemId);

      if (!item) {
        throw new EngineError('INVALID_ITEM', `Item not found: ${effect.itemId}`, {
          itemId: effect.itemId,
        });
      }

      if (existing && item.stackable) {
        const maxStack = item.maxStack ?? 99;
        return {
          ...state,
          inventory: state.inventory.map((e) =>
            e.itemId === effect.itemId
              ? { ...e, quantity: Math.min(e.quantity + quantity, maxStack) }
              : e
          ),
        };
      } else if (!existing) {
        return {
          ...state,
          inventory: [...state.inventory, { itemId: effect.itemId, quantity }],
        };
      }
      // Non-stackable item already owned - no change
      return state;
    }

    case 'removeItem': {
      const quantity = effect.quantity;

      if (quantity === undefined) {
        // Remove all
        return {
          ...state,
          inventory: state.inventory.filter((e) => e.itemId !== effect.itemId),
        };
      } else {
        return {
          ...state,
          inventory: state.inventory
            .map((e) =>
              e.itemId === effect.itemId
                ? { ...e, quantity: e.quantity - quantity }
                : e
            )
            .filter((e) => e.quantity > 0),
        };
      }
    }

    case 'modifyFaction': {
      const current = state.factions[effect.faction] ?? 50;
      const newValue = clamp(
        current + effect.delta,
        effect.clampMin ?? 0,
        effect.clampMax ?? 100
      );
      return {
        ...state,
        factions: { ...state.factions, [effect.faction]: newValue },
      };
    }

    case 'setFaction':
      return {
        ...state,
        factions: { ...state.factions, [effect.faction]: effect.value },
      };

    case 'triggerEvent': {
      const event: GameEvent = {
        type: effect.event,
        data: effect.data,
        timestamp: Date.now(),
      };
      context.emitEvent(event);
      // Events don't modify state
      return state;
    }

    default:
      throw new EngineError(
        'INVALID_EFFECT',
        `Unknown effect type: ${(effect as Effect).type}`
      );
  }
}

/**
 * Applies an array of effects to the game state.
 * Effects are applied in order (left to right).
 *
 * @param state - Current game state
 * @param effects - Array of effects to apply
 * @param context - Context with item lookup and event emitter
 * @returns New game state after applying all effects
 */
export function applyEffects(
  state: GameState,
  effects: Effect[] | undefined,
  context: EffectContext
): GameState {
  if (!effects || effects.length === 0) {
    return state;
  }
  return effects.reduce((s, effect) => applyEffect(s, effect, context), state);
}

/**
 * Creates a default effect context with no-op handlers.
 * Useful for testing.
 */
export function createDefaultContext(): EffectContext {
  return {
    getItem: () => undefined,
    emitEvent: () => {},
  };
}
