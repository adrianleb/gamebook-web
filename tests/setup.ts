/**
 * Test setup file for Vitest
 *
 * This file is automatically loaded before each test suite.
 * Provides common test utilities, mocks, and game state factories.
 *
 * @see /docs/ENGINE.md for GameState schema
 * @see /docs/QA.md for test requirements
 */

import { vi } from 'vitest';

// ============================================================================
// Type Definitions (aligned with ENGINE.md)
// ============================================================================

export interface InventoryEntry {
  itemId: string;
  quantity: number;
}

export interface ChoiceRecord {
  nodeId: string;
  choiceId: string;
  timestamp: number;
}

/**
 * Complete game state as defined in ENGINE.md
 */
export interface GameState {
  // Core state
  currentNodeId: string;
  previousNodeId: string | null;
  flags: Record<string, boolean>;
  stats: Record<string, number>;
  inventory: InventoryEntry[];
  factions: Record<string, number>;

  // Session metadata
  visitedNodes: string[];
  choicesMade: ChoiceRecord[];

  // Runtime (not saved)
  isTransitioning: boolean;
  pendingEffects: unknown[];
}

export interface Node {
  id: string;
  title: string;
  body: string;
  speaker?: string;
  choices: Choice[];
  onEnter?: unknown[];
  tags?: string[];
}

export interface Choice {
  id: string;
  text: string;
  targetId: string;
  conditions?: unknown[];
  effects?: unknown[];
  tooltip?: string;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  stackable: boolean;
  maxStack?: number;
  usable: boolean;
  onUse?: unknown[];
  consumable: boolean;
  tags?: string[];
}

// ============================================================================
// Default State Factory
// ============================================================================

/**
 * Creates a default initial game state per ENGINE.md specification
 */
export function createInitialState(overrides?: Partial<GameState>): GameState {
  const defaultState: GameState = {
    currentNodeId: 'ACT1_START',
    previousNodeId: null,
    flags: {
      ALLY_MARCUS_ALIVE: true,
      ALLY_ELENA_ALIVE: true,
    },
    stats: {
      health: 100,
      maxHealth: 100,
    },
    inventory: [],
    factions: {
      factionA: 50,
      factionB: 50,
      factionC: 50,
    },
    visitedNodes: ['ACT1_START'],
    choicesMade: [],
    isTransitioning: false,
    pendingEffects: [],
  };

  return {
    ...defaultState,
    ...overrides,
    flags: { ...defaultState.flags, ...overrides?.flags },
    stats: { ...defaultState.stats, ...overrides?.stats },
    factions: { ...defaultState.factions, ...overrides?.factions },
  };
}

// ============================================================================
// Ending-Specific State Factories (per QA.md playthrough scripts)
// ============================================================================

/**
 * Creates state prerequisites for Victory ending (Golden Path 1)
 * @see /docs/QA.md - Golden Path 1: Victory (Faction-Aligned)
 */
export function createVictoryPathState(faction: 'A' | 'B' | 'C' = 'A'): GameState {
  return createInitialState({
    currentNodeId: 'ACT3_FINAL_CONFRONTATION',
    flags: {
      ALLY_MARCUS_ALIVE: true,
      ALLY_ELENA_ALIVE: true,
      [`FACTION_${faction}_JOINED`]: true,
      FACTION_LEADER_MET: true,
      FINAL_QUEST_ACCEPTED: true,
    },
    inventory: [
      { itemId: `ITEM_FACTION_${faction}_ARTIFACT`, quantity: 1 },
    ],
    factions: {
      factionA: faction === 'A' ? 80 : 40,
      factionB: faction === 'B' ? 80 : 40,
      factionC: faction === 'C' ? 80 : 40,
    },
    visitedNodes: [
      'ACT1_START',
      'ACT1_FIRST_CHOICE',
      'ACT1_FACTION_CHOICE',
      `ACT1_FACTION_${faction}_INTRO`,
      'ACT1_ALLY_MARCUS',
      'ACT1_MARCUS_JOIN',
      'ACT1_ACT_END',
      'ACT2_LEADER_AUDIENCE',
      'ACT2_QUEST_DECISION',
      'ACT2_ACCEPT_QUEST',
      `ACT2_ARTIFACT_${faction}`,
      'ACT2_ALLY_ELENA',
      'ACT2_ELENA_SAVED',
      'ACT2_ACT_END',
      'ACT3_FINAL_CONFRONTATION',
    ],
  });
}

