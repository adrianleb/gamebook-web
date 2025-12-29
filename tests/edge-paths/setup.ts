/**
 * Edge Path Test Setup and Utilities
 *
 * Provides helper functions for edge case testing scenarios.
 * These tests validate boundary conditions, unusual but valid paths,
 * and regression resistance per QA.md Edge Path Test Cases.
 *
 * @see /docs/QA.md - Edge Path Test Cases
 */

import { vi } from 'vitest';
import {
  createInitialState,
  createTestManifest,
  createTestEngine,
  GameState,
  InventoryEntry,
  GameEvent,
  ContentManifest,
} from '../setup';

// ============================================================================
// Edge Path State Factories
// ============================================================================

/**
 * Creates state for Edge Case 1: Faction Switching Mid-Game
 * Player chose Faction A but lowered standing below 25
 */
export function createFactionSwitchState(): GameState {
  return createInitialState({
    currentNodeId: 'ACT2_FACTION_CROSSROADS',
    flags: {
      FACTION_A_JOINED: true, // Original faction choice persists
      ALLY_MARCUS_ALIVE: false, // A-aligned ally left due to low standing
      ALLY_ELENA_ALIVE: true,
    },
    factions: {
      factionA: 20, // Below 25 threshold
      factionB: 55, // Attempting to switch to B
      factionC: 40,
    },
    visitedNodes: [
      'ACT1_START',
      'ACT1_FACTION_CHOICE',
      'ACT1_FACTION_A_INTRO',
      'ACT1_ALLY_MARCUS',
      'ACT1_ACT_END',
      'ACT2_BETRAYAL_HINT',
      'ACT2_FACTION_CROSSROADS',
    ],
  });
}

/**
 * Creates state for Edge Case 2: All Items Collected
 * Player has collected all 9 available items
 */
export function createAllItemsState(): GameState {
  const allItems: InventoryEntry[] = [
    { itemId: 'ITEM_SACRED_AMULET', quantity: 1 },
    { itemId: 'ITEM_SURVIVAL_KIT', quantity: 1 },
    { itemId: 'ITEM_MAP_FRAGMENT_1', quantity: 1 },
    { itemId: 'ITEM_FACTION_A_ARTIFACT', quantity: 1 },
    { itemId: 'ITEM_DARK_PACT_SCROLL', quantity: 1 },
    { itemId: 'ITEM_MAP_FRAGMENT_2', quantity: 1 },
    { itemId: 'ITEM_KEY_VAULT', quantity: 1 },
    { itemId: 'ITEM_FACTION_B_ARTIFACT', quantity: 1 },
    { itemId: 'ITEM_FACTION_C_ARTIFACT', quantity: 1 },
  ];

  return createInitialState({
    currentNodeId: 'ACT3_FINAL_CONFRONTATION',
    flags: {
      FACTION_A_JOINED: true,
      ALLY_MARCUS_ALIVE: true,
      ALLY_ELENA_ALIVE: true,
      SECRET_DEAL_MADE: true, // For dark pact scroll
    },
    inventory: allItems,
    visitedNodes: [
      'ACT1_START',
      'ACT1_SHRINE',
      'ACT1_SUPPLIES',
      'ACT1_EXPLORE_1',
      'ACT1_FACTION_CHOICE',
      'ACT1_ACT_END',
      'ACT2_ARTIFACT_A',
      'ACT2_SECRET_DEAL',
      'ACT2_EXPLORE_2',
      'ACT2_HEIST',
      'ACT2_ACT_END',
      'ACT3_FINAL_CONFRONTATION',
    ],
  });
}

/**
 * Creates state for Edge Case 3: All Allies Recruited Then Lost
 * Player recruited all allies then lost them
 */
