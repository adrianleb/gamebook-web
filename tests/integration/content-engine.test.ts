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
  GameState,
} from '../setup';

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

  // TODO: Implement when engine module is ready
  describe.skip('Engine Choice Processing', () => {
    it('should transition state when processing valid choice');
    it('should apply choice effects to state');
    it('should evaluate choice conditions against state');
    it('should reject choices that fail conditions');
  });

  // TODO: Implement when engine module is ready
  describe.skip('Engine Event Emission', () => {
    it('should emit events for triggerEvent effects');
    it('should emit state change events');
    it('should emit node transition events');
  });
});