/**
 * Creates state prerequisites for Sacrifice ending (Golden Path 2)
 * @see /docs/QA.md - Golden Path 2: Sacrifice
 */
export function createSacrificePathState(): GameState {
  return createInitialState({
    currentNodeId: 'ACT3_FINAL_CONFRONTATION',
    flags: {
      ALLY_MARCUS_ALIVE: true,
      FACTION_A_JOINED: true,
      SACRIFICE_PATH_UNLOCKED: true,
      LOVED_ONE_IN_DANGER: true,
    },
    inventory: [
      { itemId: 'ITEM_SACRED_AMULET', quantity: 1 },
    ],
    visitedNodes: [
      'ACT1_START',
      'ACT1_SHRINE',
      'ACT1_FACTION_CHOICE',
      'ACT1_ALLY_MARCUS',
      'ACT1_ACT_END',
      'ACT2_PROPHECY',
      'ACT2_ACT_END',
      'ACT3_KIDNAPPING',
      'ACT3_FINAL_CONFRONTATION',
    ],
  });
}

/**
 * Creates state prerequisites for Betrayal ending (Golden Path 3)
 * @see /docs/QA.md - Golden Path 3: Betrayal
 */
export function createBetrayalPathState(): GameState {
  return createInitialState({
    currentNodeId: 'ACT3_FINAL_OFFER',
    flags: {
      ALLY_MARCUS_ALIVE: false,
      ALLY_ELENA_ALIVE: false,
      FACTION_A_JOINED: true,
      BETRAYER_PATH: true,
      SECRET_DEAL_MADE: true,
    },
    inventory: [
      { itemId: 'ITEM_DARK_PACT_SCROLL', quantity: 1 },
    ],
    factions: {
      factionA: 20,
      factionB: 20,
      factionC: 20,
    },
    visitedNodes: [
      'ACT1_START',
      'ACT1_FACTION_CHOICE',
      'ACT1_ALLY_MARCUS',
      'ACT1_MARCUS_LEAVE',
      'ACT1_ACT_END',
      'ACT2_TEMPTATION',
      'ACT2_EMBRACE',
      'ACT2_SECRET_DEAL',
      'ACT2_DEAL_MADE',
      'ACT2_ALLY_ELENA',
      'ACT2_ELENA_LOST',
      'ACT2_ACT_END',
      'ACT3_FINAL_OFFER',
    ],
  });
}

/**
 * Creates state prerequisites for Neutral ending (Golden Path 4)
 * @see /docs/QA.md - Golden Path 4: Neutral
 */
export function createNeutralPathState(): GameState {
  return createInitialState({
    currentNodeId: 'ACT3_FINAL_CONFRONTATION',
    flags: {
      FACTION_A_JOINED: true,
      NEUTRAL_PATH_AVAILABLE: true,
    },
    factions: {
      factionA: 35,
      factionB: 40,
      factionC: 38,
    },
    visitedNodes: [
      'ACT1_START',
      'ACT1_FACTION_CHOICE',
      'ACT1_ACT_END',
      'ACT2_QUEST_DECISION',
      'ACT2_REFUSE_QUEST',
      'ACT2_ACT_END',
      'ACT3_FINAL_CONFRONTATION',
    ],
  });
}

/**
 * Creates state prerequisites for Death ending (Golden Path 5)
 * @see /docs/QA.md - Golden Path 5: Death
 */
export function createDeathPathState(viaDoomSealed = true): GameState {
  if (viaDoomSealed) {
    return createInitialState({
      currentNodeId: 'ACT3_END_DEATH',
      flags: {
        ALLY_MARCUS_ALIVE: false,
        ALLY_ELENA_ALIVE: false,
        FACTION_A_JOINED: true,
        DOOM_SEALED: true,
      },
      inventory: [],
      factions: {
        factionA: 30,
        factionB: 30,
        factionC: 30,
      },
      visitedNodes: [
        'ACT1_START',
        'ACT1_FACTION_CHOICE',
        'ACT1_ACT_END',
        'ACT2_ACT_END',
        'ACT3_CRITICAL_FAILURE',
        'ACT3_END_DEATH',
      ],
    });
  }

  // Death via health = 0
  return createInitialState({
    currentNodeId: 'ACT3_FINAL_CONFRONTATION',
    flags: {
      ALLY_MARCUS_ALIVE: false,
      ALLY_ELENA_ALIVE: false,
    },
    stats: {
      health: 0,
      maxHealth: 100,
    },
    inventory: [],
  });
}