export function createAlliesLostState(): GameState {
  return createInitialState({
    currentNodeId: 'ACT3_FINAL_CONFRONTATION',
    flags: {
      FACTION_A_JOINED: true,
      // All allies were recruited but are now dead/gone
      ALLY_MARCUS_ALIVE: false,
      ALLY_ELENA_ALIVE: false,
      ALLY_THORNE_ALIVE: false,
      // Track that they were recruited
      ALLY_MARCUS_RECRUITED: true,
      ALLY_ELENA_RECRUITED: true,
      ALLY_THORNE_RECRUITED: true,
    },
    factions: {
      factionA: 60,
      factionB: 30,
      factionC: 30,
    },
    visitedNodes: [
      'ACT1_START',
      'ACT1_ALLY_MARCUS',
      'ACT1_MARCUS_JOIN',
      'ACT1_ACT_END',
      'ACT2_ALLY_ELENA',
      'ACT2_ELENA_SAVED',
      'ACT2_ALLY_THORNE',
      'ACT2_THORNE_JOIN',
      // Allies lost events
      'ACT2_MARCUS_DEATH',
      'ACT2_ELENA_BETRAYAL',
      'ACT3_THORNE_SACRIFICE',
      'ACT3_FINAL_CONFRONTATION',
    ],
  });
}

/**
 * Creates state for Edge Case 4: Save/Load at Critical Choice
 * Player at final confrontation with multiple endings available
 */
export function createCriticalChoiceState(): GameState {
  return createInitialState({
    currentNodeId: 'ACT3_FINAL_CONFRONTATION',
    flags: {
      FACTION_A_JOINED: true,
      FACTION_LEADER_MET: true,
      FINAL_QUEST_ACCEPTED: true,
      ALLY_MARCUS_ALIVE: true,
      ALLY_ELENA_ALIVE: true,
      SACRIFICE_PATH_UNLOCKED: true,
      LOVED_ONE_IN_DANGER: true,
      NEUTRAL_PATH_AVAILABLE: true,
    },
    inventory: [
      { itemId: 'ITEM_FACTION_A_ARTIFACT', quantity: 1 },
      { itemId: 'ITEM_SACRED_AMULET', quantity: 1 },
    ],
    factions: {
      factionA: 80,
      factionB: 35,
      factionC: 35,
    },
    visitedNodes: [
      'ACT1_START',
      'ACT1_SHRINE',
      'ACT1_FACTION_CHOICE',
      'ACT1_ALLY_MARCUS',
      'ACT1_ACT_END',
      'ACT2_PROPHECY',
      'ACT2_LEADER_AUDIENCE',
      'ACT2_ACCEPT_QUEST',
      'ACT2_ARTIFACT_A',
      'ACT2_ALLY_ELENA',
      'ACT2_ACT_END',
      'ACT3_KIDNAPPING',
      'ACT3_FINAL_CONFRONTATION',
    ],
  });
}

/**
 * Creates state for Edge Case 5: Boundary Faction Values
 * Returns states at exact threshold values
 */
export function createBoundaryFactionState(
  value: 24 | 25 | 50 | 74 | 75
): GameState {
  return createInitialState({
    currentNodeId: 'ACT2_FACTION_CHECK',
    flags: {
      FACTION_A_JOINED: true,
      ALLY_MARCUS_ALIVE: value >= 25, // Allies leave below 25
    },
    factions: {
      factionA: value,
      factionB: 50,
      factionC: 50,
    },
    visitedNodes: ['ACT1_START', 'ACT1_FACTION_CHOICE', 'ACT2_FACTION_CHECK'],
  });
}

/**
 * Creates state for Edge Case 6: Map Fragment Unlocks
 * Player with specific map fragments
 */
