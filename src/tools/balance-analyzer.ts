/**
 * Balance Analyzer Tool
 *
 * Validates game balance by analyzing:
 * - Stat/faction threshold requirements in conditions
 * - Item acquisition and requirement paths
 * - Ending reachability from initial state
 *
 * Part of M5.3 Difficulty & Balance Review.
 *
 * @module tools/balance-analyzer
 */

import type {
  ContentManifest,
  Node,
  Condition,
  Effect,
  InitialState,
} from '../engine/types';

// =============================================================================
// Types
// =============================================================================

export interface BalanceReport {
  valid: boolean;
  thresholds: ThresholdAnalysis;
  items: ItemAnalysis;
  endings: EndingAnalysis;
  summary: BalanceSummary;
}

export interface ThresholdAnalysis {
  stats: ThresholdEntry[];
  factions: ThresholdEntry[];
  warnings: string[];
}

export interface ThresholdEntry {
  name: string;
  initialValue: number;
  minRequired: number | null;
  maxRequired: number | null;
  minAchievable: number;
  maxAchievable: number;
  reachable: boolean;
  usedInNodes: string[];
}

export interface ItemAnalysis {
  items: ItemEntry[];
  warnings: string[];
}

export interface ItemEntry {
  itemId: string;
  requiredBy: string[];
  grantedBy: string[];
  reachable: boolean;
  requiredBeforeGranted: boolean;
}

export interface EndingAnalysis {
  endings: EndingEntry[];
  allReachable: boolean;
  warnings: string[];
}

export interface EndingEntry {
  nodeId: string;
  title: string;
  reachable: boolean;
  conditionsSatisfiable: boolean;
  blockers: string[];
}

export interface BalanceSummary {
  totalNodes: number;
  totalItems: number;
  totalEndings: number;
  reachableEndings: number;
  unreachableThresholds: number;
  unreachableItems: number;
  errors: string[];
  warnings: string[];
}

// =============================================================================
// Threshold Extraction
// =============================================================================

interface ConditionThreshold {
  type: 'stat' | 'faction';
  name: string;
  operator: string;
  value: number;
  nodeId: string;
  choiceId?: string;
}

function extractThresholdsFromCondition(
  condition: Condition,
  nodeId: string,
  choiceId?: string
): ConditionThreshold[] {
  const thresholds: ConditionThreshold[] = [];

  switch (condition.type) {
    case 'stat':
      thresholds.push({
        type: 'stat',
        name: condition.stat,
        operator: condition.operator,
        value: condition.value,
        nodeId,
        ...(choiceId !== undefined && { choiceId }),
      });
      break;

    case 'faction':
      thresholds.push({
        type: 'faction',
        name: condition.faction,
        operator: condition.operator,
        value: condition.value,
        nodeId,
        ...(choiceId !== undefined && { choiceId }),
      });
      break;

    case 'not':
      thresholds.push(
        ...extractThresholdsFromCondition(condition.condition, nodeId, choiceId)
      );
      break;

    case 'and':
    case 'or':
      for (const c of condition.conditions) {
        thresholds.push(...extractThresholdsFromCondition(c, nodeId, choiceId));
      }
      break;
  }

  return thresholds;
}

function extractAllThresholds(nodes: Node[]): ConditionThreshold[] {
  const thresholds: ConditionThreshold[] = [];

  for (const node of nodes) {
    for (const choice of node.choices) {
      if (choice.conditions) {
        for (const condition of choice.conditions) {
          thresholds.push(
            ...extractThresholdsFromCondition(condition, node.id, choice.id)
          );
        }
      }
    }
  }

  return thresholds;
}

// =============================================================================
// Effect Analysis
// =============================================================================

interface EffectDelta {
  type: 'stat' | 'faction';
  name: string;
  delta: number;
  absolute?: number;
  nodeId: string;
  choiceId?: string;
}

