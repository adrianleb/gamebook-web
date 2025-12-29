/**
 * Performance Analyzer Tool
 *
 * Measures and validates game performance against GDD M5.5 thresholds:
 * - Initial load time < 3 seconds
 * - Scene transitions < 100ms
 * - Save/load operations < 500ms
 * - Memory usage stability over extended play
 *
 * Uses Performance API for timing measurements.
 *
 * @module tools/performance-analyzer
 */

import type {
  ContentManifest,
  GameState,
  Node,
} from '../engine/types';

// =============================================================================
// Performance Thresholds (from GDD M5.5)
// =============================================================================

export const PERFORMANCE_THRESHOLDS = {
  /** Initial load time threshold in milliseconds */
  LOAD_TIME_MS: 3000,
  /** Scene transition threshold in milliseconds */
  TRANSITION_TIME_MS: 100,
  /** Save operation threshold in milliseconds */
  SAVE_TIME_MS: 500,
  /** Load operation threshold in milliseconds */
  LOAD_TIME_SAVE_MS: 500,
  /** Memory growth threshold per 100 transitions (MB) */
  MEMORY_GROWTH_MB_PER_100: 5,
  /** Maximum baseline memory usage (MB) */
  MAX_BASELINE_MEMORY_MB: 50,
} as const;

// =============================================================================
// Types
// =============================================================================

export interface PerformanceReport {
  valid: boolean;
  timestamp: number;
  loadTime: LoadTimeMetrics;
  transitions: TransitionMetrics;
  saveLoad: SaveLoadMetrics;
  memory: MemoryMetrics;
  summary: PerformanceSummary;
}

export interface LoadTimeMetrics {
  contentLoadMs: number;
  initialStateSetupMs: number;
  totalLoadMs: number;
  passesThreshold: boolean;
  threshold: number;
}

export interface TransitionMetrics {
  samples: TransitionSample[];
  averageMs: number;
  maxMs: number;
  minMs: number;
  p95Ms: number;
  passesThreshold: boolean;
  threshold: number;
}

export interface TransitionSample {
  fromNodeId: string;
  toNodeId: string;
  durationMs: number;
  effectCount: number;
}

export interface SaveLoadMetrics {
  saveSamples: SaveLoadSample[];
  loadSamples: SaveLoadSample[];
  averageSaveMs: number;
  averageLoadMs: number;
  maxSaveMs: number;
  maxLoadMs: number;
  passesThreshold: boolean;
  saveThreshold: number;
  loadThreshold: number;
}

export interface SaveLoadSample {
  slot: number;
  durationMs: number;
  stateSize: number;
}

export interface MemoryMetrics {
  baselineHeapMB: number | null;
  finalHeapMB: number | null;
  peakHeapMB: number | null;
  growthMB: number | null;
  transitionCount: number;
  growthPerTransition: number | null;
  passesThreshold: boolean;
  available: boolean;
}

export interface PerformanceSummary {
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  warnings: string[];
  errors: string[];
}

// =============================================================================
// Performance Measurement Utilities
// =============================================================================

/**
 * High-precision timer using Performance API.
 */
export function now(): number {
  if (typeof performance !== 'undefined' && performance.now) {
    return performance.now();
  }
  return Date.now();
}

/**
 * Measures execution time of a synchronous function.
 */
export function measureSync<T>(fn: () => T): { result: T; durationMs: number } {
  const start = now();
  const result = fn();
  const durationMs = now() - start;
  return { result, durationMs };
}

/**
 * Measures execution time of an async function.
 */
export async function measureAsync<T>(
  fn: () => Promise<T>
): Promise<{ result: T; durationMs: number }> {
  const start = now();
  const result = await fn();
  const durationMs = now() - start;
  return { result, durationMs };
}

/**
 * Gets current heap memory usage in MB (if available).
 * Uses Performance.memory API (Chrome-only).
 */
export function getHeapUsageMB(): number | null {
  if (
    typeof performance !== 'undefined' &&
    'memory' in performance &&
    (performance as unknown as { memory?: { usedJSHeapSize?: number } }).memory
  ) {
    const memory = (performance as unknown as { memory: { usedJSHeapSize: number } }).memory;
    return memory.usedJSHeapSize / (1024 * 1024);
  }
  return null;
}

/**
 * Calculates percentile from sorted array.
 */