export function createMapFragmentState(fragments: (1 | 2)[]): GameState {
  const inventory: InventoryEntry[] = fragments.map((n) => ({
    itemId: `ITEM_MAP_FRAGMENT_${n}`,
    quantity: 1,
  }));

  const flags: Record<string, boolean> = {
    FACTION_A_JOINED: true,
    ALLY_MARCUS_ALIVE: true,
  };

  // Set unlock flags based on fragments
  if (fragments.includes(1)) {
    flags.HIDDEN_PATH_1_UNLOCKED = true;
  }
  if (fragments.includes(2)) {
    flags.HIDDEN_PATH_2_UNLOCKED = true;
  }

  return createInitialState({
    currentNodeId: fragments.includes(2)
      ? 'ACT3_SECRET_ENTRANCE'
      : fragments.includes(1)
        ? 'ACT2_HIDDEN_PATH'
        : 'ACT2_BLOCKED_PATH',
    flags,
    inventory,
    visitedNodes: [
      'ACT1_START',
      ...(fragments.includes(1) ? ['ACT1_EXPLORE_1'] : []),
      'ACT1_ACT_END',
      ...(fragments.includes(2) ? ['ACT2_EXPLORE_2'] : []),
    ],
  });
}

/**
 * Creates state for Edge Case 7: Doom Sealed Override
 * Player has victory requirements but DOOM_SEALED is set
 */
export function createDoomSealedState(): GameState {
  return createInitialState({
    currentNodeId: 'ACT3_FINAL_CONFRONTATION',
    flags: {
      FACTION_A_JOINED: true,
      FACTION_LEADER_MET: true,
      FINAL_QUEST_ACCEPTED: true,
      ALLY_MARCUS_ALIVE: true,
      ALLY_ELENA_ALIVE: true,
      // This flag overrides everything
      DOOM_SEALED: true,
    },
    inventory: [{ itemId: 'ITEM_FACTION_A_ARTIFACT', quantity: 1 }],
    factions: {
      factionA: 85, // High enough for victory
      factionB: 40,
      factionC: 40,
    },
    visitedNodes: [
      'ACT1_START',
      'ACT1_FACTION_CHOICE',
      'ACT1_ALLY_MARCUS',
      'ACT1_ACT_END',
      'ACT2_LEADER_AUDIENCE',
      'ACT2_ACCEPT_QUEST',
      'ACT2_ARTIFACT_A',
      'ACT2_ALLY_ELENA',
      'ACT2_ACT_END',
      'ACT3_CRITICAL_FAILURE', // This set DOOM_SEALED
      'ACT3_FINAL_CONFRONTATION',
    ],
  });
}

/**
 * Creates state for Edge Case 8: Skip All Optional Content
 * Minimal playthrough skipping all optional nodes
 */
export function createSpeedRunState(): GameState {
  return createInitialState({
    currentNodeId: 'ACT3_FINAL_CONFRONTATION',
    flags: {
      FACTION_A_JOINED: true,
      // No allies recruited
      ALLY_MARCUS_ALIVE: false,
      ALLY_ELENA_ALIVE: false,
      NEUTRAL_PATH_AVAILABLE: true, // Auto-set since no commitments
    },
    inventory: [], // No items collected
    factions: {
      factionA: 40, // Minimal faction interaction
      factionB: 45,
      factionC: 45,
    },
    visitedNodes: [
      // Minimal critical path only
      'ACT1_START',
      'ACT1_FIRST_CHOICE',
      'ACT1_FACTION_CHOICE',
      'ACT1_ACT_END',
      'ACT2_MAIN_QUEST',
      'ACT2_ACT_END',
      'ACT3_FINAL_CONFRONTATION',
    ],
  });
}

// ============================================================================
// Edge Path Assertion Helpers
// ============================================================================

/**
 * Asserts that faction-locked content respects original faction choice
 */
export function assertFactionLock(
  state: GameState,
  originalFaction: 'A' | 'B' | 'C'
): void {
  // Original faction flag should persist
  expect(state.flags[`FACTION_${originalFaction}_JOINED`]).toBe(true);

  // Other faction joined flags should not be set
  const otherFactions = ['A', 'B', 'C'].filter((f) => f !== originalFaction);
  for (const faction of otherFactions) {
    expect(state.flags[`FACTION_${faction}_JOINED`]).toBeFalsy();
  }
}