function extractEffectDeltas(
  effects: Effect[] | undefined,
  nodeId: string,
  choiceId?: string
): EffectDelta[] {
  if (!effects) return [];

  const deltas: EffectDelta[] = [];

  for (const effect of effects) {
    switch (effect.type) {
      case 'modifyStat':
        deltas.push({
          type: 'stat',
          name: effect.stat,
          delta: effect.delta,
          nodeId,
          ...(choiceId !== undefined && { choiceId }),
        });
        break;

      case 'setStat':
        deltas.push({
          type: 'stat',
          name: effect.stat,
          delta: 0,
          absolute: effect.value,
          nodeId,
          ...(choiceId !== undefined && { choiceId }),
        });
        break;

      case 'modifyFaction':
        deltas.push({
          type: 'faction',
          name: effect.faction,
          delta: effect.delta,
          nodeId,
          ...(choiceId !== undefined && { choiceId }),
        });
        break;

      case 'setFaction':
        deltas.push({
          type: 'faction',
          name: effect.faction,
          delta: 0,
          absolute: effect.value,
          nodeId,
          ...(choiceId !== undefined && { choiceId }),
        });
        break;
    }
  }

  return deltas;
}

function extractAllEffects(nodes: Node[]): EffectDelta[] {
  const deltas: EffectDelta[] = [];

  for (const node of nodes) {
    // Node onEnter effects
    deltas.push(...extractEffectDeltas(node.onEnter, node.id));

    // Choice effects
    for (const choice of node.choices) {
      deltas.push(...extractEffectDeltas(choice.effects, node.id, choice.id));
    }
  }

  return deltas;
}

// =============================================================================
// Threshold Analysis
// =============================================================================

function analyzeThresholds(
  nodes: Node[],
  initialState: InitialState
): ThresholdAnalysis {
  const thresholds = extractAllThresholds(nodes);
  const effects = extractAllEffects(nodes);
  const warnings: string[] = [];

  // Group thresholds by stat/faction name
  const statThresholds = new Map<string, ConditionThreshold[]>();
  const factionThresholds = new Map<string, ConditionThreshold[]>();

  for (const t of thresholds) {
    const map = t.type === 'stat' ? statThresholds : factionThresholds;
    if (!map.has(t.name)) {
      map.set(t.name, []);
    }
    map.get(t.name)!.push(t);
  }

  // Calculate achievable ranges
  const statDeltas = new Map<string, { positive: number; negative: number }>();
  const factionDeltas = new Map<
    string,
    { positive: number; negative: number }
  >();

  for (const e of effects) {
    const map = e.type === 'stat' ? statDeltas : factionDeltas;
    if (!map.has(e.name)) {
      map.set(e.name, { positive: 0, negative: 0 });
    }
    const entry = map.get(e.name)!;

    if (e.absolute !== undefined) {
      // For absolute sets, track both as possible deltas
      entry.positive = Math.max(entry.positive, e.absolute);
      entry.negative = Math.min(entry.negative, -e.absolute);
    } else if (e.delta > 0) {
      entry.positive += e.delta;
    } else {
      entry.negative += e.delta;
    }
  }

  // Analyze stats
  const statEntries: ThresholdEntry[] = [];
  for (const [name, conditions] of statThresholds) {
    const initial = initialState.stats[name] ?? 0;
    const deltas = statDeltas.get(name) ?? { positive: 0, negative: 0 };

    const minAchievable = Math.max(0, initial + deltas.negative);
    const maxAchievable = initial + deltas.positive;

    // Determine required range from conditions
    let minRequired: number | null = null;
    let maxRequired: number | null = null;

    for (const c of conditions) {
      switch (c.operator) {
        case '>=':
          minRequired =
            minRequired === null ? c.value : Math.max(minRequired, c.value);
          break;
        case '>':
          minRequired =
            minRequired === null
              ? c.value + 1
              : Math.max(minRequired, c.value + 1);
          break;
        case '<=':
          maxRequired =
            maxRequired === null ? c.value : Math.min(maxRequired, c.value);
          break;
        case '<':
          maxRequired =
            maxRequired === null
              ? c.value - 1
              : Math.min(maxRequired, c.value - 1);
          break;
      }
    }

    const reachable =
      (minRequired === null || maxAchievable >= minRequired) &&
      (maxRequired === null || minAchievable <= maxRequired);

    if (!reachable) {
      warnings.push(
        `Stat "${name}" threshold may be unreachable: requires ${minRequired ?? '?'}-${maxRequired ?? '?'}, achievable ${minAchievable}-${maxAchievable}`
      );
    }

    statEntries.push({
      name,
      initialValue: initial,
      minRequired,
      maxRequired,
      minAchievable,
      maxAchievable,
      reachable,
      usedInNodes: [...new Set(conditions.map((c) => c.nodeId))],
    });
  }

  // Analyze factions
  const factionEntries: ThresholdEntry[] = [];
  for (const [name, conditions] of factionThresholds) {
    const initial = initialState.factions[name] ?? 50;
    const deltas = factionDeltas.get(name) ?? { positive: 0, negative: 0 };

    // Factions are clamped 0-100
    const minAchievable = Math.max(0, initial + deltas.negative);
    const maxAchievable = Math.min(100, initial + deltas.positive);

    let minRequired: number | null = null;
    let maxRequired: number | null = null;

    for (const c of conditions) {
      switch (c.operator) {
        case '>=':
          minRequired =
            minRequired === null ? c.value : Math.max(minRequired, c.value);
          break;
        case '>':
          minRequired =
            minRequired === null
              ? c.value + 1
              : Math.max(minRequired, c.value + 1);
          break;
        case '<=':
          maxRequired =
            maxRequired === null ? c.value : Math.min(maxRequired, c.value);
          break;
        case '<':
          maxRequired =
            maxRequired === null
              ? c.value - 1
              : Math.min(maxRequired, c.value - 1);
          break;
      }
    }

    const reachable =
      (minRequired === null || maxAchievable >= minRequired) &&
      (maxRequired === null || minAchievable <= maxRequired);

    if (!reachable) {
      warnings.push(
        `Faction "${name}" threshold may be unreachable: requires ${minRequired ?? '?'}-${maxRequired ?? '?'}, achievable ${minAchievable}-${maxAchievable}`
      );
    }

    factionEntries.push({
      name,
      initialValue: initial,
      minRequired,
      maxRequired,
      minAchievable,
      maxAchievable,
      reachable,
      usedInNodes: [...new Set(conditions.map((c) => c.nodeId))],
    });
  }

  return {
    stats: statEntries,
    factions: factionEntries,
    warnings,
  };
}

