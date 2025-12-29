/**
 * Performance Analyzer Tests
 *
 * @module tools/__tests__/performance-analyzer.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PerformanceAnalyzer,
  analyzeContentComplexity,
  formatReport,
  formatStaticAnalysis,
  measureSync,
  measureAsync,
  PERFORMANCE_THRESHOLDS,
  type PerformanceReport,
} from '../../src/tools/performance-analyzer';
import type { ContentManifest } from '../../src/engine/types';

// =============================================================================
// Test Fixtures
// =============================================================================

function createMinimalManifest(): ContentManifest {
  return {
    version: '1.0.0',
    nodes: [
      {
        id: 'START',
        title: 'Start',
        body: 'Beginning of the game.',
        choices: [
          {
            id: 'choice1',
            text: 'Go forward',
            targetId: 'NODE_1',
            effects: [{ type: 'setFlag', flag: 'STARTED' }],
          },
        ],
      },
      {
        id: 'NODE_1',
        title: 'Node 1',
        body: 'You went forward.',
        choices: [
          {
            id: 'choice2',
            text: 'Continue',
            targetId: 'END',
          },
        ],
        onEnter: [{ type: 'modifyStat', stat: 'health', delta: 10 }],
      },
      {
        id: 'END',
        title: 'The End',
        body: 'Game over.',
        choices: [],
        tags: ['ending'],
      },
    ],
    items: [
      {
        id: 'ITEM_TEST',
        name: 'Test Item',
        description: 'A test item.',
        usable: false,
        consumable: false,
      },
    ],
    initialState: {
      currentNodeId: 'START',
      flags: {},
      stats: { health: 100 },
      inventory: [],
      factions: { A: 50, B: 50, C: 50 },
    },
  };
}

function createComplexManifest(): ContentManifest {
  const nodes = [];

  // Create 50 nodes with varying complexity
  for (let i = 0; i < 50; i++) {
    const choices = [];
    const choiceCount = Math.min(5, (i % 5) + 1);

    for (let j = 0; j < choiceCount; j++) {
      const effects = [];
      const effectCount = (i + j) % 4;
      for (let k = 0; k < effectCount; k++) {
        effects.push({ type: 'setFlag' as const, flag: `FLAG_${i}_${j}_${k}` });
      }

      choices.push({
        id: `choice_${i}_${j}`,
        text: `Choice ${j}`,
        targetId: i < 49 ? `NODE_${i + 1}` : 'END',
        effects: effects.length > 0 ? effects : undefined,
      });
    }

    nodes.push({
      id: i === 0 ? 'START' : `NODE_${i}`,
      title: `Node ${i}`,
      body: `Body text for node ${i}.`,
      choices,
      onEnter: i % 3 === 0 ? [{ type: 'modifyStat' as const, stat: 'health', delta: 5 }] : undefined,
    });
  }

  // Add ending node
  nodes.push({
    id: 'END',
    title: 'The End',
    body: 'Game over.',
    choices: [],
    tags: ['ending'],
  });

  return {
    version: '1.0.0',
    nodes,
    items: [],
    initialState: {
      currentNodeId: 'START',
      flags: {},
      stats: { health: 100 },
      inventory: [],
      factions: { A: 50, B: 50, C: 50 },
    },
  };
}

// =============================================================================
// Tests: PerformanceAnalyzer Class
// =============================================================================

describe('PerformanceAnalyzer', () => {
  let analyzer: PerformanceAnalyzer;

  beforeEach(() => {
    analyzer = new PerformanceAnalyzer();
  });

  describe('recordContentLoad', () => {
    it('should record content load time', () => {
      analyzer.recordContentLoad(150);
      const report = analyzer.generateReport();

      expect(report.loadTime.contentLoadMs).toBe(150);
    });
  });

  describe('recordInitialStateSetup', () => {
    it('should record initial state setup time', () => {
      analyzer.recordInitialStateSetup(25);
      const report = analyzer.generateReport();

      expect(report.loadTime.initialStateSetupMs).toBe(25);
    });
  });

  describe('recordTransition', () => {
    it('should record transition samples', () => {
      analyzer.recordTransition({
        fromNodeId: 'START',
        toNodeId: 'NODE_1',
        durationMs: 5.5,
        effectCount: 2,
      });
      analyzer.recordTransition({
        fromNodeId: 'NODE_1',
        toNodeId: 'END',
        durationMs: 3.2,
        effectCount: 0,
      });

      const report = analyzer.generateReport();

      expect(report.transitions.samples.length).toBe(2);
      expect(report.transitions.averageMs).toBeCloseTo(4.35, 1);
      expect(report.transitions.maxMs).toBe(5.5);
      expect(report.transitions.minMs).toBe(3.2);
    });
  });

  describe('recordSave and recordLoad', () => {
    it('should record save samples', () => {
      analyzer.recordSave({ slot: 1, durationMs: 10, stateSize: 5000 });
      analyzer.recordSave({ slot: 2, durationMs: 15, stateSize: 6000 });

      const report = analyzer.generateReport();

      expect(report.saveLoad.saveSamples.length).toBe(2);
      expect(report.saveLoad.averageSaveMs).toBeCloseTo(12.5, 1);
      expect(report.saveLoad.maxSaveMs).toBe(15);
    });

    it('should record load samples', () => {
      analyzer.recordLoad({ slot: 1, durationMs: 8, stateSize: 5000 });
      analyzer.recordLoad({ slot: 2, durationMs: 12, stateSize: 6000 });

      const report = analyzer.generateReport();

      expect(report.saveLoad.loadSamples.length).toBe(2);
      expect(report.saveLoad.averageLoadMs).toBeCloseTo(10, 1);
      expect(report.saveLoad.maxLoadMs).toBe(12);
    });
  });

  describe('generateReport', () => {
    it('should generate valid report when all thresholds pass', () => {
      analyzer.recordContentLoad(500);
      analyzer.recordInitialStateSetup(100);
      analyzer.recordTransition({
        fromNodeId: 'START',
        toNodeId: 'NODE_1',
        durationMs: 10,
        effectCount: 1,
      });
      analyzer.recordSave({ slot: 1, durationMs: 50, stateSize: 1000 });
      analyzer.recordLoad({ slot: 1, durationMs: 30, stateSize: 1000 });

      const report = analyzer.generateReport();

      expect(report.valid).toBe(true);
      expect(report.loadTime.passesThreshold).toBe(true);
      expect(report.transitions.passesThreshold).toBe(true);
      expect(report.saveLoad.passesThreshold).toBe(true);
      expect(report.summary.errors.length).toBe(0);
    });

    it('should fail when load time exceeds threshold', () => {
      analyzer.recordContentLoad(2500);
      analyzer.recordInitialStateSetup(1000); // Total: 3500ms > 3000ms

      const report = analyzer.generateReport();

      expect(report.valid).toBe(false);
      expect(report.loadTime.passesThreshold).toBe(false);
      expect(report.summary.errors.some(e => e.includes('Load time'))).toBe(true);
    });

    it('should fail when transition time exceeds threshold', () => {
      analyzer.recordTransition({
        fromNodeId: 'START',
        toNodeId: 'NODE_1',
        durationMs: 150, // > 100ms threshold
        effectCount: 10,
      });

      const report = analyzer.generateReport();

      expect(report.valid).toBe(false);
      expect(report.transitions.passesThreshold).toBe(false);
      expect(report.summary.errors.some(e => e.includes('transition time'))).toBe(true);
    });

    it('should fail when save time exceeds threshold', () => {
      analyzer.recordSave({ slot: 1, durationMs: 600, stateSize: 100000 }); // > 500ms

      const report = analyzer.generateReport();

      expect(report.valid).toBe(false);
      expect(report.saveLoad.passesThreshold).toBe(false);
      expect(report.summary.errors.some(e => e.includes('save time'))).toBe(true);
    });

    it('should warn when not enough samples collected', () => {
      analyzer.recordTransition({
        fromNodeId: 'START',
        toNodeId: 'NODE_1',
        durationMs: 5,
        effectCount: 1,
      });

      const report = analyzer.generateReport();

      expect(report.summary.warnings.some(w => w.includes('transition samples'))).toBe(true);
      expect(report.summary.warnings.some(w => w.includes('save samples'))).toBe(true);
    });

    it('should calculate P95 correctly', () => {
      // Add 20 samples with increasing durations
      for (let i = 1; i <= 20; i++) {
        analyzer.recordTransition({
          fromNodeId: `NODE_${i - 1}`,
          toNodeId: `NODE_${i}`,
          durationMs: i,
          effectCount: 0,
        });
      }

      const report = analyzer.generateReport();

      // P95 of 1-20 should be around 19
      expect(report.transitions.p95Ms).toBeGreaterThanOrEqual(19);
    });
  });

  describe('reset', () => {
    it('should clear all collected metrics', () => {
      analyzer.recordContentLoad(500);
      analyzer.recordTransition({
        fromNodeId: 'START',
        toNodeId: 'NODE_1',
        durationMs: 10,
        effectCount: 1,
      });
      analyzer.recordSave({ slot: 1, durationMs: 50, stateSize: 1000 });

      analyzer.reset();
      const report = analyzer.generateReport();

      expect(report.loadTime.contentLoadMs).toBe(0);
      expect(report.transitions.samples.length).toBe(0);
      expect(report.saveLoad.saveSamples.length).toBe(0);
    });
  });
});

// =============================================================================
// Tests: Static Analysis
// =============================================================================

describe('analyzeContentComplexity', () => {
  it('should analyze minimal manifest', () => {
    const manifest = createMinimalManifest();
    const analysis = analyzeContentComplexity(manifest);

    expect(analysis.nodeCount).toBe(3);
    expect(analysis.totalChoices).toBe(2);
    expect(analysis.totalEffects).toBe(2); // 1 setFlag + 1 modifyStat
    expect(analysis.warnings.length).toBe(0);
  });

  it('should analyze complex manifest', () => {
    const manifest = createComplexManifest();
    const analysis = analyzeContentComplexity(manifest);

    expect(analysis.nodeCount).toBe(51);
    expect(analysis.totalChoices).toBeGreaterThan(50);
    expect(analysis.averageChoicesPerNode).toBeGreaterThan(1);
    expect(analysis.largestNode.choiceCount).toBeGreaterThan(0);
  });

  it('should calculate estimated state size', () => {
    const manifest = createMinimalManifest();
    const analysis = analyzeContentComplexity(manifest);

    expect(analysis.estimatedStateSize).toBeGreaterThan(1000);
  });

  it('should warn about high effect counts', () => {
    const manifest = createMinimalManifest();
    // Add a choice with many effects
    manifest.nodes[0]!.choices[0]!.effects = Array(15).fill(0).map((_, i) => ({
      type: 'setFlag' as const,
      flag: `FLAG_${i}`,
    }));

    const analysis = analyzeContentComplexity(manifest);

    expect(analysis.maxEffectsOnChoice).toBe(15);
    expect(analysis.warnings.some(w => w.includes('effects'))).toBe(true);
  });
});

// =============================================================================
// Tests: Measurement Utilities
// =============================================================================

describe('measureSync', () => {
  it('should measure synchronous function execution time', () => {
    const { result, durationMs } = measureSync(() => {
      // Simple computation
      let sum = 0;
      for (let i = 0; i < 1000; i++) {
        sum += i;
      }
      return sum;
    });

    expect(result).toBe(499500);
    expect(durationMs).toBeGreaterThanOrEqual(0);
    expect(typeof durationMs).toBe('number');
  });
});

describe('measureAsync', () => {
  it('should measure async function execution time', async () => {
    const { result, durationMs } = await measureAsync(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return 'done';
    });

    expect(result).toBe('done');
    expect(durationMs).toBeGreaterThanOrEqual(9); // Allow some timing variance
  });
});

// =============================================================================
// Tests: Report Formatting
// =============================================================================

describe('formatReport', () => {
  it('should format passing report correctly', () => {
    const report: PerformanceReport = {
      valid: true,
      timestamp: Date.now(),
      loadTime: {
        contentLoadMs: 500,
        initialStateSetupMs: 100,
        totalLoadMs: 600,
        passesThreshold: true,
        threshold: 3000,
      },
      transitions: {
        samples: [],
        averageMs: 10,
        maxMs: 50,
        minMs: 5,
        p95Ms: 45,
        passesThreshold: true,
        threshold: 100,
      },
      saveLoad: {
        saveSamples: [],
        loadSamples: [],
        averageSaveMs: 20,
        averageLoadMs: 15,
        maxSaveMs: 30,
        maxLoadMs: 25,
        passesThreshold: true,
        saveThreshold: 500,
        loadThreshold: 500,
      },
      memory: {
        baselineHeapMB: null,
        finalHeapMB: null,
        peakHeapMB: null,
        growthMB: null,
        transitionCount: 0,
        growthPerTransition: null,
        passesThreshold: true,
        available: false,
      },
      summary: {
        totalChecks: 4,
        passedChecks: 4,
        failedChecks: 0,
        warnings: [],
        errors: [],
      },
    };

    const formatted = formatReport(report);

    expect(formatted).toContain('PASS');
    expect(formatted).toContain('Performance Analysis Report');
    expect(formatted).toContain('LOAD TIME');
    expect(formatted).toContain('SCENE TRANSITIONS');
    expect(formatted).toContain('SAVE/LOAD');
    expect(formatted).toContain('4/4 checks passed');
  });

  it('should format failing report with errors', () => {
    const report: PerformanceReport = {
      valid: false,
      timestamp: Date.now(),
      loadTime: {
        contentLoadMs: 4000,
        initialStateSetupMs: 100,
        totalLoadMs: 4100,
        passesThreshold: false,
        threshold: 3000,
      },
      transitions: {
        samples: [],
        averageMs: 10,
        maxMs: 50,
        minMs: 5,
        p95Ms: 45,
        passesThreshold: true,
        threshold: 100,
      },
      saveLoad: {
        saveSamples: [],
        loadSamples: [],
        averageSaveMs: 20,
        averageLoadMs: 15,
        maxSaveMs: 30,
        maxLoadMs: 25,
        passesThreshold: true,
        saveThreshold: 500,
        loadThreshold: 500,
      },
      memory: {
        baselineHeapMB: null,
        finalHeapMB: null,
        peakHeapMB: null,
        growthMB: null,
        transitionCount: 0,
        growthPerTransition: null,
        passesThreshold: true,
        available: false,
      },
      summary: {
        totalChecks: 4,
        passedChecks: 3,
        failedChecks: 1,
        warnings: [],
        errors: ['Load time 4100ms exceeds threshold of 3000ms'],
      },
    };

    const formatted = formatReport(report);

    expect(formatted).toContain('FAIL');
    expect(formatted).toContain('ERRORS');
    expect(formatted).toContain('Load time 4100ms');
    expect(formatted).toContain('3/4 checks passed');
  });
});

describe('formatStaticAnalysis', () => {
  it('should format static analysis output', () => {
    const manifest = createMinimalManifest();
    const analysis = analyzeContentComplexity(manifest);
    const formatted = formatStaticAnalysis(analysis);

    expect(formatted).toContain('Content Complexity Analysis');
    expect(formatted).toContain('Total nodes: 3');
    expect(formatted).toContain('Total choices: 2');
  });
});

// =============================================================================
// Tests: Thresholds
// =============================================================================

describe('PERFORMANCE_THRESHOLDS', () => {
  it('should have correct GDD M5.5 threshold values', () => {
    expect(PERFORMANCE_THRESHOLDS.LOAD_TIME_MS).toBe(3000);
    expect(PERFORMANCE_THRESHOLDS.TRANSITION_TIME_MS).toBe(100);
    expect(PERFORMANCE_THRESHOLDS.SAVE_TIME_MS).toBe(500);
    expect(PERFORMANCE_THRESHOLDS.LOAD_TIME_SAVE_MS).toBe(500);
  });
});