/**
 * Asserts inventory has expected items without overflow
 */
export function assertInventoryIntegrity(
  state: GameState,
  expectedCount: number
): void {
  expect(state.inventory.length).toBe(expectedCount);

  // Check no duplicate item IDs
  const itemIds = state.inventory.map((i) => i.itemId);
  const uniqueIds = new Set(itemIds);
  expect(uniqueIds.size).toBe(itemIds.length);

  // Check all quantities are valid
  for (const item of state.inventory) {
    expect(item.quantity).toBeGreaterThan(0);
  }
}

/**
 * Asserts ally flags correctly reflect recruitment and loss
 */
export function assertAllyStateTransition(
  state: GameState,
  ally: 'MARCUS' | 'ELENA' | 'THORNE',
  wasRecruited: boolean,
  isAlive: boolean
): void {
  if (wasRecruited) {
    expect(state.flags[`ALLY_${ally}_RECRUITED`]).toBe(true);
  }
  expect(state.flags[`ALLY_${ally}_ALIVE`]).toBe(isAlive);
}

/**
 * Asserts faction value meets or fails threshold
 */
export function assertFactionThreshold(
  state: GameState,
  faction: 'factionA' | 'factionB' | 'factionC',
  threshold: number,
  shouldMeet: boolean
): void {
  if (shouldMeet) {
    expect(state.factions[faction]).toBeGreaterThanOrEqual(threshold);
  } else {
    expect(state.factions[faction]).toBeLessThan(threshold);
  }
}

/**
 * Asserts ending availability based on state
 */
export function assertEndingAvailable(
  state: GameState,
  ending: 'victory' | 'sacrifice' | 'betrayal' | 'neutral' | 'death',
  shouldBeAvailable: boolean
): void {
  let isAvailable = false;

  switch (ending) {
    case 'victory':
      isAvailable =
        Object.values(state.factions).some((v) => v >= 75) &&
        state.flags.FACTION_LEADER_MET === true &&
        state.flags.FINAL_QUEST_ACCEPTED === true &&
        state.inventory.some(
          (i) =>
            i.itemId.startsWith('ITEM_FACTION_') &&
            i.itemId.endsWith('_ARTIFACT')
        ) &&
        state.flags.DOOM_SEALED !== true;
      break;

    case 'sacrifice':
      isAvailable =
        state.flags.SACRIFICE_PATH_UNLOCKED === true &&
        state.flags.LOVED_ONE_IN_DANGER === true &&
        state.inventory.some((i) => i.itemId === 'ITEM_SACRED_AMULET') &&
        state.flags.DOOM_SEALED !== true;
      break;

    case 'betrayal':
      isAvailable =
        state.flags.BETRAYER_PATH === true &&
        state.flags.SECRET_DEAL_MADE === true &&
        state.inventory.some((i) => i.itemId === 'ITEM_DARK_PACT_SCROLL') &&
        state.flags.DOOM_SEALED !== true;
      break;

    case 'neutral':
      isAvailable =
        Object.values(state.factions).every((v) => v >= 25 && v <= 50) &&
        state.flags.DOOM_SEALED !== true;
      break;

    case 'death':
      isAvailable =
        state.flags.DOOM_SEALED === true || (state.stats.health ?? 100) <= 0;
      break;
  }

  if (shouldBeAvailable) {
    expect(isAvailable).toBe(true);
  } else {
    expect(isAvailable).toBe(false);
  }
}

// ============================================================================
// Test Content Helpers
// ============================================================================

/**
 * Creates a test manifest with faction threshold checking nodes
 * Uses ENGINE.md compliant condition schema
 */
