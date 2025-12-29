/**
 * Content Loader + Engine Integration Tests
 *
 * Tests the interaction between content loading and engine processing.
 *
 * @see /docs/ENGINE.md for state machine and content schema
 * @see /docs/QA.md for integration test requirements
 */

import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  createMockContentLoader,
  createTestNode,
  createTestManifest,
  createTestEngine,
  GameState,
  GameEvent,
} from '../setup';
import act1Content from '../../src/content/act1-sample.json';

describe('Content + Engine Integration', () => {
  describe('Node Loading', () => {
    it('should load nodes from content loader', () => {
      const loader = createMockContentLoader();
      loader.addNode(createTestNode({ id: 'ACT1_START', title: 'The Beginning' }));

      expect(loader.hasNode('ACT1_START')).toBe(true);
      expect(loader.getNode('ACT1_START')?.title).toBe('The Beginning');
    });

    it('should return undefined for missing nodes', () => {
      const loader = createMockContentLoader();

      expect(loader.hasNode('NONEXISTENT')).toBe(false);
      expect(loader.getNode('NONEXISTENT')).toBeUndefined();
    });

    it('should list all loaded nodes', () => {
      const loader = createMockContentLoader();
      loader.addNode(createTestNode({ id: 'NODE_1' }));
      loader.addNode(createTestNode({ id: 'NODE_2' }));
      loader.addNode(createTestNode({ id: 'NODE_3' }));

      const allNodes = loader.getAllNodes();
      expect(allNodes).toHaveLength(3);
    });
  });

  describe('Choice Target Resolution', () => {
    it('should resolve choice targets to valid nodes', () => {
      const loader = createMockContentLoader();
      loader.addNode(
        createTestNode({
          id: 'ACT1_START',
          choices: [
            { id: 'go_north', text: 'Go north', targetId: 'ACT1_NORTH' },
            { id: 'go_south', text: 'Go south', targetId: 'ACT1_SOUTH' },
          ],
        })
      );
      loader.addNode(createTestNode({ id: 'ACT1_NORTH' }));
      loader.addNode(createTestNode({ id: 'ACT1_SOUTH' }));

      const startNode = loader.getNode('ACT1_START');
      expect(startNode?.choices).toHaveLength(2);

      for (const choice of startNode?.choices ?? []) {
        expect(loader.hasNode(choice.targetId)).toBe(true);
      }
    });

    it('should detect invalid choice targets', () => {
      const loader = createMockContentLoader();
      loader.addNode(
        createTestNode({
          id: 'ACT1_START',
          choices: [
            { id: 'broken', text: 'Broken link', targetId: 'NONEXISTENT' },
          ],
        })
      );

      const startNode = loader.getNode('ACT1_START');
      const brokenChoice = startNode?.choices[0];

      expect(brokenChoice?.targetId).toBe('NONEXISTENT');
      expect(loader.hasNode(brokenChoice?.targetId ?? '')).toBe(false);
    });
  });

  describe('State Initialization', () => {
    it('should initialize state with valid start node', () => {
      const loader = createMockContentLoader();
      loader.addNode(createTestNode({ id: 'ACT1_START' }));

      const state = createInitialState();

      expect(state.currentNodeId).toBe('ACT1_START');
      expect(loader.hasNode(state.currentNodeId)).toBe(true);
    });

    it('should track visited nodes', () => {
      const state = createInitialState();

      expect(state.visitedNodes).toContain('ACT1_START');
      expect(state.visitedNodes).toHaveLength(1);
    });
  });

  describe('Engine Choice Processing', () => {
    it('should transition state when processing valid choice', () => {
      const manifest = createTestManifest({
        nodes: act1Content.nodes,
        items: act1Content.items,
        initialState: {
          currentNodeId: 'ACT1_START',
          flags: {},
          stats: { health: 100 },
          inventory: [],
          factions: { factionA: 50, factionB: 50, factionC: 50 },
        },
      });

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      expect(engine.getGameState()?.currentNodeId).toBe('ACT1_START');

      // Make a choice to proceed
      engine.makeChoice('proceed');

      expect(engine.getGameState()?.currentNodeId).toBe('ACT1_FIRST_CHOICE');
      expect(engine.getGameState()?.previousNodeId).toBe('ACT1_START');
    });

    it('should apply choice effects to state', () => {
      const manifest = createTestManifest({
        nodes: act1Content.nodes,
        items: act1Content.items,
        initialState: {
          currentNodeId: 'ACT1_FIRST_CHOICE',
          flags: {},
          stats: { health: 100 },
          inventory: [],
          factions: { factionA: 50, factionB: 50, factionC: 50 },
        },
      });

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      // Choose path north - sets CHOSE_DIRECT_PATH flag
      engine.makeChoice('path_north');

      expect(engine.getGameState()?.flags.CHOSE_DIRECT_PATH).toBe(true);
    });

    it('should evaluate choice conditions against state', () => {
      const manifest = createTestManifest({
        nodes: act1Content.nodes,
        items: act1Content.items,
        initialState: {
          currentNodeId: 'ACT1_FACTION_CHOICE',
          flags: {},
          stats: { health: 100 },
          inventory: [],
          factions: { factionA: 50, factionB: 50, factionC: 50 },
        },
      });

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      // All faction choices should be available initially
      const choices = engine.getAvailableChoices();
      expect(choices.length).toBeGreaterThan(0);
      expect(choices.find(c => c.id === 'join_faction_a')).toBeDefined();
    });

    it('should reject choices that fail conditions', () => {
      const manifest = createTestManifest({
        nodes: [
          {
            id: 'TEST_NODE',
            title: 'Test',
            body: 'Test node',
            choices: [
              {
                id: 'conditional_choice',
                text: 'Requires flag',
                targetId: 'TARGET',
                conditions: [{ type: 'flag', flag: 'REQUIRED_FLAG', value: true }],
              },
            ],
          },
          { id: 'TARGET', title: 'Target', body: 'Target', choices: [] },
        ],
        items: [],
        initialState: {
          currentNodeId: 'TEST_NODE',
          flags: { REQUIRED_FLAG: false },
          stats: {},
          inventory: [],
          factions: {},
        },
      });

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      // Choice should not be available since flag is false
      const choices = engine.getAvailableChoices();
      expect(choices.find(c => c.id === 'conditional_choice')).toBeUndefined();
    });
  });

  describe('Engine Event Emission', () => {
    it('should emit events for triggerEvent effects', () => {
      const manifest = createTestManifest({
        nodes: [
          {
            id: 'START',
            title: 'Start',
            body: 'Start',
            choices: [
              {
                id: 'trigger',
                text: 'Trigger event',
                targetId: 'END',
                effects: [{ type: 'triggerEvent', event: 'custom_event', data: { test: true } }],
              },
            ],
          },
          { id: 'END', title: 'End', body: 'End', choices: [] },
        ],
        items: [],
        initialState: {
          currentNodeId: 'START',
          flags: {},
          stats: {},
          inventory: [],
          factions: {},
        },
      });

      const events: GameEvent[] = [];
      const { engine } = createTestEngine(manifest, {
        onEvent: (event) => events.push(event),
      });

      engine.startNewGame();
      engine.makeChoice('trigger');

      const customEvent = events.find(e => e.type === 'custom_event');
      expect(customEvent).toBeDefined();
      expect(customEvent?.data).toEqual({ test: true });
    });

    it('should emit state change events', () => {
      const manifest = createTestManifest({
        nodes: act1Content.nodes,
        items: act1Content.items,
        initialState: {
          currentNodeId: 'ACT1_START',
          flags: {},
          stats: { health: 100 },
          inventory: [],
          factions: { factionA: 50, factionB: 50, factionC: 50 },
        },
      });

      const stateChanges: GameState[] = [];
      const { engine } = createTestEngine(manifest, {
        onStateChange: (state) => stateChanges.push({ ...state } as GameState),
      });

      engine.startNewGame();
      engine.makeChoice('proceed');

      // Should have received state change notifications
      expect(stateChanges.length).toBeGreaterThan(0);
    });

    it('should emit node transition events', () => {
      const manifest = createTestManifest({
        nodes: act1Content.nodes,
        items: act1Content.items,
        initialState: {
          currentNodeId: 'ACT1_START',
          flags: {},
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
      engine.makeChoice('proceed');

      const nodeEnteredEvent = events.find(e => e.type === 'node_entered');
      expect(nodeEnteredEvent).toBeDefined();
      expect(nodeEnteredEvent?.data).toHaveProperty('nodeId', 'ACT1_FIRST_CHOICE');
    });
  });
});
