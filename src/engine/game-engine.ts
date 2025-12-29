/**
 * Game Engine - Core state machine and game loop.
 * Based on ENGINE.md specification v1.0.0
 *
 * State Machine:
 *   IDLE → LOADING → DISPLAY_NODE → AWAIT_CHOICE → CHOICE_MADE → APPLY_EFFECTS → DISPLAY_NODE
 *                                                                              ↓
 *                                                                          END_GAME
 *
 * @module engine/game-engine
 */

import type {
  EnginePhase,
  GameState,
  Node,
  Choice,
  GameEvent,
  GameEventHandler,
  Effect,
} from './types';
import { EngineError } from './errors';
import { evaluateConditions, getAvailableChoices } from './conditions';
import { applyEffects, type EffectContext } from './effects';
import type { ContentLoader } from './content-loader';

export interface GameEngineConfig {
  contentLoader: ContentLoader;
  onStateChange?: (state: GameState) => void;
  onPhaseChange?: (phase: EnginePhase) => void;
  onEvent?: GameEventHandler;
  onError?: (error: EngineError) => void;
}

export interface GameEngineState {
  phase: EnginePhase;
  gameState: GameState | null;
  currentNode: Node | null;
  availableChoices: Choice[];
  error: EngineError | null;
}

export class GameEngine {
  private phase: EnginePhase = 'IDLE';
  private gameState: GameState | null = null;
  private readonly contentLoader: ContentLoader;
  private readonly onStateChange: ((state: GameState) => void) | undefined;
  private readonly onPhaseChange: ((phase: EnginePhase) => void) | undefined;
  private readonly onEvent: GameEventHandler | undefined;
  private readonly onError: ((error: EngineError) => void) | undefined;
  private readonly eventHandlers: Set<GameEventHandler> = new Set();

  constructor(config: GameEngineConfig) {
    this.contentLoader = config.contentLoader;
    this.onStateChange = config.onStateChange;
    this.onPhaseChange = config.onPhaseChange;
    this.onEvent = config.onEvent;
    this.onError = config.onError;
  }

  /**
   * Gets the current engine state snapshot.
   */
  getState(): GameEngineState {
    const currentNode = this.gameState
      ? this.tryGetNode(this.gameState.currentNodeId)
      : null;

    const availableChoices = this.gameState && currentNode
      ? this.getFilteredChoices(currentNode, this.gameState)
      : [];

    return {
      phase: this.phase,
      gameState: this.gameState ? { ...this.gameState } : null,
      currentNode,
      availableChoices,
      error: null,
    };
  }

  /**
   * Gets the current phase.
   */
  getPhase(): EnginePhase {
    return this.phase;
  }

  /**
   * Gets the current game state (or null if not started).
   */
  getGameState(): GameState | null {
    return this.gameState;
  }

  /**
   * Starts a new game from the initial state.
   */
  startNewGame(): void {
    if (!this.contentLoader.isLoaded()) {
      throw new EngineError(
        'CONTENT_NOT_LOADED',
        'Cannot start game: content not loaded'
      );
    }

    this.setPhase('LOADING');

    try {
      this.gameState = this.contentLoader.createInitialGameState();
      this.notifyStateChange();

      // Verify start node exists
      const startNode = this.contentLoader.getNode(this.gameState.currentNodeId);

      // Apply onEnter effects for the start node
      if (startNode.onEnter && startNode.onEnter.length > 0) {
        this.gameState = this.applyEffectsToState(this.gameState, startNode.onEnter);
        this.notifyStateChange();
      }

      this.setPhase('DISPLAY_NODE');
      this.emitEvent({ type: 'game_started', data: null, timestamp: Date.now() });
    } catch (error) {
      this.handleError(error as EngineError);
    }
  }

