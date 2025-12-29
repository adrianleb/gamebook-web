/**
 * Edge Case 2: All Items Collected
 *
 * Tests that the inventory correctly handles all 9 available items
 * without overflow or corruption, including conflicting items.
 *
 * @see /docs/QA.md - Edge Case 2: All Items Collected
 */

import { describe, it, expect } from 'vitest';
import {
  createAllItemsState,
  createInitialState,
  assertInventoryIntegrity,
  createTestManifest,
  createTestEngine,
  InventoryEntry,
} from './setup';

describe('Edge Case 2: All Items Collected', () => {
  describe('Inventory Capacity', () => {
    it('should hold all 9 items without overflow', () => {
      const state = createAllItemsState();

      expect(state.inventory.length).toBe(9);
      assertInventoryIntegrity(state, 9);
    });

    it('should have no duplicate item IDs', () => {
      const state = createAllItemsState();

      const itemIds = state.inventory.map((i) => i.itemId);
      const uniqueIds = new Set(itemIds);

      expect(uniqueIds.size).toBe(itemIds.length);
    });

    it('should have valid quantities for all items', () => {
      const state = createAllItemsState();

      for (const item of state.inventory) {
        expect(item.quantity).toBeGreaterThan(0);
        expect(item.quantity).toBeLessThanOrEqual(99); // Reasonable max
      }
    });
  });

  describe('Item Categories', () => {
    it('should contain all Act 1 items', () => {
      const state = createAllItemsState();

      expect(state.inventory).toContainEqual({
        itemId: 'ITEM_SACRED_AMULET',
        quantity: 1,
      });
      expect(state.inventory).toContainEqual({
        itemId: 'ITEM_SURVIVAL_KIT',
        quantity: 1,
      });
      expect(state.inventory).toContainEqual({
        itemId: 'ITEM_MAP_FRAGMENT_1',
        quantity: 1,
      });
    });

    it('should contain all faction artifacts', () => {
      const state = createAllItemsState();

      expect(state.inventory).toContainEqual({
        itemId: 'ITEM_FACTION_A_ARTIFACT',
        quantity: 1,
      });
      expect(state.inventory).toContainEqual({
        itemId: 'ITEM_FACTION_B_ARTIFACT',
        quantity: 1,
      });
      expect(state.inventory).toContainEqual({
        itemId: 'ITEM_FACTION_C_ARTIFACT',
        quantity: 1,
      });
    });

    it('should contain special items', () => {
      const state = createAllItemsState();

      expect(state.inventory).toContainEqual({
        itemId: 'ITEM_DARK_PACT_SCROLL',
        quantity: 1,
      });
      expect(state.inventory).toContainEqual({
        itemId: 'ITEM_MAP_FRAGMENT_2',
        quantity: 1,
      });
      expect(state.inventory).toContainEqual({
        itemId: 'ITEM_KEY_VAULT',
        quantity: 1,
      });
    });
  });

  describe('Conflicting Items Coexistence', () => {
    it('should allow faction artifacts from different factions', () => {
      const state = createAllItemsState();

      const factionArtifacts = state.inventory.filter(
        (i) =>
          i.itemId.startsWith('ITEM_FACTION_') &&
          i.itemId.endsWith('_ARTIFACT')
      );

      // All 3 faction artifacts should coexist
      expect(factionArtifacts.length).toBe(3);
    });

    it('should allow dark pact scroll with sacred amulet', () => {
      const state = createAllItemsState();

      // Thematically opposed items can coexist
      const hasSacred = state.inventory.some(
        (i) => i.itemId === 'ITEM_SACRED_AMULET'
      );
      const hasDark = state.inventory.some(
        (i) => i.itemId === 'ITEM_DARK_PACT_SCROLL'
      );

      expect(hasSacred).toBe(true);
      expect(hasDark).toBe(true);
    });

    it('should allow both map fragments', () => {
      const state = createAllItemsState();

      const mapFragments = state.inventory.filter((i) =>
        i.itemId.startsWith('ITEM_MAP_FRAGMENT_')
      );

      expect(mapFragments.length).toBe(2);
    });
  });

  describe('Engine Integration', () => {
    it('should add items to inventory without corruption', () => {
      const manifest = createTestManifest({
        nodes: [
          {
            id: 'ITEM_COLLECTION',
            title: 'Item Collection',
            body: 'Collect all items.',
            choices: [
              {
                id: 'collect_amulet',
                text: 'Take Sacred Amulet',
                targetId: 'NEXT',
                effects: [
                  { type: 'addItem', itemId: 'ITEM_SACRED_AMULET', quantity: 1 },
                ],
              },
            ],
          },
          {
            id: 'NEXT',
            title: 'Next',
            body: 'Continue collecting.',
            choices: [
              {
                id: 'collect_kit',
                text: 'Take Survival Kit',
                targetId: 'DONE',
                effects: [
                  { type: 'addItem', itemId: 'ITEM_SURVIVAL_KIT', quantity: 1 },
                ],
              },
            ],
          },
          {
            id: 'DONE',
            title: 'Done',
            body: 'All collected.',
            choices: [],
          },
        ],
        items: [
          {
            id: 'ITEM_SACRED_AMULET',
            name: 'Sacred Amulet',
            description: 'A holy artifact.',
            stackable: false,
            usable: true,
            consumable: false,
          },
          {
            id: 'ITEM_SURVIVAL_KIT',
            name: 'Survival Kit',
            description: 'Essential supplies.',
            stackable: false,
            usable: true,
            consumable: true,
          },
        ],
        initialState: {
          currentNodeId: 'ITEM_COLLECTION',
          flags: {},
          stats: { health: 100 },
          inventory: [],
          factions: { factionA: 50, factionB: 50, factionC: 50 },
        },
      });

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      // Collect first item
      engine.makeChoice('collect_amulet');
      let state = engine.getGameState();
      expect(state?.inventory).toContainEqual({
        itemId: 'ITEM_SACRED_AMULET',
        quantity: 1,
      });

      // Collect second item
      engine.makeChoice('collect_kit');
      state = engine.getGameState();
      expect(state?.inventory.length).toBe(2);
      expect(state?.inventory).toContainEqual({
        itemId: 'ITEM_SURVIVAL_KIT',
        quantity: 1,
      });
    });

    it('should handle item condition checks with full inventory', () => {
      const manifest = createTestManifest({
        nodes: [
          {
            id: 'ITEM_CHECK',
            title: 'Item Check',
            body: 'Checking for items.',
            choices: [
              {
                id: 'use_amulet',
                text: 'Use Sacred Amulet',
                targetId: 'AMULET_USED',
                conditions: [
                  { type: 'item', itemId: 'ITEM_SACRED_AMULET', operator: 'has' },
                ],
              },
              {
                id: 'use_artifact',
                text: 'Use Faction Artifact',
                targetId: 'ARTIFACT_USED',
                conditions: [
                  { type: 'item', itemId: 'ITEM_FACTION_A_ARTIFACT', operator: 'has' },
                ],
              },
              {
                id: 'use_all_fragments',
                text: 'Combine Map Fragments',
                targetId: 'FRAGMENTS_COMBINED',
                conditions: [
                  { type: 'item', itemId: 'ITEM_MAP_FRAGMENT_1', operator: 'has' },
                  { type: 'item', itemId: 'ITEM_MAP_FRAGMENT_2', operator: 'has' },
                ],
              },
            ],
          },
          {
            id: 'AMULET_USED',
            title: 'Amulet Used',
            body: 'The amulet glows.',
            choices: [],
          },
          {
            id: 'ARTIFACT_USED',
            title: 'Artifact Used',
            body: 'The artifact resonates.',
            choices: [],
          },
          {
            id: 'FRAGMENTS_COMBINED',
            title: 'Fragments Combined',
            body: 'The map is complete.',
            choices: [],
          },
        ],
        initialState: {
          currentNodeId: 'ITEM_CHECK',
          flags: {},
          stats: { health: 100 },
          inventory: [
            { itemId: 'ITEM_SACRED_AMULET', quantity: 1 },
            { itemId: 'ITEM_FACTION_A_ARTIFACT', quantity: 1 },
            { itemId: 'ITEM_MAP_FRAGMENT_1', quantity: 1 },
            { itemId: 'ITEM_MAP_FRAGMENT_2', quantity: 1 },
          ],
          factions: { factionA: 50, factionB: 50, factionC: 50 },
        },
      });

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      const choices = engine.getAvailableChoices();

      // All item-gated choices should be available
      expect(choices.find((c) => c.id === 'use_amulet')).toBeDefined();
      expect(choices.find((c) => c.id === 'use_artifact')).toBeDefined();
      expect(choices.find((c) => c.id === 'use_all_fragments')).toBeDefined();
    });

    it('should correctly remove items when consumed', () => {
      const manifest = createTestManifest({
        nodes: [
          {
            id: 'USE_ITEM',
            title: 'Use Item',
            body: 'Use a consumable.',
            choices: [
              {
                id: 'consume',
                text: 'Use Survival Kit',
                targetId: 'USED',
                effects: [
                  { type: 'removeItem', itemId: 'ITEM_SURVIVAL_KIT', quantity: 1 },
                  { type: 'modifyStat', stat: 'health', delta: 20 },
                ],
              },
            ],
          },
          {
            id: 'USED',
            title: 'Used',
            body: 'Item consumed.',
            choices: [],
          },
        ],
        initialState: {
          currentNodeId: 'USE_ITEM',
          flags: {},
          stats: { health: 80 },
          inventory: [
            { itemId: 'ITEM_SURVIVAL_KIT', quantity: 1 },
            { itemId: 'ITEM_SACRED_AMULET', quantity: 1 },
          ],
          factions: { factionA: 50, factionB: 50, factionC: 50 },
        },
      });

      const { engine } = createTestEngine(manifest);
      engine.startNewGame();

      // Initial state
      let state = engine.getGameState();
      expect(state?.inventory.length).toBe(2);

      // Consume item
      engine.makeChoice('consume');
      state = engine.getGameState();

      // Kit removed, amulet remains
      expect(state?.inventory.length).toBe(1);
      expect(state?.inventory).toContainEqual({
        itemId: 'ITEM_SACRED_AMULET',
        quantity: 1,
      });
      expect(state?.stats.health).toBe(100);
    });
  });

  describe('Inventory Persistence', () => {
    it('should preserve all items through visited nodes', () => {
      const state = createAllItemsState();

      // Visited many item-granting nodes
      expect(state.visitedNodes).toContain('ACT1_SHRINE');
      expect(state.visitedNodes).toContain('ACT1_SUPPLIES');
      expect(state.visitedNodes).toContain('ACT1_EXPLORE_1');
      expect(state.visitedNodes).toContain('ACT2_ARTIFACT_A');
      expect(state.visitedNodes).toContain('ACT2_SECRET_DEAL');
      expect(state.visitedNodes).toContain('ACT2_EXPLORE_2');
      expect(state.visitedNodes).toContain('ACT2_HEIST');

      // All items still present
      expect(state.inventory.length).toBe(9);
    });
  });
});