function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil((p / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, index)] ?? 0;
}

// =============================================================================
// Performance Analyzer Class
// =============================================================================

export class PerformanceAnalyzer {
  private transitionSamples: TransitionSample[] = [];
  private saveSamples: SaveLoadSample[] = [];
  private loadSamples: SaveLoadSample[] = [];
  private baselineHeapMB: number | null = null;
  private peakHeapMB: number | null = null;
  private contentLoadMs: number = 0;
  private initialStateSetupMs: number = 0;

  /**
   * Records baseline memory usage.
   * Call this after initial content load.
   */
  recordBaseline(): void {
    this.baselineHeapMB = getHeapUsageMB();
    this.peakHeapMB = this.baselineHeapMB;
  }

  /**
   * Records content load timing.
   */
  recordContentLoad(durationMs: number): void {
    this.contentLoadMs = durationMs;
  }

  /**
   * Records initial state setup timing.
   */
  recordInitialStateSetup(durationMs: number): void {
    this.initialStateSetupMs = durationMs;
  }

  /**
   * Records a scene transition sample.
   */
  recordTransition(sample: TransitionSample): void {
    this.transitionSamples.push(sample);

    // Update peak memory
    const currentHeap = getHeapUsageMB();
    if (currentHeap !== null && (this.peakHeapMB === null || currentHeap > this.peakHeapMB)) {
      this.peakHeapMB = currentHeap;
    }
  }

  /**
   * Records a save operation sample.
   */
  recordSave(sample: SaveLoadSample): void {
    this.saveSamples.push(sample);
  }

  /**
   * Records a load operation sample.
   */
  recordLoad(sample: SaveLoadSample): void {
    this.loadSamples.push(sample);
  }