// =============================================================================
// Item Analysis
// =============================================================================

interface ItemReference {
  itemId: string;
  nodeId: string;
  choiceId?: string;
  type: 'required' | 'granted' | 'removed';
}

function extractItemReferences(nodes: Node[]): ItemReference[] {
  const refs: ItemReference[] = [];

  for (const node of nodes) {
    // Check onEnter effects
    if (node.onEnter) {
      for (const effect of node.onEnter) {
        if (effect.type === 'addItem') {
          refs.push({
            itemId: effect.itemId,
            nodeId: node.id,
            type: 'granted',
          });
        } else if (effect.type === 'removeItem') {
          refs.push({
            itemId: effect.itemId,
            nodeId: node.id,
            type: 'removed',
          });
        }
      }
    }

    // Check choices
    for (const choice of node.choices) {
      // Item conditions
      if (choice.conditions) {
        for (const condition of choice.conditions) {
          const itemRefs = extractItemConditions(
            condition,
            node.id,
            choice.id
          );
          refs.push(...itemRefs);
        }
      }

      // Item effects
      if (choice.effects) {
        for (const effect of choice.effects) {
          if (effect.type === 'addItem') {
            refs.push({
              itemId: effect.itemId,
              nodeId: node.id,
              choiceId: choice.id,
              type: 'granted',
            });
          } else if (effect.type === 'removeItem') {
            refs.push({
              itemId: effect.itemId,
              nodeId: node.id,
              choiceId: choice.id,
              type: 'removed',
            });
          }
        }
      }
    }
  }

  return refs;
}

function extractItemConditions(
  condition: Condition,
  nodeId: string,
  choiceId?: string
): ItemReference[] {
  const refs: ItemReference[] = [];

  switch (condition.type) {
    case 'item':
      if (condition.operator === 'has' || condition.operator === 'count') {
        refs.push({
          itemId: condition.itemId,
          nodeId,
          ...(choiceId !== undefined && { choiceId }),
          type: 'required',
        });
      }
      break;

    case 'not':
      refs.push(...extractItemConditions(condition.condition, nodeId, choiceId));
      break;

    case 'and':
    case 'or':
      for (const c of condition.conditions) {
        refs.push(...extractItemConditions(c, nodeId, choiceId));
      }
      break;
  }

  return refs;
}

