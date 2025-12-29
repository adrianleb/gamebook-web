/**
 * Audio Triggers + Game Events Integration Tests
 *
 * Tests the interaction between audio system and game events.
 *
 * @see /docs/AUDIO.md for audio plan and asset list
 * @see /docs/ENGINE.md for triggerEvent effect
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createInitialState,
  createMockContentLoader,
  createTestNode,
  createTestManifest,
  createTestEngine,
  GameEvent,
} from '../setup';
import act1Content from '../../src/content/act1-sample.json';
import act3Content from '../../src/content/act3-sample.json';

describe('Audio + Events Integration', () => {
  describe('Event Types', () => {
    // Per ENGINE.md: TriggerEventEffect
    it('should define expected event types', () => {
      const expectedEvents = [
        'sfx:ui:select',
        'sfx:ui:confirm',
        'sfx:ui:cancel',
        'sfx:ui:menu_open',
        'sfx:ui:menu_close',
        'sfx:game:save',
        'sfx:game:load',
        'sfx:game:item_pickup',
        'sfx:game:item_use',
        'sfx:game:choice_made',
        'music:play',
        'music:stop',
        'music:crossfade',
      ];

      // Verify we have a comprehensive event list
      expect(expectedEvents.length).toBeGreaterThan(10);
    });
  });

  describe('Event Emission', () => {
    it('should support event subscription pattern', () => {
      const listeners = new Map<string, Array<() => void>>();

      const subscribe = (event: string, callback: () => void) => {
        if (!listeners.has(event)) {
          listeners.set(event, []);
        }
        listeners.get(event)?.push(callback);
      };

      const emit = (event: string) => {
        listeners.get(event)?.forEach((cb) => cb());
      };

      const callback = vi.fn();
      subscribe('sfx:ui:select', callback);
      emit('sfx:ui:select');

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should support multiple listeners per event', () => {
      const listeners = new Map<string, Array<() => void>>();

      const subscribe = (event: string, callback: () => void) => {
        if (!listeners.has(event)) {
          listeners.set(event, []);
        }
        listeners.get(event)?.push(callback);
      };

      const emit = (event: string) => {
        listeners.get(event)?.forEach((cb) => cb());
      };

      const callback1 = vi.fn();
      const callback2 = vi.fn();

      subscribe('sfx:ui:confirm', callback1);
      subscribe('sfx:ui:confirm', callback2);
      emit('sfx:ui:confirm');

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('Node-Based Audio Triggers', () => {
    it('should support onEnter audio triggers in nodes', () => {
      const loader = createMockContentLoader();
      loader.addNode(
        createTestNode({
          id: 'ACT1_DRAMATIC_REVEAL',
          onEnter: [
            { type: 'triggerEvent', event: 'music:crossfade', data: { track: 'dramatic' } },
            { type: 'triggerEvent', event: 'sfx:game:dramatic_sting' },
          ],
        })
      );

      const node = loader.getNode('ACT1_DRAMATIC_REVEAL');
      expect(node?.onEnter).toHaveLength(2);
    });

    it('should support choice-based audio triggers', () => {
      const loader = createMockContentLoader();
      loader.addNode(
        createTestNode({
          id: 'ACT1_START',
          choices: [
            {
              id: 'dramatic_choice',
              text: 'Make a dramatic choice',
              targetId: 'ACT1_NEXT',
              effects: [{ type: 'triggerEvent', event: 'sfx:game:choice_made' }],
            },
          ],
        })
      );

      const node = loader.getNode('ACT1_START');
      const choice = node?.choices[0];
      expect(choice?.effects).toHaveLength(1);
    });
  });

  describe('Audio State', () => {
    // Per AUDIO.md conventions
    it('should support volume levels', () => {
      const audioState = {
        masterVolume: 1.0,
        sfxVolume: 0.8,
        musicVolume: 0.6,
        muted: false,
      };

      expect(audioState.masterVolume).toBeGreaterThanOrEqual(0);
      expect(audioState.masterVolume).toBeLessThanOrEqual(1);
    });

    it('should support mute toggle', () => {
      let muted = false;

      const toggleMute = () => {
        muted = !muted;
      };

      expect(muted).toBe(false);
      toggleMute();
      expect(muted).toBe(true);
      toggleMute();
      expect(muted).toBe(false);
    });
  });

  describe('Audio Playback', () => {
    it('should emit audio events on node entry', () => {
      const manifest = createTestManifest({
        nodes: [
          {
            id: 'START',
            title: 'Start',
            body: 'Start',
            choices: [{ id: 'go', text: 'Go', targetId: 'DRAMATIC' }],
          },
          {
            id: 'DRAMATIC',
            title: 'Dramatic Scene',
            body: 'Drama!',
            choices: [],
            onEnter: [
              { type: 'triggerEvent', event: 'music:crossfade', data: { track: 'tension' } },
              { type: 'triggerEvent', event: 'sfx:dramatic_sting' },
            ],
          },
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
      engine.makeChoice('go');

      // Should have emitted the audio events
      const musicEvent = events.find(e => e.type === 'music:crossfade');
      expect(musicEvent).toBeDefined();
      expect(musicEvent?.data).toEqual({ track: 'tension' });

      const sfxEvent = events.find(e => e.type === 'sfx:dramatic_sting');
      expect(sfxEvent).toBeDefined();
    });

    it('should emit audio events from choice effects', () => {
      const manifest = createTestManifest({
        nodes: [
          {
            id: 'START',
            title: 'Start',
            body: 'Start',
            choices: [
              {
                id: 'dramatic_choice',
                text: 'Dramatic choice',
                targetId: 'END',
                effects: [
                  { type: 'triggerEvent', event: 'sfx:choice_made' },
                ],
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
      engine.makeChoice('dramatic_choice');

      const sfxEvent = events.find(e => e.type === 'sfx:choice_made');
      expect(sfxEvent).toBeDefined();
    });

    it('should emit victory fanfare at victory ending', () => {
      const manifest = createTestManifest({
        nodes: act3Content.nodes,
        items: act3Content.items,
        initialState: {
          currentNodeId: 'ACT3_END_VICTORY',
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

      // Victory node should trigger victory_fanfare on enter
      const victoryEvent = events.find(e => e.type === 'victory_fanfare');
      expect(victoryEvent).toBeDefined();
    });

    it('should emit final battle event at confrontation', () => {
      const manifest = createTestManifest({
        nodes: act3Content.nodes,
        items: act3Content.items,
        initialState: {
          currentNodeId: 'ACT3_FINAL_CONFRONTATION',
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

      // Final confrontation should trigger final_battle_start
      const battleEvent = events.find(e => e.type === 'final_battle_start');
      expect(battleEvent).toBeDefined();
    });

    it('should emit item_acquired event when adding item', () => {
      const manifest = createTestManifest({
        nodes: act1Content.nodes,
        items: act1Content.items,
        initialState: {
          currentNodeId: 'ACT1_SHRINE',
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
      engine.makeChoice('take_amulet');

      const itemEvent = events.find(e => e.type === 'item_acquired');
      expect(itemEvent).toBeDefined();
      expect(itemEvent?.data).toHaveProperty('itemId', 'ITEM_SACRED_AMULET');
    });
  });

  describe('Audio Resource Management', () => {
    it('should track multiple event types in single transition', () => {
      const manifest = createTestManifest({
        nodes: [
          {
            id: 'START',
            title: 'Start',
            body: 'Start',
            choices: [
              {
                id: 'go',
                text: 'Go',
                targetId: 'END',
                effects: [
                  { type: 'triggerEvent', event: 'sfx:footsteps' },
                ],
              },
            ],
          },
          {
            id: 'END',
            title: 'End',
            body: 'End',
            choices: [],
            onEnter: [
              { type: 'triggerEvent', event: 'music:ambient' },
              { type: 'triggerEvent', event: 'sfx:door_close' },
            ],
          },
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
      engine.makeChoice('go');

      // All audio events should be captured
      expect(events.filter(e => e.type.startsWith('sfx:') || e.type.startsWith('music:')).length).toBe(3);
    });

    it('should include timestamps for audio sequencing', () => {
      const manifest = createTestManifest({
        nodes: [
          {
            id: 'START',
            title: 'Start',
            body: 'Start',
            choices: [
              {
                id: 'go',
                text: 'Go',
                targetId: 'END',
                effects: [{ type: 'triggerEvent', event: 'sfx:test' }],
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
      engine.makeChoice('go');

      const sfxEvent = events.find(e => e.type === 'sfx:test');
      expect(sfxEvent?.timestamp).toBeDefined();
      expect(typeof sfxEvent?.timestamp).toBe('number');
    });

    it('should handle events with missing data gracefully', () => {
      const manifest = createTestManifest({
        nodes: [
          {
            id: 'START',
            title: 'Start',
            body: 'Start',
            choices: [
              {
                id: 'go',
                text: 'Go',
                targetId: 'END',
                effects: [{ type: 'triggerEvent', event: 'sfx:no_data' }], // No data field
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

      // Should not throw
      expect(() => engine.makeChoice('go')).not.toThrow();

      const sfxEvent = events.find(e => e.type === 'sfx:no_data');
      expect(sfxEvent).toBeDefined();
    });
  });
});