  /**
   * Loads a game state (e.g., from a save file).
   */
  loadGameState(state: GameState): void {
    if (!this.contentLoader.isLoaded()) {
      throw new EngineError(
        'CONTENT_NOT_LOADED',
        'Cannot load game: content not loaded'
      );
    }

    this.setPhase('LOADING');

    try {
      // Verify the current node exists
      this.contentLoader.getNode(state.currentNodeId);

      this.gameState = {
        ...state,
        isTransitioning: false,
        pendingEffects: [],
      };
      this.notifyStateChange();

      this.setPhase('DISPLAY_NODE');
      this.emitEvent({ type: 'game_loaded', data: null, timestamp: Date.now() });
    } catch (error) {
      this.handleError(error as EngineError);
    }
  }

  /**
   * Gets the current node.
   */
  getCurrentNode(): Node | null {
    if (!this.gameState) return null;
    return this.tryGetNode(this.gameState.currentNodeId);
  }

  /**
   * Gets choices available in the current state.
   */
  getAvailableChoices(): Choice[] {
    if (!this.gameState) return [];

    const node = this.getCurrentNode();
    if (!node) return [];

    return this.getFilteredChoices(node, this.gameState);
  }

  /**
   * Makes a choice, transitioning to the target node.
   *
   * @param choiceId - The ID of the choice to make
   * @throws EngineError if choice is invalid or conditions not met
   */
  makeChoice(choiceId: string): void {
    if (!this.gameState) {
      throw new EngineError('INVALID_STATE', 'No game in progress');
    }

    if (this.phase !== 'DISPLAY_NODE' && this.phase !== 'AWAIT_CHOICE') {
      throw new EngineError(
        'INVALID_STATE',
        `Cannot make choice in phase: ${this.phase}`
      );
    }

    const node = this.getCurrentNode();
    if (!node) {
      throw new EngineError('INVALID_NODE', 'Current node not found');
    }

    const choice = node.choices.find((c) => c.id === choiceId);
    if (!choice) {
      throw new EngineError('INVALID_CHOICE', `Choice not found: ${choiceId}`, {
        choiceId,
        nodeId: node.id,
      });
    }

    // Verify conditions are met
    if (!evaluateConditions(choice.conditions, this.gameState)) {
      throw new EngineError(
        'CONDITION_FAILED',
        'Choice conditions not met',
        { choiceId, nodeId: node.id }
      );
    }

    this.setPhase('CHOICE_MADE');

    try {
      let newState = { ...this.gameState, isTransitioning: true };

      // Apply choice effects
      if (choice.effects && choice.effects.length > 0) {
        this.setPhase('APPLY_EFFECTS');
        newState = this.applyEffectsToState(newState, choice.effects);
      }

      // Get target node
      const targetNode = this.contentLoader.getNode(choice.targetId);

      // Record the choice
      newState = {
        ...newState,
        previousNodeId: this.gameState.currentNodeId,
        currentNodeId: choice.targetId,
        visitedNodes: [...this.gameState.visitedNodes, choice.targetId],
        choicesMade: [
          ...this.gameState.choicesMade,
          {
            nodeId: this.gameState.currentNodeId,
            choiceId: choiceId,
            timestamp: Date.now(),
          },
        ],
      };

      // Apply target node's onEnter effects
      if (targetNode.onEnter && targetNode.onEnter.length > 0) {
        newState = this.applyEffectsToState(newState, targetNode.onEnter);
      }

      newState.isTransitioning = false;
      this.gameState = newState;
      this.notifyStateChange();

      // Check for game end (no choices = ending)
      if (targetNode.choices.length === 0) {
        this.setPhase('END_GAME');
        this.emitEvent({
          type: 'game_ended',
          data: { nodeId: targetNode.id, tags: targetNode.tags },
          timestamp: Date.now(),
        });
      } else {
        this.setPhase('DISPLAY_NODE');
      }

      this.emitEvent({
        type: 'node_entered',
        data: { nodeId: targetNode.id },
        timestamp: Date.now(),
      });
    } catch (error) {
      this.handleError(error as EngineError);
    }
  }

