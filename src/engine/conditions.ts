/**
 * Condition evaluation system.
 * Based on ENGINE.md specification v1.0.0
 *
 * Supports 8 condition types:
 * - flag: Check if a flag is set/unset
 * - stat: Compare a stat value
 * - item: Check inventory for items
 * - faction: Compare faction standing
 * - visited: Check if a node was visited
 * - not: Negate a condition
 * - and: All conditions must be true
 * - or: Any condition must be true
 *
 * @module engine/conditions
 */

import type { Condition, GameState } from './types';
import { EngineError } from './errors';

type ComparisonOperator = '==' | '!=' | '>' | '>=' | '<' | '<=';

function compareNumeric(
  left: number,
  operator: ComparisonOperator,
  right: number
): boolean {
  switch (operator) {
    case '==':
      return left === right;
    case '!=':
      return left !== right;
    case '>':
      return left > right;
    case '>=':
      return left >= right;
    case '<':
      return left < right;
    case '<=':
      return left <= right;
    default:
      throw new EngineError(
        'INVALID_CONDITION',
        `Unknown comparison operator: ${operator as string}`
      );
  }
}

/**
 * Evaluates a single condition against the current game state.
 *
 * @param condition - The condition to evaluate
 * @param state - The current game state
 * @returns true if the condition is satisfied, false otherwise
 * @throws EngineError if the condition type is unknown
 */
export function evaluateCondition(
  condition: Condition,
  state: GameState
): boolean {
  switch (condition.type) {
    case 'flag':
      return (state.flags[condition.flag] ?? false) === condition.value;

    case 'stat': {
      const statValue = state.stats[condition.stat] ?? 0;
      return compareNumeric(statValue, condition.operator, condition.value);
    }

    case 'item': {
      const entry = state.inventory.find((e) => e.itemId === condition.itemId);
      const count = entry?.quantity ?? 0;

      if (condition.operator === 'has') {
        return count > 0;
      } else if (condition.operator === 'lacks') {
        return count === 0;
      } else if (condition.operator === 'count') {
        return count >= (condition.count ?? 1);
      }
      return false;
    }

    case 'faction': {
      const factionValue = state.factions[condition.faction] ?? 50;
      return compareNumeric(
        factionValue,
        condition.operator,
        condition.value
      );
    }

    case 'visited': {
      const hasVisited = state.visitedNodes.includes(condition.nodeId);
      return hasVisited === condition.value;
    }

    case 'not':
      return !evaluateCondition(condition.condition, state);

    case 'and':
      return condition.conditions.every((c) => evaluateCondition(c, state));

    case 'or':
      return condition.conditions.some((c) => evaluateCondition(c, state));

    default:
      throw new EngineError(
        'INVALID_CONDITION',
        `Unknown condition type: ${(condition as Condition).type}`
      );
  }
}

/**
 * Evaluates an array of conditions (AND logic).
 * An empty or undefined array returns true.
 *
 * @param conditions - Array of conditions to evaluate
 * @param state - The current game state
 * @returns true if all conditions pass
 */
export function evaluateConditions(
  conditions: Condition[] | undefined,
  state: GameState
): boolean {
  if (!conditions || conditions.length === 0) {
    return true;
  }
  return conditions.every((c) => evaluateCondition(c, state));
}

/**
 * Returns a list of choice IDs that are currently available
 * based on their conditions.
 *
 * @param choices - Array of choices to filter
 * @param state - The current game state
 * @returns Array of choice IDs that pass their conditions
 */
export function getAvailableChoices(
  choices: Array<{ id: string; conditions?: Condition[] }>,
  state: GameState
): string[] {
  return choices
    .filter((choice) => evaluateConditions(choice.conditions, state))
    .map((choice) => choice.id);
}
