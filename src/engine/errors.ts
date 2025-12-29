/**
 * Engine error handling system.
 * Based on ENGINE.md specification v1.0.0
 *
 * @module engine/errors
 */

import type { EngineErrorCode } from './types';

export class EngineError extends Error {
  constructor(
    public readonly code: EngineErrorCode,
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'EngineError';
    Object.setPrototypeOf(this, EngineError.prototype);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
    };
  }
}

export interface ErrorRecovery {
  canRecover: boolean;
  action: () => void;
  message: string;
}

export function getRecoveryOptions(
  error: EngineError,
  handlers: {
    deleteSave?: (slot: number) => void;
    startNewGame?: () => void;
    navigateToNode?: (nodeId: string) => void;
    getLastValidNode?: () => string;
    clearOldestSave?: () => void;
  }
): ErrorRecovery[] {
  switch (error.code) {
    case 'SAVE_CORRUPTED':
      return [
        {
          canRecover: !!handlers.deleteSave,
          action: () => handlers.deleteSave?.(error.context?.slot as number),
          message: 'Delete corrupted save and continue',
        },
        {
          canRecover: !!handlers.startNewGame,
          action: () => handlers.startNewGame?.(),
          message: 'Start a new game',
        },
      ].filter((r) => r.canRecover);

    case 'INVALID_NODE':
      return [
        {
          canRecover: !!handlers.navigateToNode && !!handlers.getLastValidNode,
          action: () => handlers.navigateToNode?.(handlers.getLastValidNode?.() ?? ''),
          message: 'Return to last valid node',
        },
      ].filter((r) => r.canRecover);

    case 'STORAGE_FULL':
      return [
        {
          canRecover: !!handlers.clearOldestSave,
          action: () => handlers.clearOldestSave?.(),
          message: 'Delete oldest save to make room',
        },
      ].filter((r) => r.canRecover);

    default:
      return [
        {
          canRecover: !!handlers.startNewGame,
          action: () => handlers.startNewGame?.(),
          message: 'Start a new game',
        },
      ].filter((r) => r.canRecover);
  }
}