export function createFactionThresholdManifest(): ContentManifest {
  return createTestManifest({
    nodes: [
      {
        id: 'ACT2_FACTION_CHECK',
        title: 'Faction Standing Check',
        body: 'Your faction standing is being evaluated.',
        choices: [
          {
            id: 'ally_leaves',
            text: 'Ally leaves (standing < 25)',
            targetId: 'ACT2_ALLY_LEAVES',
            conditions: [
              { type: 'faction', faction: 'factionA', operator: '<', value: 25 },
            ],
          },
          {
            id: 'neutral_zone',
            text: 'Neutral zone (25-49)',
            targetId: 'ACT2_NEUTRAL',
            conditions: [
              { type: 'faction', faction: 'factionA', operator: '>=', value: 25 },
              { type: 'faction', faction: 'factionA', operator: '<', value: 50 },
            ],
          },
          {
            id: 'leader_available',
            text: 'Leader audience (50-74)',
            targetId: 'ACT2_LEADER_AUDIENCE',
            conditions: [
              { type: 'faction', faction: 'factionA', operator: '>=', value: 50 },
              { type: 'faction', faction: 'factionA', operator: '<', value: 75 },
            ],
          },
          {
            id: 'victory_path',
            text: 'Victory path (75+)',
            targetId: 'ACT3_VICTORY_PATH',
            conditions: [
              { type: 'faction', faction: 'factionA', operator: '>=', value: 75 },
            ],
          },
        ],
      },
      {
        id: 'ACT2_ALLY_LEAVES',
        title: 'Ally Departs',
        body: 'Your ally can no longer follow you.',
        choices: [],
        tags: ['ally-loss'],
      },
      {
        id: 'ACT2_NEUTRAL',
        title: 'Neutral Ground',
        body: 'You maintain a careful balance.',
        choices: [],
      },
      {
        id: 'ACT2_LEADER_AUDIENCE',
        title: 'Leader Audience',
        body: 'The faction leader will see you.',
        choices: [],
      },
      {
        id: 'ACT3_VICTORY_PATH',
        title: 'Path to Victory',
        body: 'Your dedication has earned trust.',
        choices: [],
      },
    ],
    initialState: {
      currentNodeId: 'ACT2_FACTION_CHECK',
      flags: { FACTION_A_JOINED: true },
      stats: { health: 100 },
      inventory: [],
      factions: { factionA: 50, factionB: 50, factionC: 50 },
    },
  });
}

/**
 * Creates a test manifest for save/load testing at critical choices
 * Uses ENGINE.md compliant condition schema (itemId with 'has' operator)
 */
export function createCriticalChoiceManifest(): ContentManifest {
  return createTestManifest({
    nodes: [
      {
        id: 'ACT3_FINAL_CONFRONTATION',
        title: 'The Final Confrontation',
        body: 'All paths converge here. Choose your destiny.',
        choices: [
          {
            id: 'fight_for_victory',
            text: 'Fight for victory',
            targetId: 'ACT3_END_VICTORY',
            conditions: [
              { type: 'faction', faction: 'factionA', operator: '>=', value: 75 },
              { type: 'flag', flag: 'FACTION_LEADER_MET', value: true },
              { type: 'flag', flag: 'FINAL_QUEST_ACCEPTED', value: true },
              { type: 'flag', flag: 'DOOM_SEALED', value: false },
            ],
          },
          {
            id: 'sacrifice_self',
            text: 'Sacrifice yourself',
            targetId: 'ACT3_END_SACRIFICE',
            conditions: [
              { type: 'flag', flag: 'SACRIFICE_PATH_UNLOCKED', value: true },
              { type: 'flag', flag: 'LOVED_ONE_IN_DANGER', value: true },
              { type: 'item', itemId: 'ITEM_SACRED_AMULET', operator: 'has' },
              { type: 'flag', flag: 'DOOM_SEALED', value: false },
            ],
          },
          {
            id: 'walk_away',
            text: 'Walk away',
            targetId: 'ACT3_END_NEUTRAL',
            conditions: [
              { type: 'flag', flag: 'NEUTRAL_PATH_AVAILABLE', value: true },
              { type: 'flag', flag: 'DOOM_SEALED', value: false },
            ],
          },
          {
            id: 'doomed_path',
            text: 'Accept your fate',
            targetId: 'ACT3_END_DEATH',
            conditions: [{ type: 'flag', flag: 'DOOM_SEALED', value: true }],
          },
        ],
      },
      {
        id: 'ACT3_END_VICTORY',
        title: 'Victory',
        body: 'THE END - VICTORY',
        choices: [],
        tags: ['ending', 'victory'],
      },
      {
        id: 'ACT3_END_SACRIFICE',
        title: 'Sacrifice',
        body: 'THE END - SACRIFICE',
        choices: [],
        tags: ['ending', 'sacrifice'],
      },
      {
        id: 'ACT3_END_NEUTRAL',
        title: 'Neutral',
        body: 'THE END - NEUTRAL',
        choices: [],
        tags: ['ending', 'neutral'],
      },
      {
        id: 'ACT3_END_DEATH',
        title: 'Death',
        body: 'THE END - DEATH',
        choices: [],
        tags: ['ending', 'death'],
      },
    ],
    initialState: {
      currentNodeId: 'ACT3_FINAL_CONFRONTATION',
      flags: {},
      stats: { health: 100 },
      inventory: [],
      factions: { factionA: 50, factionB: 50, factionC: 50 },
    },
  });
}