function analyzeItems(
  nodes: Node[],
  initialState: InitialState
): ItemAnalysis {
  const refs = extractItemReferences(nodes);
  const warnings: string[] = [];

  // Group by item
  const itemMap = new Map<
    string,
    { required: string[]; granted: string[] }
  >();

  for (const ref of refs) {
    if (!itemMap.has(ref.itemId)) {
      itemMap.set(ref.itemId, { required: [], granted: [] });
    }
    const entry = itemMap.get(ref.itemId)!;

    if (ref.type === 'required') {
      entry.required.push(ref.nodeId);
    } else if (ref.type === 'granted') {
      entry.granted.push(ref.nodeId);
    }
  }

  // Check initial inventory
  const initialItems = new Set(
    initialState.inventory.map((e) => e.itemId)
  );

  const entries: ItemEntry[] = [];

  for (const [itemId, data] of itemMap) {
    const hasInitial = initialItems.has(itemId);
    const hasGrantSource = data.granted.length > 0;
    const reachable = hasInitial || hasGrantSource;

    // Check if item is required before it can be granted
    // This is a simple check - more sophisticated would require path analysis
    const requiredBeforeGranted =
      data.required.length > 0 && !hasInitial && !hasGrantSource;

    if (!reachable) {
      warnings.push(
        `Item "${itemId}" is required but never granted and not in initial inventory`
      );
    }

    if (requiredBeforeGranted) {
      warnings.push(
        `Item "${itemId}" may be required before player can acquire it`
      );
    }

    entries.push({
      itemId,
      requiredBy: [...new Set(data.required)],
      grantedBy: [...new Set(data.granted)],
      reachable,
      requiredBeforeGranted,
    });
  }

  return {
    items: entries,
    warnings,
  };
}

// =============================================================================
// Ending Reachability
// =============================================================================