// ============================================================================
// Mock Content Loader
// ============================================================================

export interface MockContentData {
  nodes: Map<string, Node>;
  items: Map<string, Item>;
}

/**
 * Creates a mock content loader for testing
 * Allows defining test-specific nodes and items
 */
export function createMockContentLoader(data?: Partial<MockContentData>) {
  const nodes = data?.nodes ?? new Map<string, Node>();
  const items = data?.items ?? new Map<string, Item>();

  return {
    getNode: vi.fn((id: string): Node | undefined => nodes.get(id)),
    getItem: vi.fn((id: string): Item | undefined => items.get(id)),
    getAllNodes: vi.fn((): Node[] => Array.from(nodes.values())),
    getAllItems: vi.fn((): Item[] => Array.from(items.values())),
    hasNode: vi.fn((id: string): boolean => nodes.has(id)),
    hasItem: vi.fn((id: string): boolean => items.has(id)),

    // Test helpers
    addNode: (node: Node): void => {
      nodes.set(node.id, node);
    },
    addItem: (item: Item): void => {
      items.set(item.id, item);
    },
    clear: (): void => {
      nodes.clear();
      items.clear();
    },
  };
}

// ============================================================================
// Test Node/Item Builders
// ============================================================================

/**
 * Creates a test node with sensible defaults
 */
export function createTestNode(overrides: Partial<Node> & { id: string }): Node {
  return {
    title: overrides.id,
    body: `Test content for ${overrides.id}`,
    choices: [],
    ...overrides,
  };
}

/**
 * Creates a test item with sensible defaults
 */
export function createTestItem(overrides: Partial<Item> & { id: string }): Item {
  return {
    name: overrides.id.replace('ITEM_', '').replace(/_/g, ' '),
    description: `A test item: ${overrides.id}`,
    stackable: false,
    usable: false,
    consumable: false,
    ...overrides,
  };
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Asserts that a game state has the required flags for a specific ending
 */
export function assertEndingReachable(
  state: GameState,
  ending: 'victory' | 'sacrifice' | 'betrayal' | 'neutral' | 'death'
): void {
  switch (ending) {
    case 'victory':
      expect(Object.entries(state.factions).some(([, v]) => v >= 75)).toBe(true);
      expect(state.flags.FACTION_LEADER_MET).toBe(true);
      expect(state.flags.FINAL_QUEST_ACCEPTED).toBe(true);
      expect(
        state.inventory.some((i) =>
          i.itemId.startsWith('ITEM_FACTION_') && i.itemId.endsWith('_ARTIFACT')
        )
      ).toBe(true);
      break;

    case 'sacrifice':
      expect(state.flags.SACRIFICE_PATH_UNLOCKED).toBe(true);
      expect(state.flags.LOVED_ONE_IN_DANGER).toBe(true);
      expect(state.inventory.some((i) => i.itemId === 'ITEM_SACRED_AMULET')).toBe(true);
      break;

    case 'betrayal':
      expect(state.flags.BETRAYER_PATH).toBe(true);
      expect(state.flags.SECRET_DEAL_MADE).toBe(true);
      expect(state.inventory.some((i) => i.itemId === 'ITEM_DARK_PACT_SCROLL')).toBe(true);
      break;

    case 'neutral':
      expect(Object.values(state.factions).every((v) => v >= 25 && v <= 50)).toBe(true);
      break;

    case 'death':
      expect(
        state.flags.DOOM_SEALED === true || (state.stats.health ?? 100) <= 0
      ).toBe(true);
      break;
  }
}

// ============================================================================
// LocalStorage Mock
// ============================================================================

/**
 * Creates a mock localStorage for save/load testing
 */
export function createMockLocalStorage() {
  const store = new Map<string, string>();

  return {
    getItem: vi.fn((key: string): string | null => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string): void => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string): void => {
      store.delete(key);
    }),
    clear: vi.fn((): void => {
      store.clear();
    }),
    get length(): number {
      return store.size;
    },
    key: vi.fn((index: number): string | null => {
      const keys = Array.from(store.keys());
      return keys[index] ?? null;
    }),

    // Test helper
    _store: store,
  };
}

// ============================================================================
// Global Test Setup
// ============================================================================

// Mock localStorage globally for all tests
const mockStorage = createMockLocalStorage();
vi.stubGlobal('localStorage', mockStorage);

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
  mockStorage.clear();
});