  /**
   * Checks doom state conditions from STORY.md.
   */
  checkDoomState(): boolean {
    if (!this.gameState) return false;
    return this.gameState.flags['DOOM_SEALED'] === true;
  }

  /**
   * Checks if player has died from health.
   */
  checkHealthDeath(): boolean {
    if (!this.gameState) return false;
    return (this.gameState.stats.health ?? 100) <= 0;
  }

  /**
   * Checks for forced ending conditions.
   * Returns the ending node ID if forced, null otherwise.
   */
  checkForcedEnding(): string | null {
    if (this.checkDoomState() || this.checkHealthDeath()) {
      return 'ACT3_END_DEATH';
    }
    return null;
  }

  /**
   * Uses an item from inventory.
   *
   * @param itemId - The ID of the item to use
   * @throws EngineError if item not found or not usable
   */
  useItem(itemId: string): void {
    if (!this.gameState) {
      throw new EngineError('INVALID_STATE', 'No game in progress');
    }

    const inventoryEntry = this.gameState.inventory.find(
      (e) => e.itemId === itemId
    );
    if (!inventoryEntry || inventoryEntry.quantity <= 0) {
      throw new EngineError('INVALID_ITEM', `Item not in inventory: ${itemId}`, {
        itemId,
      });
    }

    const item = this.contentLoader.getItem(itemId);
    if (!item.usable) {
      throw new EngineError('INVALID_ITEM', `Item is not usable: ${itemId}`, {
        itemId,
      });
    }

    let newState = { ...this.gameState };

    // Apply onUse effects
    if (item.onUse && item.onUse.length > 0) {
      newState = this.applyEffectsToState(newState, item.onUse);
    }

    // Remove item if consumable
    if (item.consumable) {
      newState = {
        ...newState,
        inventory: newState.inventory
          .map((e) =>
            e.itemId === itemId ? { ...e, quantity: e.quantity - 1 } : e
          )
          .filter((e) => e.quantity > 0),
      };
    }

    this.gameState = newState;
    this.notifyStateChange();

    this.emitEvent({
      type: 'item_used',
      data: { itemId, consumed: item.consumable },
      timestamp: Date.now(),
    });
  }

  /**
   * Subscribes to game events.
   */
  addEventListener(handler: GameEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /**
   * Resets the engine to idle state.
   */
  reset(): void {
    this.gameState = null;
    this.setPhase('IDLE');
  }

  // --- Private methods ---

  private setPhase(phase: EnginePhase): void {
    if (this.phase !== phase) {
      this.phase = phase;
      this.onPhaseChange?.(phase);
    }
  }

  private notifyStateChange(): void {
    if (this.gameState) {
      this.onStateChange?.({ ...this.gameState });
    }
  }

  private emitEvent(event: GameEvent): void {
    this.onEvent?.(event);
    this.eventHandlers.forEach((handler) => handler(event));
  }

  private handleError(error: EngineError): void {
    this.setPhase('ERROR');
    this.onError?.(error);
    throw error;
  }

  private tryGetNode(nodeId: string): Node | null {
    try {
      return this.contentLoader.getNode(nodeId);
    } catch {
      return null;
    }
  }

  private getFilteredChoices(node: Node, state: GameState): Choice[] {
    const availableIds = getAvailableChoices(node.choices, state);
    return node.choices.filter((c) => availableIds.includes(c.id));
  }

  private applyEffectsToState(state: GameState, effects: Effect[]): GameState {
    const context: EffectContext = {
      getItem: (itemId) => {
        try {
          return this.contentLoader.getItem(itemId);
        } catch {
          return undefined;
        }
      },
      emitEvent: (event) => this.emitEvent(event),
    };

    return applyEffects(state, effects, context);
  }
}

/**
 * Creates a new game engine instance.
 */
export function createGameEngine(config: GameEngineConfig): GameEngine {
  return new GameEngine(config);
}
