/**
 * Unit tests for the game engine.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameEngine, createGameEngine } from '../game-engine';
import { JsonContentLoader } from '../content-loader';
import type { ContentManifest, GameState, GameEvent } from '../types';

const SAMPLE_CONTENT: ContentManifest = {
  schemaVersion: '1.0.0',
  nodes: [
    {
      id: 'START',
      title: 'Start',
      body: 'Welcome to the game.',
      choices: [
        {
          id: 'go_north',
          text: 'Go north',
          targetId: 'NORTH',
          effects: [{ type: 'setFlag', flag: 'WENT_NORTH' }],
        },
        {
          id: 'go_south',
          text: 'Go south',
          targetId: 'SOUTH',
          conditions: [{ type: 'flag', flag: 'HAS_KEY', value: true }],
        },
      ],
    },
    {
      id: 'NORTH',
      title: 'North Room',
      body: 'You are in the north room.',
      choices: [
        {
          id: 'go_back',
          text: 'Go back',
          targetId: 'START',
        },
        {
          id: 'find_key',
          text: 'Search for key',
          targetId: 'NORTH',
          effects: [{ type: 'setFlag', flag: 'HAS_KEY' }],
        },
      ],
      onEnter: [{ type: 'setFlag', flag: 'VISITED_NORTH' }],
    },
    {
      id: 'SOUTH',
      title: 'South Room',
      body: 'You are in the south room.',
      choices: [
        {
          id: 'go_ending',
          text: 'Continue to ending',
          targetId: 'ENDING',
        },
      ],
    },
    {
      id: 'ENDING',
      title: 'The End',
      body: 'You have reached the end.',
      choices: [],
      tags: ['ending'],
    },
  ],
  items: [
    {
      id: 'ITEM_POTION',
      name: 'Potion',
      description: 'Heals 25 HP',
      stackable: true,
      usable: true,
      consumable: true,
      onUse: [{ type: 'modifyStat', stat: 'health', delta: 25 }],
    },
  ],
  initialState: {
    currentNodeId: 'START',
    flags: {},
    stats: { health: 100, maxHealth: 100 },
    inventory: [],
    factions: {},
  },
};

describe('GameEngine', () => {
  let contentLoader: JsonContentLoader;
  let engine: GameEngine;
  let stateChanges: GameState[];
  let events: GameEvent[];

  beforeEach(() => {
    contentLoader = new JsonContentLoader();
    contentLoader.loadManifest(SAMPLE_CONTENT);
    stateChanges = [];
    events = [];

    engine = createGameEngine({
      contentLoader,
      onStateChange: (state) => stateChanges.push({ ...state }),
      onEvent: (event) => events.push(event),
    });
  });

  describe('initialization', () => {
    it('starts in IDLE phase', () => {
      expect(engine.getPhase()).toBe('IDLE');
      expect(engine.getGameState()).toBeNull();
    });

    it('throws if starting game without content loaded', () => {
      const emptyLoader = new JsonContentLoader();
      const emptyEngine = createGameEngine({ contentLoader: emptyLoader });
      expect(() => emptyEngine.startNewGame()).toThrow('content not loaded');
    });
  });

  describe('startNewGame', () => {
    it('initializes game state from content', () => {
      engine.startNewGame();

      expect(engine.getPhase()).toBe('DISPLAY_NODE');
      expect(engine.getGameState()).not.toBeNull();
      expect(engine.getGameState()?.currentNodeId).toBe('START');
    });

    it('emits game_started event', () => {
      engine.startNewGame();

      expect(events.some((e) => e.type === 'game_started')).toBe(true);
    });

    it('marks start node as visited', () => {
      engine.startNewGame();

      expect(engine.getGameState()?.visitedNodes).toContain('START');
    });

    it('notifies state change', () => {
      engine.startNewGame();

      expect(stateChanges.length).toBeGreaterThan(0);
    });
  });

  describe('getCurrentNode', () => {
    it('returns null when no game started', () => {
      expect(engine.getCurrentNode()).toBeNull();
    });

    it('returns current node when game is active', () => {
      engine.startNewGame();
      const node = engine.getCurrentNode();

      expect(node).not.toBeNull();
      expect(node?.id).toBe('START');
      expect(node?.title).toBe('Start');
    });
  });

  describe('getAvailableChoices', () => {
    it('returns empty array when no game started', () => {
      expect(engine.getAvailableChoices()).toEqual([]);
    });

    it('returns choices that pass conditions', () => {
      engine.startNewGame();
      const choices = engine.getAvailableChoices();

      // Should only have 'go_north' since 'go_south' requires HAS_KEY
      expect(choices).toHaveLength(1);
      expect(choices[0]!.id).toBe('go_north');
    });

    it('updates available choices when conditions change', () => {
      engine.startNewGame();
      expect(engine.getAvailableChoices()).toHaveLength(1);

      // Go north, find key, go back
      engine.makeChoice('go_north');
      engine.makeChoice('find_key');
      engine.makeChoice('go_back');

      // Now both choices should be available
      const choices = engine.getAvailableChoices();
      expect(choices).toHaveLength(2);
    });
  });

  describe('makeChoice', () => {
    it('transitions to target node', () => {
      engine.startNewGame();
      engine.makeChoice('go_north');

      expect(engine.getGameState()?.currentNodeId).toBe('NORTH');
      expect(engine.getGameState()?.previousNodeId).toBe('START');
    });

    it('applies choice effects', () => {
      engine.startNewGame();
      engine.makeChoice('go_north');

      expect(engine.getGameState()?.flags.WENT_NORTH).toBe(true);
    });

    it('applies onEnter effects of target node', () => {
      engine.startNewGame();
      engine.makeChoice('go_north');

      expect(engine.getGameState()?.flags.VISITED_NORTH).toBe(true);
    });

    it('records choice in choicesMade', () => {
      engine.startNewGame();
      engine.makeChoice('go_north');

      const choicesMade = engine.getGameState()?.choicesMade;
      expect(choicesMade).toHaveLength(1);
      expect(choicesMade![0]!.nodeId).toBe('START');
      expect(choicesMade![0]!.choiceId).toBe('go_north');
    });

    it('adds target node to visitedNodes', () => {
      engine.startNewGame();
      engine.makeChoice('go_north');

      expect(engine.getGameState()?.visitedNodes).toContain('NORTH');
    });

    it('emits node_entered event', () => {
      engine.startNewGame();
      events = []; // Clear startup events
      engine.makeChoice('go_north');

      expect(events.some((e) => e.type === 'node_entered')).toBe(true);
    });

    it('throws for invalid choice ID', () => {
      engine.startNewGame();
      expect(() => engine.makeChoice('invalid_choice')).toThrow('Choice not found');
    });

    it('throws when conditions not met', () => {
      engine.startNewGame();
      // go_south requires HAS_KEY flag
      expect(() => engine.makeChoice('go_south')).toThrow('conditions not met');
    });

    it('throws when no game in progress', () => {
      expect(() => engine.makeChoice('go_north')).toThrow('No game in progress');
    });
  });

  describe('ending detection', () => {
    it('transitions to END_GAME phase when reaching node with no choices', () => {
      engine.startNewGame();
      engine.makeChoice('go_north');
      engine.makeChoice('find_key');
      engine.makeChoice('go_back');
      engine.makeChoice('go_south');
      engine.makeChoice('go_ending');

      expect(engine.getPhase()).toBe('END_GAME');
    });

    it('emits game_ended event with ending info', () => {
      engine.startNewGame();
      engine.makeChoice('go_north');
      engine.makeChoice('find_key');
      engine.makeChoice('go_back');
      engine.makeChoice('go_south');
      engine.makeChoice('go_ending');

      const endEvent = events.find((e) => e.type === 'game_ended');
      expect(endEvent).toBeDefined();
      expect(endEvent?.data).toEqual({ nodeId: 'ENDING', tags: ['ending'] });
    });
  });

  describe('useItem', () => {
    it('throws when item not in inventory', () => {
      engine.startNewGame();
      expect(() => engine.useItem('ITEM_POTION')).toThrow('not in inventory');
    });

    it('applies item onUse effects', () => {
      engine.startNewGame();

      // Manually add potion to inventory for testing
      const state = engine.getGameState()!;
      engine.loadGameState({
        ...state,
        inventory: [{ itemId: 'ITEM_POTION', quantity: 2 }],
        stats: { ...state.stats, health: 50 },
      });

      engine.useItem('ITEM_POTION');

      expect(engine.getGameState()?.stats.health).toBe(75);
    });

    it('removes consumable item after use', () => {
      engine.startNewGame();

      const state = engine.getGameState()!;
      engine.loadGameState({
        ...state,
        inventory: [{ itemId: 'ITEM_POTION', quantity: 2 }],
      });

      engine.useItem('ITEM_POTION');

      const inventory = engine.getGameState()?.inventory;
      expect(inventory?.find((e) => e.itemId === 'ITEM_POTION')?.quantity).toBe(1);
    });

    it('emits item_used event', () => {
      engine.startNewGame();

      const state = engine.getGameState()!;
      engine.loadGameState({
        ...state,
        inventory: [{ itemId: 'ITEM_POTION', quantity: 1 }],
      });

      events = [];
      engine.useItem('ITEM_POTION');

      const itemEvent = events.find((e) => e.type === 'item_used');
      expect(itemEvent).toBeDefined();
      expect(itemEvent?.data).toEqual({ itemId: 'ITEM_POTION', consumed: true });
    });
  });

  describe('loadGameState', () => {
    it('loads game state from save', () => {
      const savedState: GameState = {
        currentNodeId: 'NORTH',
        previousNodeId: 'START',
        flags: { WENT_NORTH: true, VISITED_NORTH: true },
        stats: { health: 75, maxHealth: 100 },
        inventory: [],
        factions: {},
        visitedNodes: ['START', 'NORTH'],
        choicesMade: [{ nodeId: 'START', choiceId: 'go_north', timestamp: 1000 }],
        isTransitioning: false,
        pendingEffects: [],
      };

      engine.loadGameState(savedState);

      expect(engine.getPhase()).toBe('DISPLAY_NODE');
      expect(engine.getGameState()?.currentNodeId).toBe('NORTH');
      expect(engine.getGameState()?.flags.WENT_NORTH).toBe(true);
    });

    it('emits game_loaded event', () => {
      const savedState: GameState = {
        currentNodeId: 'START',
        previousNodeId: null,
        flags: {},
        stats: {},
        inventory: [],
        factions: {},
        visitedNodes: ['START'],
        choicesMade: [],
        isTransitioning: false,
        pendingEffects: [],
      };

      engine.loadGameState(savedState);

      expect(events.some((e) => e.type === 'game_loaded')).toBe(true);
    });

    it('throws if current node does not exist', () => {
      const savedState: GameState = {
        currentNodeId: 'NONEXISTENT',
        previousNodeId: null,
        flags: {},
        stats: {},
        inventory: [],
        factions: {},
        visitedNodes: [],
        choicesMade: [],
        isTransitioning: false,
        pendingEffects: [],
      };

      expect(() => engine.loadGameState(savedState)).toThrow('Node not found');
    });
  });

  describe('doom state checks', () => {
    it('checkDoomState returns false initially', () => {
      engine.startNewGame();
      expect(engine.checkDoomState()).toBe(false);
    });

    it('checkDoomState returns true when DOOM_SEALED flag is set', () => {
      engine.startNewGame();
      const state = engine.getGameState()!;
      engine.loadGameState({
        ...state,
        flags: { ...state.flags, DOOM_SEALED: true },
      });

      expect(engine.checkDoomState()).toBe(true);
    });

    it('checkHealthDeath returns false with positive health', () => {
      engine.startNewGame();
      expect(engine.checkHealthDeath()).toBe(false);
    });

    it('checkHealthDeath returns true with zero health', () => {
      engine.startNewGame();
      const state = engine.getGameState()!;
      engine.loadGameState({
        ...state,
        stats: { ...state.stats, health: 0 },
      });

      expect(engine.checkHealthDeath()).toBe(true);
    });

    it('checkForcedEnding returns death ending when doomed', () => {
      engine.startNewGame();
      const state = engine.getGameState()!;
      engine.loadGameState({
        ...state,
        flags: { DOOM_SEALED: true },
      });

      expect(engine.checkForcedEnding()).toBe('ACT3_END_DEATH');
    });
  });

  describe('event handling', () => {
    it('allows subscribing to events', () => {
      const handler = vi.fn();
      engine.addEventListener(handler);

      engine.startNewGame();

      expect(handler).toHaveBeenCalled();
    });

    it('returns unsubscribe function', () => {
      const handler = vi.fn();
      const unsubscribe = engine.addEventListener(handler);

      engine.startNewGame();
      const callCount = handler.mock.calls.length;

      unsubscribe();
      engine.makeChoice('go_north');

      // Handler should not have been called again after unsubscribe
      expect(handler.mock.calls.length).toBe(callCount);
    });
  });

  describe('reset', () => {
    it('returns engine to IDLE state', () => {
      engine.startNewGame();
      engine.makeChoice('go_north');
      engine.reset();

      expect(engine.getPhase()).toBe('IDLE');
      expect(engine.getGameState()).toBeNull();
    });
  });
});