  /**
   * Generates the performance report.
   */
  generateReport(): PerformanceReport {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Load time metrics
    const totalLoadMs = this.contentLoadMs + this.initialStateSetupMs;
    const loadPassesThreshold = totalLoadMs < PERFORMANCE_THRESHOLDS.LOAD_TIME_MS;

    if (!loadPassesThreshold) {
      errors.push(
        `Load time ${totalLoadMs.toFixed(0)}ms exceeds threshold of ${PERFORMANCE_THRESHOLDS.LOAD_TIME_MS}ms`
      );
    }

    const loadTime: LoadTimeMetrics = {
      contentLoadMs: this.contentLoadMs,
      initialStateSetupMs: this.initialStateSetupMs,
      totalLoadMs,
      passesThreshold: loadPassesThreshold,
      threshold: PERFORMANCE_THRESHOLDS.LOAD_TIME_MS,
    };

    // Transition metrics
    const transitionDurations = this.transitionSamples.map(s => s.durationMs).sort((a, b) => a - b);
    const avgTransition = transitionDurations.length > 0
      ? transitionDurations.reduce((a, b) => a + b, 0) / transitionDurations.length
      : 0;
    const maxTransition = transitionDurations.length > 0
      ? Math.max(...transitionDurations)
      : 0;
    const minTransition = transitionDurations.length > 0
      ? Math.min(...transitionDurations)
      : 0;
    const p95Transition = percentile(transitionDurations, 95);
    const transitionPassesThreshold = maxTransition < PERFORMANCE_THRESHOLDS.TRANSITION_TIME_MS;

    if (!transitionPassesThreshold) {
      errors.push(
        `Max transition time ${maxTransition.toFixed(1)}ms exceeds threshold of ${PERFORMANCE_THRESHOLDS.TRANSITION_TIME_MS}ms`
      );
    }

    if (this.transitionSamples.length < 10) {
      warnings.push(
        `Only ${this.transitionSamples.length} transition samples collected. Need more for reliable metrics.`
      );
    }

    const transitions: TransitionMetrics = {
      samples: this.transitionSamples,
      averageMs: avgTransition,
      maxMs: maxTransition,
      minMs: minTransition,
      p95Ms: p95Transition,
      passesThreshold: transitionPassesThreshold,
      threshold: PERFORMANCE_THRESHOLDS.TRANSITION_TIME_MS,
    };

    // Save/Load metrics
    const saveDurations = this.saveSamples.map(s => s.durationMs);
    const loadDurations = this.loadSamples.map(s => s.durationMs);

    const avgSave = saveDurations.length > 0
      ? saveDurations.reduce((a, b) => a + b, 0) / saveDurations.length
      : 0;
    const avgLoad = loadDurations.length > 0
      ? loadDurations.reduce((a, b) => a + b, 0) / loadDurations.length
      : 0;
    const maxSave = saveDurations.length > 0 ? Math.max(...saveDurations) : 0;
    const maxLoad = loadDurations.length > 0 ? Math.max(...loadDurations) : 0;

    const saveLoadPassesThreshold =
      maxSave < PERFORMANCE_THRESHOLDS.SAVE_TIME_MS &&
      maxLoad < PERFORMANCE_THRESHOLDS.LOAD_TIME_SAVE_MS;

    if (maxSave >= PERFORMANCE_THRESHOLDS.SAVE_TIME_MS) {
      errors.push(
        `Max save time ${maxSave.toFixed(1)}ms exceeds threshold of ${PERFORMANCE_THRESHOLDS.SAVE_TIME_MS}ms`
      );
    }
    if (maxLoad >= PERFORMANCE_THRESHOLDS.LOAD_TIME_SAVE_MS) {
      errors.push(
        `Max load time ${maxLoad.toFixed(1)}ms exceeds threshold of ${PERFORMANCE_THRESHOLDS.LOAD_TIME_SAVE_MS}ms`
      );
    }

    if (this.saveSamples.length < 3) {
      warnings.push(
        `Only ${this.saveSamples.length} save samples collected. Need more for reliable metrics.`
      );
    }

    const saveLoad: SaveLoadMetrics = {
      saveSamples: this.saveSamples,
      loadSamples: this.loadSamples,
      averageSaveMs: avgSave,
      averageLoadMs: avgLoad,
      maxSaveMs: maxSave,
      maxLoadMs: maxLoad,
      passesThreshold: saveLoadPassesThreshold,
      saveThreshold: PERFORMANCE_THRESHOLDS.SAVE_TIME_MS,
      loadThreshold: PERFORMANCE_THRESHOLDS.LOAD_TIME_SAVE_MS,
    };

    // Memory metrics
    const finalHeapMB = getHeapUsageMB();
    const growthMB = this.baselineHeapMB !== null && finalHeapMB !== null
      ? finalHeapMB - this.baselineHeapMB
      : null;
    const growthPerTransition = growthMB !== null && this.transitionSamples.length > 0
      ? growthMB / this.transitionSamples.length
      : null;

    // Check for memory leak: growth per 100 transitions should be < threshold
    const expectedGrowthPer100 = growthPerTransition !== null
      ? growthPerTransition * 100
      : null;
    const memoryPassesThreshold = expectedGrowthPer100 === null ||
      expectedGrowthPer100 < PERFORMANCE_THRESHOLDS.MEMORY_GROWTH_MB_PER_100;

    if (!memoryPassesThreshold && expectedGrowthPer100 !== null) {
      errors.push(
        `Memory growth ${expectedGrowthPer100.toFixed(2)}MB per 100 transitions exceeds threshold of ${PERFORMANCE_THRESHOLDS.MEMORY_GROWTH_MB_PER_100}MB`
      );
    }

    if (this.baselineHeapMB === null) {
      warnings.push('Memory metrics unavailable (Performance.memory API not supported)');
    }

    const memory: MemoryMetrics = {
      baselineHeapMB: this.baselineHeapMB,
      finalHeapMB,
      peakHeapMB: this.peakHeapMB,
      growthMB,
      transitionCount: this.transitionSamples.length,
      growthPerTransition,
      passesThreshold: memoryPassesThreshold,
      available: this.baselineHeapMB !== null,
    };

    // Summary
    const checks = [
      loadPassesThreshold,
      transitionPassesThreshold,
      saveLoadPassesThreshold,
      memoryPassesThreshold,
    ];
    const passedChecks = checks.filter(Boolean).length;

    const summary: PerformanceSummary = {
      totalChecks: checks.length,
      passedChecks,
      failedChecks: checks.length - passedChecks,
      warnings,
      errors,
    };

    return {
      valid: errors.length === 0,
      timestamp: Date.now(),
      loadTime,
      transitions,
      saveLoad,
      memory,
      summary,
    };
  }

  /**
   * Resets all collected metrics.
   */
  reset(): void {
    this.transitionSamples = [];
    this.saveSamples = [];
    this.loadSamples = [];
    this.baselineHeapMB = null;
    this.peakHeapMB = null;
    this.contentLoadMs = 0;
    this.initialStateSetupMs = 0;
  }
}

