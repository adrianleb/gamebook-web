# ENGINE.md — Game Engine Specification

> **Owner:** Agent C (Systems Engineer)
> **Status:** Draft v1.0
> **Last Updated:** 2025-12-28

This document defines the game engine architecture, content schema, state management, save system, and validation rules. It serves as the canonical technical reference for all engine-related implementation.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Content Schema](#content-schema)
3. [State Machine](#state-machine)
4. [Condition System](#condition-system)
5. [Effect System](#effect-system)
6. [Save System](#save-system)
7. [Validation Rules](#validation-rules)
8. [Error Handling](#error-handling)

---

## Architecture Overview

The engine follows a data-driven architecture where all game content is declarative and the engine interprets it at runtime.

```
┌─────────────────────────────────────────────────────────────────┐
│                        GAME ENGINE                               │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐        │
│  │ Content       │  │ State         │  │ Renderer      │        │
│  │ Loader        │──│ Machine       │──│ (UI Layer)    │        │
│  └───────────────┘  └───────────────┘  └───────────────┘        │
│         │                  │                  │                  │
│         ▼                  ▼                  ▼                  │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐        │
│  │ Validator     │  │ Save/Load     │  │ Audio         │        │
│  │               │  │ Manager       │  │ Manager       │        │
│  └───────────────┘  └───────────────┘  └───────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

### Core Principles

1. **Deterministic State**: Given the same inputs, the engine produces identical outputs (except explicit RNG).
2. **No Embedded Code**: Content files contain only data; logic is in conditions/effects.
3. **Fail-Safe**: Invalid content triggers validation errors, not runtime crashes.
4. **Serializable**: All game state can be serialized to JSON for save/load.

---

## Content Schema

Content is defined in JSON format with strict typing. Schema version is tracked for migrations.

### Schema Version

```typescript
const SCHEMA_VERSION = "1.0.0";

interface ContentManifest {
  schemaVersion: string;  // Semantic versioning
  nodes: Node[];
  items: Item[];
  initialState: InitialState;
}
```

### Node Schema

Nodes are the fundamental content unit representing scenes/pages in the story.

```typescript
interface Node {
  id: string;              // Unique identifier: ACT{1-3}_{TYPE}_{NAME}
  title: string;           // Internal reference name
  body: string;            // Narrative text (supports basic formatting)
  speaker?: string;        // Optional: character speaking (for dialogue)
  choices: Choice[];       // Available player choices (empty = ending)
  onEnter?: Effect[];      // Effects triggered when entering this node
  tags?: string[];         // Optional categorization: ["ending", "combat", "shop"]
}

interface Choice {
  id: string;              // Unique within parent node
  text: string;            // Player-facing option text
  targetId: string;        // Destination node ID
  conditions?: Condition[];// Requirements to show this choice
  effects?: Effect[];      // Applied when this choice is selected
  tooltip?: string;        // Optional: hint shown on hover/focus
}
```

### Item Schema

Items are inventory objects that can be acquired, used, and checked in conditions.

```typescript
interface Item {
  id: string;              // Unique identifier: ITEM_{NAME}
  name: string;            // Display name
  description: string;     // Flavor text
  stackable: boolean;      // Can player hold multiple?
  maxStack?: number;       // If stackable, max count (default: 99)
  usable: boolean;         // Can be used from inventory?
  onUse?: Effect[];        // Effects when used (if usable)
  consumable: boolean;     // Removed after use?
  tags?: string[];         // Categorization: ["key", "weapon", "artifact"]
}
```

### Initial State

Defines the starting game state for new games.

```typescript
interface InitialState {
  currentNodeId: string;   // Starting node (e.g., "ACT1_START")
  flags: Record<string, boolean>;
  stats: Record<string, number>;
  inventory: InventoryEntry[];
  factions: Record<string, number>;
}

interface InventoryEntry {
  itemId: string;
  quantity: number;
}

// Default initial state
const DEFAULT_INITIAL_STATE: InitialState = {
  currentNodeId: "ACT1_START",
  flags: {
    ALLY_MARCUS_ALIVE: true,
    ALLY_ELENA_ALIVE: true
  },
  stats: {
    health: 100,
    maxHealth: 100
  },
  inventory: [],
  factions: {
    factionA: 50,
    factionB: 50,
    factionC: 50
  }
};
```

---

## State Machine

The game engine operates as a finite state machine with well-defined transitions.

### Game State

```typescript
interface GameState {
  // Core state
  currentNodeId: string;
  previousNodeId: string | null;
  flags: Record<string, boolean>;
  stats: Record<string, number>;
  inventory: InventoryEntry[];
  factions: Record<string, number>;

  // Session metadata
  visitedNodes: string[];     // History for back-tracking detection
  choicesMade: ChoiceRecord[];// Audit trail

  // Runtime (not saved)
  isTransitioning: boolean;
  pendingEffects: Effect[];
}

interface ChoiceRecord {
  nodeId: string;
  choiceId: string;
  timestamp: number;
}
```

### State Transitions

```
┌─────────────────────────────────────────────────────────────┐
│                     STATE MACHINE                            │
│                                                              │
│  ┌─────────┐     ┌─────────┐     ┌─────────┐               │
│  │  IDLE   │────▶│ DISPLAY │────▶│ AWAIT   │               │
│  │         │     │  NODE   │     │ CHOICE  │               │
│  └─────────┘     └─────────┘     └─────────┘               │
│       ▲                               │                      │
│       │                               ▼                      │
│       │          ┌─────────┐     ┌─────────┐               │
│       │          │ APPLY   │◀────│ CHOICE  │               │
│       └──────────│ EFFECTS │     │ MADE    │               │
│                  └─────────┘     └─────────┘               │
│                       │                                      │
│                       ▼                                      │
│                  ┌─────────┐                                │
│                  │  END    │  (if node has no choices)      │
│                  │  GAME   │                                │
│                  └─────────┘                                │
└─────────────────────────────────────────────────────────────┘
```

### Transition Logic

```typescript
function processChoice(state: GameState, choiceId: string): GameState {
  const node = getNode(state.currentNodeId);
  const choice = node.choices.find(c => c.id === choiceId);

  if (!choice) {
    throw new EngineError("INVALID_CHOICE", `Choice ${choiceId} not found`);
  }

  if (!evaluateConditions(choice.conditions, state)) {
    throw new EngineError("CONDITION_FAILED", "Choice conditions not met");
  }

  // Apply choice effects
  let newState = applyEffects(state, choice.effects);

  // Transition to target node
  const targetNode = getNode(choice.targetId);
  newState = {
    ...newState,
    previousNodeId: state.currentNodeId,
    currentNodeId: choice.targetId,
    visitedNodes: [...state.visitedNodes, choice.targetId],
    choicesMade: [...state.choicesMade, {
      nodeId: state.currentNodeId,
      choiceId: choiceId,
      timestamp: Date.now()
    }]
  };

  // Apply target node's onEnter effects
  newState = applyEffects(newState, targetNode.onEnter);

  return newState;
}
```

---

## Condition System

Conditions are declarative predicates evaluated against game state.

### Condition Types

```typescript
type Condition =
  | FlagCondition
  | StatCondition
  | ItemCondition
  | FactionCondition
  | VisitedCondition
  | NotCondition
  | AndCondition
  | OrCondition;

interface FlagCondition {
  type: "flag";
  flag: string;
  value: boolean;  // true = flag is set, false = flag is not set
}

interface StatCondition {
  type: "stat";
  stat: string;
  operator: "==" | "!=" | ">" | ">=" | "<" | "<=";
  value: number;
}

interface ItemCondition {
  type: "item";
  itemId: string;
  operator: "has" | "lacks" | "count";
  count?: number;  // For "count" operator: minimum required
}

interface FactionCondition {
  type: "faction";
  faction: string;
  operator: "==" | "!=" | ">" | ">=" | "<" | "<=";
  value: number;
}

interface VisitedCondition {
  type: "visited";
  nodeId: string;
  value: boolean;  // true = has visited, false = has not visited
}

interface NotCondition {
  type: "not";
  condition: Condition;
}

interface AndCondition {
  type: "and";
  conditions: Condition[];
}

interface OrCondition {
  type: "or";
  conditions: Condition[];
}
```

### Condition Evaluation

```typescript
function evaluateCondition(condition: Condition, state: GameState): boolean {
  switch (condition.type) {
    case "flag":
      return (state.flags[condition.flag] ?? false) === condition.value;

    case "stat":
      const statValue = state.stats[condition.stat] ?? 0;
      return compareNumeric(statValue, condition.operator, condition.value);

    case "item":
      const entry = state.inventory.find(e => e.itemId === condition.itemId);
      const count = entry?.quantity ?? 0;
      if (condition.operator === "has") return count > 0;
      if (condition.operator === "lacks") return count === 0;
      if (condition.operator === "count") return count >= (condition.count ?? 1);
      return false;

    case "faction":
      const factionValue = state.factions[condition.faction] ?? 50;
      return compareNumeric(factionValue, condition.operator, condition.value);

    case "visited":
      const hasVisited = state.visitedNodes.includes(condition.nodeId);
      return hasVisited === condition.value;

    case "not":
      return !evaluateCondition(condition.condition, state);

    case "and":
      return condition.conditions.every(c => evaluateCondition(c, state));

    case "or":
      return condition.conditions.some(c => evaluateCondition(c, state));

    default:
      throw new EngineError("INVALID_CONDITION", `Unknown condition type`);
  }
}

function evaluateConditions(conditions: Condition[] | undefined, state: GameState): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every(c => evaluateCondition(c, state));
}
```

### Condition Examples

```json
// Victory ending: faction >= 75, has artifact, 2+ allies alive
{
  "type": "and",
  "conditions": [
    { "type": "faction", "faction": "factionA", "operator": ">=", "value": 75 },
    { "type": "item", "itemId": "ITEM_FACTION_A_ARTIFACT", "operator": "has" },
    { "type": "flag", "flag": "FACTION_LEADER_MET", "value": true },
    { "type": "flag", "flag": "FINAL_QUEST_ACCEPTED", "value": true },
    {
      "type": "or",
      "conditions": [
        {
          "type": "and",
          "conditions": [
            { "type": "flag", "flag": "ALLY_MARCUS_ALIVE", "value": true },
            { "type": "flag", "flag": "ALLY_ELENA_ALIVE", "value": true }
          ]
        },
        {
          "type": "and",
          "conditions": [
            { "type": "flag", "flag": "ALLY_MARCUS_ALIVE", "value": true },
            { "type": "flag", "flag": "ALLY_THORNE_ALIVE", "value": true }
          ]
        },
        {
          "type": "and",
          "conditions": [
            { "type": "flag", "flag": "ALLY_ELENA_ALIVE", "value": true },
            { "type": "flag", "flag": "ALLY_THORNE_ALIVE", "value": true }
          ]
        }
      ]
    }
  ]
}

// Neutral ending: all factions between 25-50
{
  "type": "and",
  "conditions": [
    { "type": "faction", "faction": "factionA", "operator": ">=", "value": 25 },
    { "type": "faction", "faction": "factionA", "operator": "<=", "value": 50 },
    { "type": "faction", "faction": "factionB", "operator": ">=", "value": 25 },
    { "type": "faction", "faction": "factionB", "operator": "<=", "value": 50 },
    { "type": "faction", "faction": "factionC", "operator": ">=", "value": 25 },
    { "type": "faction", "faction": "factionC", "operator": "<=", "value": 50 }
  ]
}
```

---

## Effect System

Effects are state mutations applied when choices are made or nodes are entered.

### Effect Types

```typescript
type Effect =
  | SetFlagEffect
  | ClearFlagEffect
  | ModifyStatEffect
  | SetStatEffect
  | AddItemEffect
  | RemoveItemEffect
  | ModifyFactionEffect
  | SetFactionEffect
  | TriggerEventEffect;

interface SetFlagEffect {
  type: "setFlag";
  flag: string;
}

interface ClearFlagEffect {
  type: "clearFlag";
  flag: string;
}

interface ModifyStatEffect {
  type: "modifyStat";
  stat: string;
  delta: number;        // Can be positive or negative
  clampMin?: number;    // Optional floor (default: 0 for health)
  clampMax?: number;    // Optional ceiling (default: maxHealth for health)
}

interface SetStatEffect {
  type: "setStat";
  stat: string;
  value: number;
}

interface AddItemEffect {
  type: "addItem";
  itemId: string;
  quantity?: number;    // Default: 1
}

interface RemoveItemEffect {
  type: "removeItem";
  itemId: string;
  quantity?: number;    // Default: all
}

interface ModifyFactionEffect {
  type: "modifyFaction";
  faction: string;
  delta: number;        // Can be positive or negative
  clampMin?: number;    // Default: 0
  clampMax?: number;    // Default: 100
}

interface SetFactionEffect {
  type: "setFaction";
  faction: string;
  value: number;
}

interface TriggerEventEffect {
  type: "triggerEvent";
  event: string;        // Event name for UI/audio hooks
  data?: unknown;       // Optional event payload
}
```

### Effect Application

```typescript
function applyEffect(state: GameState, effect: Effect): GameState {
  switch (effect.type) {
    case "setFlag":
      return {
        ...state,
        flags: { ...state.flags, [effect.flag]: true }
      };

    case "clearFlag":
      return {
        ...state,
        flags: { ...state.flags, [effect.flag]: false }
      };

    case "modifyStat": {
      const current = state.stats[effect.stat] ?? 0;
      const newValue = clamp(
        current + effect.delta,
        effect.clampMin ?? 0,
        effect.clampMax ?? (state.stats[`max${capitalize(effect.stat)}`] ?? Infinity)
      );
      return {
        ...state,
        stats: { ...state.stats, [effect.stat]: newValue }
      };
    }

    case "setStat":
      return {
        ...state,
        stats: { ...state.stats, [effect.stat]: effect.value }
      };

    case "addItem": {
      const quantity = effect.quantity ?? 1;
      const existing = state.inventory.find(e => e.itemId === effect.itemId);
      const item = getItem(effect.itemId);

      if (existing && item.stackable) {
        const maxStack = item.maxStack ?? 99;
        return {
          ...state,
          inventory: state.inventory.map(e =>
            e.itemId === effect.itemId
              ? { ...e, quantity: Math.min(e.quantity + quantity, maxStack) }
              : e
          )
        };
      } else if (!existing) {
        return {
          ...state,
          inventory: [...state.inventory, { itemId: effect.itemId, quantity }]
        };
      }
      return state; // Non-stackable item already owned
    }

    case "removeItem": {
      const quantity = effect.quantity;
      if (quantity === undefined) {
        // Remove all
        return {
          ...state,
          inventory: state.inventory.filter(e => e.itemId !== effect.itemId)
        };
      } else {
        return {
          ...state,
          inventory: state.inventory
            .map(e => e.itemId === effect.itemId
              ? { ...e, quantity: e.quantity - quantity }
              : e
            )
            .filter(e => e.quantity > 0)
        };
      }
    }

    case "modifyFaction": {
      const current = state.factions[effect.faction] ?? 50;
      const newValue = clamp(
        current + effect.delta,
        effect.clampMin ?? 0,
        effect.clampMax ?? 100
      );
      return {
        ...state,
        factions: { ...state.factions, [effect.faction]: newValue }
      };
    }

    case "setFaction":
      return {
        ...state,
        factions: { ...state.factions, [effect.faction]: effect.value }
      };

    case "triggerEvent":
      // Events are handled by UI/audio layer, not state
      // Emit event and return unchanged state
      emitEvent(effect.event, effect.data);
      return state;

    default:
      throw new EngineError("INVALID_EFFECT", `Unknown effect type`);
  }
}

function applyEffects(state: GameState, effects: Effect[] | undefined): GameState {
  if (!effects || effects.length === 0) return state;
  return effects.reduce((s, effect) => applyEffect(s, effect), state);
}
```

---

## Save System

The save system provides persistent game state storage with versioning and migration support.

### Save Format

```typescript
interface SaveFile {
  // Metadata
  version: string;          // Save format version (e.g., "1.0.0")
  schemaVersion: string;    // Content schema version
  timestamp: number;        // Unix timestamp when saved
  playtime: number;         // Total playtime in milliseconds

  // Save identification
  slot: number;             // 0 = autosave, 1-3 = manual slots
  name: string;             // Auto-generated or user-defined

  // Display info (for save slot UI)
  preview: SavePreview;

  // Actual game state
  state: SerializedGameState;

  // Integrity
  checksum: string;         // SHA-256 hash of state JSON
}

interface SavePreview {
  nodeTitle: string;        // Current node's title
  actNumber: number;        // 1, 2, or 3
  choiceCount: number;      // Total choices made
  screenshotData?: string;  // Optional: base64 thumbnail
}

interface SerializedGameState {
  currentNodeId: string;
  previousNodeId: string | null;
  flags: Record<string, boolean>;
  stats: Record<string, number>;
  inventory: InventoryEntry[];
  factions: Record<string, number>;
  visitedNodes: string[];
  choicesMade: ChoiceRecord[];
}
```

### Save Operations

```typescript
const SAVE_VERSION = "1.0.0";
const STORAGE_KEY_PREFIX = "gamebook_save_";
const PREFS_KEY = "gamebook_prefs";

function saveGame(state: GameState, slot: number): SaveFile {
  const node = getNode(state.currentNodeId);
  const serializedState: SerializedGameState = {
    currentNodeId: state.currentNodeId,
    previousNodeId: state.previousNodeId,
    flags: state.flags,
    stats: state.stats,
    inventory: state.inventory,
    factions: state.factions,
    visitedNodes: state.visitedNodes,
    choicesMade: state.choicesMade
  };

  const stateJson = JSON.stringify(serializedState);

  const save: SaveFile = {
    version: SAVE_VERSION,
    schemaVersion: SCHEMA_VERSION,
    timestamp: Date.now(),
    playtime: calculatePlaytime(),
    slot: slot,
    name: generateSaveName(node, slot),
    preview: {
      nodeTitle: node.title,
      actNumber: extractActNumber(state.currentNodeId),
      choiceCount: state.choicesMade.length
    },
    state: serializedState,
    checksum: calculateChecksum(stateJson)
  };

  localStorage.setItem(
    `${STORAGE_KEY_PREFIX}${slot}`,
    JSON.stringify(save)
  );

  return save;
}

function loadGame(slot: number): GameState {
  const saveJson = localStorage.getItem(`${STORAGE_KEY_PREFIX}${slot}`);

  if (!saveJson) {
    throw new EngineError("SAVE_NOT_FOUND", `No save in slot ${slot}`);
  }

  const save: SaveFile = JSON.parse(saveJson);

  // Verify checksum
  const stateJson = JSON.stringify(save.state);
  if (calculateChecksum(stateJson) !== save.checksum) {
    throw new EngineError("SAVE_CORRUPTED", "Save file checksum mismatch");
  }

  // Migrate if needed
  const migratedState = migrateSave(save);

  return {
    ...migratedState,
    isTransitioning: false,
    pendingEffects: []
  };
}

function listSaves(): (SaveFile | null)[] {
  return [0, 1, 2, 3].map(slot => {
    const saveJson = localStorage.getItem(`${STORAGE_KEY_PREFIX}${slot}`);
    return saveJson ? JSON.parse(saveJson) : null;
  });
}

function deleteSave(slot: number): void {
  localStorage.removeItem(`${STORAGE_KEY_PREFIX}${slot}`);
}
```

### Save Migration

```typescript
interface Migration {
  fromVersion: string;
  toVersion: string;
  migrate: (state: SerializedGameState) => SerializedGameState;
}

const MIGRATIONS: Migration[] = [
  // Example migration for future versions
  // {
  //   fromVersion: "1.0.0",
  //   toVersion: "1.1.0",
  //   migrate: (state) => ({
  //     ...state,
  //     newField: defaultValue
  //   })
  // }
];

function migrateSave(save: SaveFile): SerializedGameState {
  let state = save.state;
  let currentVersion = save.version;

  for (const migration of MIGRATIONS) {
    if (migration.fromVersion === currentVersion) {
      state = migration.migrate(state);
      currentVersion = migration.toVersion;
    }
  }

  if (currentVersion !== SAVE_VERSION) {
    throw new EngineError(
      "MIGRATION_FAILED",
      `Cannot migrate from ${save.version} to ${SAVE_VERSION}`
    );
  }

  return state;
}
```

### Autosave

```typescript
const AUTOSAVE_SLOT = 0;
const AUTOSAVE_INTERVAL = 60000; // 1 minute
const AUTOSAVE_ON_TRANSITION = true;

function setupAutosave(getState: () => GameState): void {
  // Periodic autosave
  setInterval(() => {
    const state = getState();
    if (state.currentNodeId) {
      saveGame(state, AUTOSAVE_SLOT);
    }
  }, AUTOSAVE_INTERVAL);
}

function onNodeTransition(state: GameState): void {
  if (AUTOSAVE_ON_TRANSITION) {
    saveGame(state, AUTOSAVE_SLOT);
  }
}
```

---

## Validation Rules

Content must pass validation before the game can run. Validation catches errors at load time, not runtime.

### Validation Categories

```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationError {
  code: string;
  message: string;
  nodeId?: string;
  choiceId?: string;
  itemId?: string;
}

interface ValidationWarning {
  code: string;
  message: string;
  nodeId?: string;
}
```

### Validation Rules

```typescript
function validateContent(manifest: ContentManifest): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  const nodeIds = new Set(manifest.nodes.map(n => n.id));
  const itemIds = new Set(manifest.items.map(i => i.id));

  // 1. Node ID uniqueness
  const seenNodeIds = new Set<string>();
  for (const node of manifest.nodes) {
    if (seenNodeIds.has(node.id)) {
      errors.push({
        code: "DUPLICATE_NODE_ID",
        message: `Duplicate node ID: ${node.id}`,
        nodeId: node.id
      });
    }
    seenNodeIds.add(node.id);
  }

  // 2. Choice target validity
  for (const node of manifest.nodes) {
    for (const choice of node.choices) {
      if (!nodeIds.has(choice.targetId)) {
        errors.push({
          code: "INVALID_TARGET",
          message: `Choice "${choice.id}" targets non-existent node "${choice.targetId}"`,
          nodeId: node.id,
          choiceId: choice.id
        });
      }
    }
  }

  // 3. Item reference validity
  for (const node of manifest.nodes) {
    for (const choice of node.choices) {
      validateItemReferences(choice.conditions, itemIds, errors, node.id, choice.id);
      validateItemReferences(choice.effects, itemIds, errors, node.id, choice.id);
    }
  }

  // 4. Dead-end detection (nodes with no exits that aren't endings)
  for (const node of manifest.nodes) {
    if (node.choices.length === 0 && !node.tags?.includes("ending")) {
      warnings.push({
        code: "POTENTIAL_DEAD_END",
        message: `Node "${node.id}" has no choices and is not tagged as ending`,
        nodeId: node.id
      });
    }
  }

  // 5. Orphan node detection (unreachable from start)
  const reachable = findReachableNodes(manifest.nodes, manifest.initialState.currentNodeId);
  for (const node of manifest.nodes) {
    if (!reachable.has(node.id)) {
      warnings.push({
        code: "ORPHAN_NODE",
        message: `Node "${node.id}" is not reachable from start`,
        nodeId: node.id
      });
    }
  }

  // 6. Circular reference detection (without exits)
  const cycles = findCycles(manifest.nodes);
  for (const cycle of cycles) {
    const hasExit = cycle.some(nodeId => {
      const node = manifest.nodes.find(n => n.id === nodeId);
      return node?.choices.some(c => !cycle.includes(c.targetId));
    });

    if (!hasExit) {
      errors.push({
        code: "INESCAPABLE_CYCLE",
        message: `Cycle detected with no exit: ${cycle.join(" -> ")}`,
        nodeId: cycle[0]
      });
    }
  }

  // 7. Ending reachability
  const endingNodes = manifest.nodes.filter(n => n.tags?.includes("ending"));
  for (const ending of endingNodes) {
    if (!reachable.has(ending.id)) {
      errors.push({
        code: "UNREACHABLE_ENDING",
        message: `Ending "${ending.id}" is not reachable from start`,
        nodeId: ending.id
      });
    }
  }

  // 8. Initial state validity
  if (!nodeIds.has(manifest.initialState.currentNodeId)) {
    errors.push({
      code: "INVALID_START_NODE",
      message: `Initial node "${manifest.initialState.currentNodeId}" does not exist`
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function findReachableNodes(nodes: Node[], startId: string): Set<string> {
  const reachable = new Set<string>();
  const queue = [startId];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (reachable.has(nodeId)) continue;
    reachable.add(nodeId);

    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      for (const choice of node.choices) {
        if (!reachable.has(choice.targetId)) {
          queue.push(choice.targetId);
        }
      }
    }
  }

  return reachable;
}

function findCycles(nodes: Node[]): string[][] {
  // Tarjan's algorithm for strongly connected components
  // Returns arrays of node IDs that form cycles
  // Implementation omitted for brevity
  return [];
}
```

---

## Error Handling

The engine uses typed errors for predictable failure modes.

### Error Types

```typescript
class EngineError extends Error {
  constructor(
    public code: EngineErrorCode,
    message: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "EngineError";
  }
}

type EngineErrorCode =
  // Content errors
  | "INVALID_NODE"
  | "INVALID_CHOICE"
  | "INVALID_ITEM"
  | "INVALID_CONDITION"
  | "INVALID_EFFECT"

  // State errors
  | "CONDITION_FAILED"
  | "INVALID_STATE"
  | "STATE_CORRUPTION"

  // Save errors
  | "SAVE_NOT_FOUND"
  | "SAVE_CORRUPTED"
  | "MIGRATION_FAILED"
  | "STORAGE_FULL"

  // Validation errors
  | "VALIDATION_FAILED"
  | "DUPLICATE_NODE_ID"
  | "INVALID_TARGET"
  | "ORPHAN_NODE"
  | "INESCAPABLE_CYCLE"
  | "UNREACHABLE_ENDING"
  | "INVALID_START_NODE";
```

### Error Recovery

```typescript
interface ErrorRecovery {
  canRecover: boolean;
  action: () => void;
  message: string;
}

function getRecoveryOptions(error: EngineError): ErrorRecovery[] {
  switch (error.code) {
    case "SAVE_CORRUPTED":
      return [
        {
          canRecover: true,
          action: () => deleteSave(error.context?.slot as number),
          message: "Delete corrupted save and continue"
        },
        {
          canRecover: true,
          action: () => startNewGame(),
          message: "Start a new game"
        }
      ];

    case "INVALID_NODE":
      return [
        {
          canRecover: true,
          action: () => navigateToNode(getLastValidNode()),
          message: "Return to last valid node"
        }
      ];

    case "STORAGE_FULL":
      return [
        {
          canRecover: true,
          action: () => clearOldestSave(),
          message: "Delete oldest save to make room"
        }
      ];

    default:
      return [
        {
          canRecover: true,
          action: () => startNewGame(),
          message: "Start a new game"
        }
      ];
  }
}
```

### Error States

```typescript
// Doom state from STORY.md - forces Death ending
function checkDoomState(state: GameState): boolean {
  return state.flags["DOOM_SEALED"] === true;
}

// Health death check
function checkHealthDeath(state: GameState): boolean {
  return (state.stats.health ?? 100) <= 0;
}

// Force ending if doom conditions met
function checkForcedEnding(state: GameState): string | null {
  if (checkDoomState(state)) {
    return "ACT3_END_DEATH";
  }
  if (checkHealthDeath(state)) {
    return "ACT3_END_DEATH";
  }
  return null;
}
```

---

## Appendix: JSON Serialization Examples

### Complete Node Example

```json
{
  "id": "ACT2_TEMPTATION",
  "title": "Dark Whispers",
  "body": "A shadowy figure emerges from the darkness, offering you power beyond imagination. The price? Your loyalty to those who trusted you.",
  "speaker": "Shadow Broker",
  "choices": [
    {
      "id": "resist",
      "text": "I refuse your offer. My allies need me.",
      "targetId": "ACT2_RESIST",
      "effects": [
        { "type": "modifyFaction", "faction": "factionA", "delta": 10 }
      ]
    },
    {
      "id": "embrace",
      "text": "Tell me more about this... power.",
      "targetId": "ACT2_EMBRACE",
      "conditions": [
        { "type": "faction", "faction": "factionA", "operator": "<", "value": 50 }
      ],
      "effects": [
        { "type": "setFlag", "flag": "BETRAYER_PATH" },
        { "type": "modifyFaction", "faction": "factionA", "delta": -20 },
        { "type": "modifyFaction", "faction": "factionB", "delta": -20 },
        { "type": "modifyFaction", "faction": "factionC", "delta": -20 }
      ],
      "tooltip": "This path leads to darkness..."
    }
  ],
  "tags": ["moral_choice", "act2"]
}
```

### Complete Save Example

```json
{
  "version": "1.0.0",
  "schemaVersion": "1.0.0",
  "timestamp": 1703793600000,
  "playtime": 3600000,
  "slot": 1,
  "name": "Act 2 - Dark Whispers",
  "preview": {
    "nodeTitle": "Dark Whispers",
    "actNumber": 2,
    "choiceCount": 47
  },
  "state": {
    "currentNodeId": "ACT2_TEMPTATION",
    "previousNodeId": "ACT2_PROPHECY",
    "flags": {
      "FACTION_A_JOINED": true,
      "FACTION_LEADER_MET": true,
      "SACRIFICE_PATH_UNLOCKED": true,
      "ALLY_MARCUS_ALIVE": true,
      "ALLY_ELENA_ALIVE": true
    },
    "stats": {
      "health": 85,
      "maxHealth": 100
    },
    "inventory": [
      { "itemId": "ITEM_SACRED_AMULET", "quantity": 1 },
      { "itemId": "ITEM_SURVIVAL_KIT", "quantity": 1 },
      { "itemId": "ITEM_MAP_FRAGMENT_1", "quantity": 1 }
    ],
    "factions": {
      "factionA": 62,
      "factionB": 45,
      "factionC": 38
    },
    "visitedNodes": ["ACT1_START", "ACT1_FACTION_CHOICE", "..."],
    "choicesMade": [
      { "nodeId": "ACT1_FACTION_CHOICE", "choiceId": "join_a", "timestamp": 1703790000000 }
    ]
  },
  "checksum": "a1b2c3d4e5f6..."
}
```

---

*This document is maintained by Agent C (Systems Engineer). Updates require PR review by Agent A (integration) or Agent F (testability).*