/**
 * Creates a test manifest with map fragment gated paths
 * Uses ENGINE.md compliant condition schema (itemId with 'has'/'lacks' operator)
 */
export function createMapFragmentManifest(): ContentManifest {
  return createTestManifest({
    nodes: [
      {
        id: 'ACT2_CROSSROADS',
        title: 'The Crossroads',
        body: 'Multiple paths branch from here.',
        choices: [
          {
            id: 'hidden_path',
            text: 'Take the hidden path',
            targetId: 'ACT2_HIDDEN_PATH',
            conditions: [
              { type: 'item', itemId: 'ITEM_MAP_FRAGMENT_1', operator: 'has' },
            ],
          },
          {
            id: 'blocked_notice',
            text: 'Examine blocked passage',
            targetId: 'ACT2_BLOCKED_PATH',
            conditions: [
              { type: 'item', itemId: 'ITEM_MAP_FRAGMENT_1', operator: 'lacks' },
            ],
          },
          {
            id: 'main_path',
            text: 'Continue on main path',
            targetId: 'ACT2_MAIN_PATH',
          },
        ],
      },
      {
        id: 'ACT2_HIDDEN_PATH',
        title: 'Hidden Path',
        body: 'The map fragment reveals a secret way.',
        choices: [],
      },
      {
        id: 'ACT2_BLOCKED_PATH',
        title: 'Blocked Passage',
        body: 'Without the map, this path remains a mystery.',
        choices: [],
      },
      {
        id: 'ACT2_MAIN_PATH',
        title: 'Main Path',
        body: 'The standard route continues.',
        choices: [],
      },
      {
        id: 'ACT3_SECRET_ENTRANCE',
        title: 'Secret Entrance',
        body: 'Both map fragments reveal the final secret.',
        choices: [],
      },
    ],
    items: [
      {
        id: 'ITEM_MAP_FRAGMENT_1',
        name: 'Map Fragment 1',
        description: 'A piece of an ancient map.',
        stackable: false,
        usable: false,
        consumable: false,
      },
      {
        id: 'ITEM_MAP_FRAGMENT_2',
        name: 'Map Fragment 2',
        description: 'Another piece of the ancient map.',
        stackable: false,
        usable: false,
        consumable: false,
      },
    ],
    initialState: {
      currentNodeId: 'ACT2_CROSSROADS',
      flags: {},
      stats: { health: 100 },
      inventory: [],
      factions: { factionA: 50, factionB: 50, factionC: 50 },
    },
  });
}

// Re-export common test utilities
export {
  createInitialState,
  createTestManifest,
  createTestEngine,
  GameState,
  InventoryEntry,
  GameEvent,
};