// =============================================================================
// Static Analysis (for CLI tool)
// =============================================================================

export interface StaticAnalysisResult {
  nodeCount: number;
  totalChoices: number;
  totalEffects: number;
  averageChoicesPerNode: number;
  averageEffectsPerChoice: number;
  maxEffectsOnChoice: number;
  largestNode: { id: string; choiceCount: number };
  estimatedStateSize: number;
  warnings: string[];
}

/**
 * Performs static analysis on content manifest to estimate performance characteristics.
 */
export function analyzeContentComplexity(manifest: ContentManifest): StaticAnalysisResult {
  const warnings: string[] = [];

  let totalChoices = 0;
  let totalEffects = 0;
  let maxEffectsOnChoice = 0;
  let largestNode = { id: '', choiceCount: 0 };

  for (const node of manifest.nodes) {
    totalChoices += node.choices.length;

    if (node.choices.length > largestNode.choiceCount) {
      largestNode = { id: node.id, choiceCount: node.choices.length };
    }

    // Count onEnter effects
    if (node.onEnter) {
      totalEffects += node.onEnter.length;
    }

    // Count choice effects
    for (const choice of node.choices) {
      const effectCount = choice.effects?.length ?? 0;
      totalEffects += effectCount;
      if (effectCount > maxEffectsOnChoice) {
        maxEffectsOnChoice = effectCount;
      }
    }
  }

  const averageChoicesPerNode = manifest.nodes.length > 0
    ? totalChoices / manifest.nodes.length
    : 0;
  const averageEffectsPerChoice = totalChoices > 0
    ? totalEffects / totalChoices
    : 0;

  // Estimate serialized state size (rough approximation)
  // A typical game state with 100 visited nodes, 50 flags, 10 inventory items
  const estimatedStateSize = JSON.stringify({
    currentNodeId: 'ACT1_START',
    flags: Object.fromEntries(Array(50).fill(0).map((_, i) => [`flag_${i}`, true])),
    stats: { health: 100 },
    inventory: Array(10).fill(0).map((_, i) => ({ itemId: `item_${i}`, quantity: 1 })),
    factions: { A: 50, B: 50, C: 50 },
    visitedNodes: Array(100).fill(0).map((_, i) => `node_${i}`),
    choicesMade: Array(100).fill(0).map((_, i) => ({
      nodeId: `node_${i}`,
      choiceId: `choice_${i}`,
      timestamp: Date.now(),
    })),
  }).length;

  if (maxEffectsOnChoice > 10) {
    warnings.push(
      `Some choices have ${maxEffectsOnChoice} effects - may impact transition performance`
    );
  }

  if (largestNode.choiceCount > 10) {
    warnings.push(
      `Node ${largestNode.id} has ${largestNode.choiceCount} choices - may impact condition evaluation`
    );
  }

  return {
    nodeCount: manifest.nodes.length,
    totalChoices,
    totalEffects,
    averageChoicesPerNode,
    averageEffectsPerChoice,
    maxEffectsOnChoice,
    largestNode,
    estimatedStateSize,
    warnings,
  };
}

// =============================================================================
// Report Formatting
// =============================================================================

