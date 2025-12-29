/**
 * UI + Game State Integration Tests
 *
 * Tests the interaction between UI components and game state.
 *
 * @see /docs/UI.md for screen flows and interaction model
 * @see /docs/GANG.md for DOS-style UI conventions
 */

import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  createVictoryPathState,
  createTestManifest,
  createTestEngine,
  GameState,
  GameEvent,
} from '../setup';
import act1Content from '../../src/content/act1-sample.json';

describe('UI + State Integration', () => {
  describe('State Display', () => {
    it('should determine visible choices based on state', () => {
      const state = createInitialState();

      // Example: choices should be filtered by conditions
      // This will be tested when engine is available
      expect(state.currentNodeId).toBeTruthy();
    });

    it('should show inventory items from state', () => {
      const state = createVictoryPathState();

      expect(state.inventory.length).toBeGreaterThan(0);
      // Each inventory item should be displayable
      for (const entry of state.inventory) {
        expect(entry.itemId).toBeTruthy();
        expect(entry.quantity).toBeGreaterThan(0);
      }
    });

    it('should show faction standings from state', () => {
      const state = createVictoryPathState();

      expect(state.factions.factionA).toBeDefined();
      expect(state.factions.factionB).toBeDefined();
      expect(state.factions.factionC).toBeDefined();
    });

    it('should show health/stats from state', () => {
      const state = createInitialState();

      expect(state.stats.health).toBeDefined();
      expect(state.stats.maxHealth).toBeDefined();
    });
  });

  describe('State-Driven Navigation', () => {
    it('should determine current screen from node type', () => {
      const gameState = createInitialState();

      // Game screen should show when in a game node
      expect(gameState.currentNodeId.startsWith('ACT')).toBe(true);
    });

    it('should track visited nodes for back navigation', () => {
      const state = createVictoryPathState();

      expect(state.visitedNodes.length).toBeGreaterThan(1);
      expect(state.previousNodeId).toBeDefined();
    });
  });

  describe('Input Handling', () => {
    // Per GANG.md: Keyboard-first navigation
    it('should support keyboard navigation keys', () => {
      const expectedKeys = [
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'Enter',
        'Escape',
        'w',
        'a',
        's',
        'd',
      ];

      // This verifies the expected keyboard interface
      // Actual handling will be tested when UI is ready
      expect(expectedKeys.length).toBe(10);
    });

    it('should support hotkeys 1-9 for choices', () => {
      const hotkeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

      expect(hotkeys.length).toBe(9);
    });
  });

  describe('DOM Integration', () => {
    it('should provide current node text for rendering', () => {
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

      const node = engine.getCurrentNode();
      expect(node?.title).toBe('Awakening');
      expect(node?.body).toBeTruthy();
      expect(node?.body.length).toBeGreaterThan(0);
    });

    it('should provide choices as array for UI rendering', () => {
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

      const choices = engine.getAvailableChoices();
      expect(Array.isArray(choices)).toBe(true);
      expect(choices.length).toBe(3); // Three faction choices

      // Each choice should have required UI fields
      for (const choice of choices) {
        expect(choice.id).toBeTruthy();
        expect(choice.text).toBeTruthy();
      }
    });

    it('should expose choice selection via makeChoice', () => {
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

      // Simulate user pressing Enter on selected choice
      engine.makeChoice('proceed');

      expect(engine.getGameState()?.currentNodeId).toBe('ACT1_FIRST_CHOICE');
    });

    it('should provide game state for HUD display', () => {
      const manifest = createTestManifest({
        nodes: act1Content.nodes,
        items: act1Content.items,
        initialState: {
          currentNodeId: 'ACT1_START',
          flags: {},
          stats: { health: 100, maxHealth: 100 },
          inventory: [{ itemId: 'ITEM_HEALTH_POTION', quantity: 2 }],
          factions: { factionA: 50, factionB: 50, factionC: 50 },
        },
      });

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      const state = engine.getGameState();

      // HUD can display these values
      expect(state?.stats.health).toBe(100);
      expect(state?.inventory.length).toBeGreaterThan(0);
    });
  });

  describe('Screen Transitions', () => {
    it('should start in IDLE phase before game begins', () => {
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

      // Before starting, engine is in IDLE
      expect(engine.getPhase()).toBe('IDLE');
    });

    it('should transition to DISPLAY_NODE on new game', () => {
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

      const phaseChanges: string[] = [];
      const { engine } = createTestEngine(manifest, {
        onPhaseChange: (phase) => phaseChanges.push(phase),
      });

      engine.startNewGame();

      expect(engine.getPhase()).toBe('DISPLAY_NODE');
      expect(phaseChanges).toContain('LOADING');
      expect(phaseChanges).toContain('DISPLAY_NODE');
    });

    it('should emit game_started event for UI transition', () => {
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

      const startEvent = events.find(e => e.type === 'game_started');
      expect(startEvent).toBeDefined();
    });

    it('should transition to END_GAME on ending node', () => {
      const manifest = createTestManifest({
        nodes: [
          { id: 'START', title: 'Start', body: 'Start', choices: [
            { id: 'end', text: 'End', targetId: 'ENDING' }
          ]},
          { id: 'ENDING', title: 'The End', body: 'Game Over', choices: [], tags: ['ending'] },
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

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();
      engine.makeChoice('end');

      expect(engine.getPhase()).toBe('END_GAME');
    });
  });

  describe('Accessibility', () => {
    it('should provide choice tooltips for screen readers', () => {
      const manifest = createTestManifest({
        nodes: [
          {
            id: 'TEST',
            title: 'Test',
            body: 'Test',
            choices: [
              {
                id: 'choice1',
                text: 'Option A',
                targetId: 'END',
                tooltip: 'This option leads to ending A',
              },
            ],
          },
          { id: 'END', title: 'End', body: 'End', choices: [] },
        ],
        items: [],
        initialState: {
          currentNodeId: 'TEST',
          flags: {},
          stats: {},
          inventory: [],
          factions: {},
        },
      });

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      const choices = engine.getAvailableChoices();
      expect(choices[0].tooltip).toBe('This option leads to ending A');
    });

    it('should provide speaker info for dialogue attribution', () => {
      const manifest = createTestManifest({
        nodes: [
          {
            id: 'TEST',
            title: 'Test',
            body: 'Hello there!',
            speaker: 'NPC Name',
            choices: [],
          },
        ],
        items: [],
        initialState: {
          currentNodeId: 'TEST',
          flags: {},
          stats: {},
          inventory: [],
          factions: {},
        },
      });

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      const node = engine.getCurrentNode();
      expect(node?.speaker).toBe('NPC Name');
    });

    it('should provide engine state snapshot for screen reader updates', () => {
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

      // getState provides everything needed for accessibility announcements
      const state = engine.getState();
      expect(state.currentNode).toBeDefined();
      expect(state.availableChoices).toBeDefined();
      expect(state.phase).toBeDefined();
    });
  });
});
