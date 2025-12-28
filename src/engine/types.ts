/**
 * Core type definitions for the game engine.
 * Based on ENGINE.md specification v1.0.0
 *
 * @module engine/types
 */

// =============================================================================
// Schema Version
// =============================================================================

export const SCHEMA_VERSION = '1.0.0';

// =============================================================================
// Content Schema
// =============================================================================

export interface ContentManifest {
  schemaVersion: string;
  nodes: Node[];
  items: Item[];
  initialState: InitialState;
}

export interface Node {
  id: string;
  title: string;
  body: string;
  speaker?: string;
  choices: Choice[];
  onEnter?: Effect[];
  tags?: string[];
}

export interface Choice {
  id: string;
  text: string;
  targetId: string;
  conditions?: Condition[];
  effects?: Effect[];
  tooltip?: string;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  stackable: boolean;
  maxStack?: number;
  usable: boolean;
  onUse?: Effect[];
  consumable: boolean;
  tags?: string[];
}

// =============================================================================
// State Types
// =============================================================================

export interface InitialState {
  currentNodeId: string;
  flags: Record<string, boolean>;
  stats: Record<string, number>;
  inventory: InventoryEntry[];
  factions: Record<string, number>;
}

export interface InventoryEntry {
  itemId: string;
  quantity: number;
}

export interface ChoiceRecord {
  nodeId: string;
  choiceId: string;
  timestamp: number;
}

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
  pendingEffects: Effect[];
}

// =============================================================================
// Condition Types
// =============================================================================

export type Condition =
  | FlagCondition
  | StatCondition
  | ItemCondition
  | FactionCondition
  | VisitedCondition
  | NotCondition
  | AndCondition
  | OrCondition;

export interface FlagCondition {
  type: 'flag';
  flag: string;
  value: boolean;
}

export interface StatCondition {
  type: 'stat';
  stat: string;
  operator: '==' | '!=' | '>' | '>=' | '<' | '<=';
  value: number;
}

export interface ItemCondition {
  type: 'item';
  itemId: string;
  operator: 'has' | 'lacks' | 'count';
  count?: number;
}

export interface FactionCondition {
  type: 'faction';
  faction: string;
  operator: '==' | '!=' | '>' | '>=' | '<' | '<=';
  value: number;
}

export interface VisitedCondition {
  type: 'visited';
  nodeId: string;
  value: boolean;
}

export interface NotCondition {
  type: 'not';
  condition: Condition;
}

export interface AndCondition {
  type: 'and';
  conditions: Condition[];
}

export interface OrCondition {
  type: 'or';
  conditions: Condition[];
}

// =============================================================================
// Effect Types
// =============================================================================

export type Effect =
  | SetFlagEffect
  | ClearFlagEffect
  | ModifyStatEffect
  | SetStatEffect
  | AddItemEffect
  | RemoveItemEffect
  | ModifyFactionEffect
  | SetFactionEffect
  | TriggerEventEffect;

export interface SetFlagEffect {
  type: 'setFlag';
  flag: string;
}

export interface ClearFlagEffect {
  type: 'clearFlag';
  flag: string;
}

export interface ModifyStatEffect {
  type: 'modifyStat';
  stat: string;
  delta: number;
  clampMin?: number;
  clampMax?: number;
}

export interface SetStatEffect {
  type: 'setStat';
  stat: string;
  value: number;
}

export interface AddItemEffect {
  type: 'addItem';
  itemId: string;
  quantity?: number;
}

export interface RemoveItemEffect {
  type: 'removeItem';
  itemId: string;
  quantity?: number;
}

export interface ModifyFactionEffect {
  type: 'modifyFaction';
  faction: string;
  delta: number;
  clampMin?: number;
  clampMax?: number;
}

export interface SetFactionEffect {
  type: 'setFaction';
  faction: string;
  value: number;
}

export interface TriggerEventEffect {
  type: 'triggerEvent';
  event: string;
  data?: unknown;
}

// =============================================================================
// Save System Types
// =============================================================================

export const SAVE_VERSION = '1.0.0';

export interface SaveFile {
  version: string;
  schemaVersion: string;
  timestamp: number;
  playtime: number;
  slot: number;
  name: string;
  preview: SavePreview;
  state: SerializedGameState;
  checksum: string;
}

export interface SavePreview {
  nodeTitle: string;
  actNumber: number;
  choiceCount: number;
  screenshotData?: string;
}

export interface SerializedGameState {
  currentNodeId: string;
  previousNodeId: string | null;
  flags: Record<string, boolean>;
  stats: Record<string, number>;
  inventory: InventoryEntry[];
  factions: Record<string, number>;
  visitedNodes: string[];
  choicesMade: ChoiceRecord[];
}

// =============================================================================
// Error Types
// =============================================================================

export type EngineErrorCode =
  // Content errors
  | 'INVALID_NODE'
  | 'INVALID_CHOICE'
  | 'INVALID_ITEM'
  | 'INVALID_CONDITION'
  | 'INVALID_EFFECT'
  // State errors
  | 'CONDITION_FAILED'
  | 'INVALID_STATE'
  | 'STATE_CORRUPTION'
  // Save errors
  | 'SAVE_NOT_FOUND'
  | 'SAVE_CORRUPTED'
  | 'MIGRATION_FAILED'
  | 'STORAGE_FULL'
  // Validation errors
  | 'VALIDATION_FAILED'
  | 'DUPLICATE_NODE_ID'
  | 'INVALID_TARGET'
  | 'ORPHAN_NODE'
  | 'INESCAPABLE_CYCLE'
  | 'UNREACHABLE_ENDING'
  | 'INVALID_START_NODE'
  // Content loading errors
  | 'CONTENT_NOT_LOADED'
  | 'INVALID_CONTENT';

// =============================================================================
// State Machine Types
// =============================================================================

export type EnginePhase =
  | 'IDLE'
  | 'LOADING'
  | 'DISPLAY_NODE'
  | 'AWAIT_CHOICE'
  | 'CHOICE_MADE'
  | 'APPLY_EFFECTS'
  | 'END_GAME'
  | 'ERROR';

// =============================================================================
// Event Types (for UI/audio integration)
// =============================================================================

export interface GameEvent {
  type: string;
  data?: unknown;
  timestamp: number;
}

export type GameEventHandler = (event: GameEvent) => void;