export function formatReport(report: PerformanceReport): string {
  const lines: string[] = [];

  lines.push('========================================');
  lines.push('  Performance Analysis Report');
  lines.push('========================================');
  lines.push(`Generated: ${new Date(report.timestamp).toISOString()}`);
  lines.push('');

  // Load Time
  lines.push('LOAD TIME');
  lines.push('---------');
  const loadStatus = report.loadTime.passesThreshold ? '✓ PASS' : '✗ FAIL';
  lines.push(`${loadStatus} Total: ${report.loadTime.totalLoadMs.toFixed(1)}ms (threshold: ${report.loadTime.threshold}ms)`);
  lines.push(`  - Content load: ${report.loadTime.contentLoadMs.toFixed(1)}ms`);
  lines.push(`  - State setup: ${report.loadTime.initialStateSetupMs.toFixed(1)}ms`);
  lines.push('');

  // Transitions
  lines.push('SCENE TRANSITIONS');
  lines.push('-----------------');
  const transitionStatus = report.transitions.passesThreshold ? '✓ PASS' : '✗ FAIL';
  lines.push(`${transitionStatus} Max: ${report.transitions.maxMs.toFixed(1)}ms (threshold: ${report.transitions.threshold}ms)`);
  lines.push(`  - Average: ${report.transitions.averageMs.toFixed(1)}ms`);
  lines.push(`  - P95: ${report.transitions.p95Ms.toFixed(1)}ms`);
  lines.push(`  - Min: ${report.transitions.minMs.toFixed(1)}ms`);
  lines.push(`  - Samples: ${report.transitions.samples.length}`);
  lines.push('');

  // Save/Load
  lines.push('SAVE/LOAD OPERATIONS');
  lines.push('--------------------');
  const saveLoadStatus = report.saveLoad.passesThreshold ? '✓ PASS' : '✗ FAIL';
  lines.push(`${saveLoadStatus} Save: ${report.saveLoad.maxSaveMs.toFixed(1)}ms max (threshold: ${report.saveLoad.saveThreshold}ms)`);
  lines.push(`${saveLoadStatus} Load: ${report.saveLoad.maxLoadMs.toFixed(1)}ms max (threshold: ${report.saveLoad.loadThreshold}ms)`);
  lines.push(`  - Average save: ${report.saveLoad.averageSaveMs.toFixed(1)}ms`);
  lines.push(`  - Average load: ${report.saveLoad.averageLoadMs.toFixed(1)}ms`);
  lines.push(`  - Save samples: ${report.saveLoad.saveSamples.length}`);
  lines.push(`  - Load samples: ${report.saveLoad.loadSamples.length}`);
  lines.push('');

  // Memory
  lines.push('MEMORY USAGE');
  lines.push('------------');
  if (report.memory.available) {
    const memoryStatus = report.memory.passesThreshold ? '✓ PASS' : '✗ FAIL';
    lines.push(`${memoryStatus} Memory stability check`);
    lines.push(`  - Baseline: ${report.memory.baselineHeapMB?.toFixed(2) ?? 'N/A'}MB`);
    lines.push(`  - Final: ${report.memory.finalHeapMB?.toFixed(2) ?? 'N/A'}MB`);
    lines.push(`  - Peak: ${report.memory.peakHeapMB?.toFixed(2) ?? 'N/A'}MB`);
    lines.push(`  - Growth: ${report.memory.growthMB?.toFixed(2) ?? 'N/A'}MB over ${report.memory.transitionCount} transitions`);
    if (report.memory.growthPerTransition !== null) {
      lines.push(`  - Growth per transition: ${(report.memory.growthPerTransition * 1000).toFixed(2)}KB`);
    }
  } else {
    lines.push('⚠ Memory metrics unavailable (requires Chrome DevTools)');
  }
  lines.push('');

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
  lines.push(`  RESULT: ${report.valid ? 'PASS' : 'FAIL'} (${report.summary.passedChecks}/${report.summary.totalChecks} checks passed)`);
  lines.push('========================================');

  return lines.join('\n');
}

export function formatStaticAnalysis(analysis: StaticAnalysisResult): string {
  const lines: string[] = [];

  lines.push('========================================');
  lines.push('  Content Complexity Analysis');
  lines.push('========================================');
  lines.push('');

  lines.push('CONTENT STATS');
  lines.push('-------------');
  lines.push(`Total nodes: ${analysis.nodeCount}`);
  lines.push(`Total choices: ${analysis.totalChoices}`);
  lines.push(`Total effects: ${analysis.totalEffects}`);
  lines.push(`Avg choices per node: ${analysis.averageChoicesPerNode.toFixed(2)}`);
  lines.push(`Avg effects per choice: ${analysis.averageEffectsPerChoice.toFixed(2)}`);
  lines.push(`Max effects on single choice: ${analysis.maxEffectsOnChoice}`);
  lines.push(`Largest node: ${analysis.largestNode.id} (${analysis.largestNode.choiceCount} choices)`);
  lines.push(`Estimated max state size: ${(analysis.estimatedStateSize / 1024).toFixed(2)}KB`);
  lines.push('');

  if (analysis.warnings.length > 0) {
    lines.push('WARNINGS');
    lines.push('--------');
    for (const warning of analysis.warnings) {
      lines.push(`[WARN] ${warning}`);
    }
  }

  return lines.join('\n');
}
