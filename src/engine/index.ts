/**
 * Game Engine Module
 *
 * Core engine for the gamebook, implementing:
 * - State machine and game loop
 * - Content loading and validation
 * - Condition evaluation
 * - Effect application
 * - Error handling
 *
 * Based on ENGINE.md specification v1.0.0
 *
 * @module engine
 */

// Types
export * from './types';

// Errors
export { EngineError, getRecoveryOptions } from './errors';
export type { ErrorRecovery } from './errors';

// Conditions
export {
  evaluateCondition,
  evaluateConditions,
  getAvailableChoices,
} from './conditions';

// Effects
export {
  applyEffect,
  applyEffects,
  createDefaultContext,
} from './effects';
export type { EffectContext } from './effects';

// Content Loader
export {
  JsonContentLoader,
  createContentLoader,
} from './content-loader';
export type { ContentLoader } from './content-loader';

// Game Engine
export {
  GameEngine,
  createGameEngine,
} from './game-engine';
export type { GameEngineConfig, GameEngineState } from './game-engine';