function findReachableNodes(
  nodes: Node[],
  startId: string
): Set<string> {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const reachable = new Set<string>();
  const queue = [startId];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (reachable.has(nodeId)) continue;
    reachable.add(nodeId);

    const node = nodeMap.get(nodeId);
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

function analyzeEndings(
  nodes: Node[],
  initialState: InitialState
): EndingAnalysis {
  const warnings: string[] = [];
  const reachableNodes = findReachableNodes(nodes, initialState.currentNodeId);

  const endingNodes = nodes.filter((n) => n.tags?.includes('ending'));
  const entries: EndingEntry[] = [];

  for (const node of endingNodes) {
    const reachable = reachableNodes.has(node.id);
    const blockers: string[] = [];

    if (!reachable) {
      blockers.push('Node not reachable from start via graph traversal');
    }

    // Check if the ending node has choices with conditions that might be blocking
    // This is a simplified check - true reachability would need simulation
    let conditionsSatisfiable = true;

    // For an ending, check if any inbound choice has impossible conditions
    // (This would require more sophisticated analysis in practice)

    if (!reachable) {
      warnings.push(`Ending "${node.id}" (${node.title}) is not reachable`);
    }

    entries.push({
      nodeId: node.id,
      title: node.title,
      reachable,
      conditionsSatisfiable,
      blockers,
    });
  }

  return {
    endings: entries,
    allReachable: entries.every((e) => e.reachable),
    warnings,
  };
}

// =============================================================================
// Main Analysis
// =============================================================================

export function analyzeBalance(manifest: ContentManifest): BalanceReport {
  const { nodes } = manifest;

  // Provide default initialState for content files that don't define it
  // (act2/act3 don't have initialState - they're loaded with act1)
  const initialState: InitialState = manifest.initialState ?? {
    currentNodeId: nodes[0]?.id ?? 'unknown',
    flags: {},
    stats: { health: 100, maxHealth: 100 },
    inventory: [],
    factions: {},
  };

  const thresholds = analyzeThresholds(nodes, initialState);
  const items = analyzeItems(nodes, initialState);
  const endings = analyzeEndings(nodes, initialState);

  const errors: string[] = [];
  const warnings: string[] = [
    ...thresholds.warnings,
    ...items.warnings,
    ...endings.warnings,
  ];

  // Generate errors for critical issues
  if (!endings.allReachable) {
    errors.push(
      `${endings.endings.filter((e) => !e.reachable).length} ending(s) are not reachable`
    );
  }

  const unreachableThresholds =
    thresholds.stats.filter((s) => !s.reachable).length +
    thresholds.factions.filter((f) => !f.reachable).length;

  if (unreachableThresholds > 0) {
    errors.push(
      `${unreachableThresholds} stat/faction threshold(s) may be unreachable`
    );
  }

  const unreachableItems = items.items.filter((i) => !i.reachable).length;
  if (unreachableItems > 0) {
    errors.push(`${unreachableItems} required item(s) are never granted`);
  }

  const summary: BalanceSummary = {
    totalNodes: nodes.length,
    totalItems: manifest.items.length,
    totalEndings: endings.endings.length,
    reachableEndings: endings.endings.filter((e) => e.reachable).length,
    unreachableThresholds,
    unreachableItems,
    errors,
    warnings,
  };

  return {
    valid: errors.length === 0,
    thresholds,
    items,
    endings,
    summary,
  };
}

// =============================================================================
// CLI Runner
// =============================================================================

export function formatReport(report: BalanceReport): string {
  const lines: string[] = [];

  lines.push('========================================');
  lines.push('  Balance Analysis Report');
  lines.push('========================================');
  lines.push('');

  // Summary
  lines.push('SUMMARY');
  lines.push('-------');
  lines.push(`Total Nodes: ${report.summary.totalNodes}`);
  lines.push(`Total Items: ${report.summary.totalItems}`);
  lines.push(
    `Endings: ${report.summary.reachableEndings}/${report.summary.totalEndings} reachable`
  );
  lines.push(`Unreachable Thresholds: ${report.summary.unreachableThresholds}`);
  lines.push(`Unreachable Items: ${report.summary.unreachableItems}`);
  lines.push('');

  // Thresholds
  if (
    report.thresholds.stats.length > 0 ||
    report.thresholds.factions.length > 0
  ) {
    lines.push('STAT/FACTION THRESHOLDS');
    lines.push('-----------------------');

    for (const stat of report.thresholds.stats) {
      const status = stat.reachable ? '✓' : '✗';
      lines.push(
        `${status} Stat "${stat.name}": initial=${stat.initialValue}, achievable=${stat.minAchievable}-${stat.maxAchievable}, required=${stat.minRequired ?? '?'}-${stat.maxRequired ?? '?'}`
      );
    }

    for (const faction of report.thresholds.factions) {
      const status = faction.reachable ? '✓' : '✗';
      lines.push(
        `${status} Faction "${faction.name}": initial=${faction.initialValue}, achievable=${faction.minAchievable}-${faction.maxAchievable}, required=${faction.minRequired ?? '?'}-${faction.maxRequired ?? '?'}`
      );
    }
    lines.push('');
  }

  // Items
  if (report.items.items.length > 0) {
    lines.push('ITEM REQUIREMENTS');
    lines.push('-----------------');

    for (const item of report.items.items) {
      const status = item.reachable ? '✓' : '✗';
      lines.push(
        `${status} "${item.itemId}": required by ${item.requiredBy.length} node(s), granted by ${item.grantedBy.length} node(s)`
      );
    }
    lines.push('');
  }

  // Endings
  if (report.endings.endings.length > 0) {
    lines.push('ENDING REACHABILITY');
    lines.push('-------------------');

    for (const ending of report.endings.endings) {
      const status = ending.reachable ? '✓' : '✗';
      lines.push(`${status} "${ending.nodeId}" (${ending.title})`);
      if (ending.blockers.length > 0) {
        for (const blocker of ending.blockers) {
          lines.push(`    - ${blocker}`);
        }
      }
    }
    lines.push('');
  }

  // Warnings
  if (report.summary.warnings.length > 0) {
    lines.push('WARNINGS');
    lines.push('--------');
    for (const warning of report.summary.warnings) {
      lines.push(`[WARN] ${warning}`);
    }
    lines.push('');
  }

  // Errors
  if (report.summary.errors.length > 0) {
    lines.push('ERRORS');
    lines.push('------');
    for (const error of report.summary.errors) {
      lines.push(`[ERROR] ${error}`);
    }
    lines.push('');
  }

  // Result
  lines.push('========================================');
  lines.push(report.valid ? '  RESULT: PASS' : '  RESULT: FAIL');
  lines.push('========================================');

  return lines.join('\n');
}
