#!/usr/bin/env npx ts-node
/**
 * CLI runner for Performance Analyzer.
 *
 * Performs static analysis on content to estimate performance characteristics
 * and simulates transitions to measure timing.
 *
 * Usage:
 *   npm run analyze:performance
 *   npx ts-node src/tools/analyze-performance.ts
 *
 * @module tools/analyze-performance
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ContentManifest, GameState, Effect } from '../engine/types';
import {
  PerformanceAnalyzer,
  analyzeContentComplexity,
  formatReport,
  formatStaticAnalysis,
  measureSync,
  PERFORMANCE_THRESHOLDS,
} from './performance-analyzer';
import { applyEffects, type EffectContext } from '../engine/effects';
import { evaluateConditions, getAvailableChoices } from '../engine/conditions';

// =============================================================================
// Content Loading
// =============================================================================

interface ActContent {
  schemaVersion: string;
  nodes: ContentManifest['nodes'];
  items?: ContentManifest['items'];
  initialState?: ContentManifest['initialState'];
}

function loadContent(): ContentManifest {
  const contentDir = path.join(process.cwd(), 'src', 'content');

  // Load all three act files
  const actFiles = ['act1-sample.json', 'act2-sample.json', 'act3-sample.json'];
  const allNodes: ContentManifest['nodes'] = [];
  const allItems: ContentManifest['items'] = [];
  let initialState: ContentManifest['initialState'] | null = null;
  let schemaVersion = '1.0.0';

  for (const actFile of actFiles) {
    const actPath = path.join(contentDir, actFile);
    if (!fs.existsSync(actPath)) {
      console.error(`Content file not found: ${actPath}`);
      process.exit(1);
    }

    const content = fs.readFileSync(actPath, 'utf-8');
    const act = JSON.parse(content) as ActContent;

    schemaVersion = act.schemaVersion || schemaVersion;
    allNodes.push(...act.nodes);

    if (act.items) {
      allItems.push(...act.items);
    }

    // Use initialState from act1 (first file)
    if (!initialState && act.initialState) {
      initialState = act.initialState;
    }
  }

  // If no initialState found, create a default one
  if (!initialState) {
    const startNode = allNodes.find(n => n.id === 'ACT1_START') ?? allNodes[0];
    initialState = {
      currentNodeId: startNode?.id ?? 'ACT1_START',
      flags: {},
      stats: { health: 100 },
      inventory: [],
      factions: { A: 50, B: 50, C: 50 },
    };
  }

  return {
    version: '1.0.0',
    schemaVersion,
    nodes: allNodes,
    items: allItems,
    initialState,
  };
}

// =============================================================================
// Simulation
// =============================================================================

interface SimulationConfig {
  transitionCount: number;
  saveLoadCycles: number;
}

function createInitialState(manifest: ContentManifest): GameState {
  const { initialState } = manifest;
  return {
    currentNodeId: initialState.currentNodeId,
    previousNodeId: null,
    flags: { ...initialState.flags },
    stats: { ...initialState.stats },
    inventory: initialState.inventory.map(e => ({ ...e })),
    factions: { ...initialState.factions },
    visitedNodes: [initialState.currentNodeId],
    choicesMade: [],
    isTransitioning: false,
    pendingEffects: [],
  };
}

function simulateTransitions(
  manifest: ContentManifest,
  analyzer: PerformanceAnalyzer,
  config: SimulationConfig
): void {
  const nodeMap = new Map(manifest.nodes.map(n => [n.id, n]));
  const itemMap = new Map(manifest.items.map(i => [i.id, i]));

  const effectContext: EffectContext = {
    getItem: (id) => itemMap.get(id),
    emitEvent: () => {},
  };

  let state = createInitialState(manifest);
  let transitionsCompleted = 0;

  // Simulate random walk through the game
  while (transitionsCompleted < config.transitionCount) {
    const currentNode = nodeMap.get(state.currentNodeId);
    if (!currentNode) break;

    // Get available choices
    const availableChoiceIds = getAvailableChoices(currentNode.choices, state);
    if (availableChoiceIds.length === 0) {
      // Dead end - restart from beginning
      state = createInitialState(manifest);
      continue;
    }

    // Pick a random available choice
    const randomIndex = Math.floor(Math.random() * availableChoiceIds.length);
    const choiceId = availableChoiceIds[randomIndex];
    const choice = currentNode.choices.find(c => c.id === choiceId);

    if (!choice) break;

    // Measure the transition
    const { durationMs } = measureSync(() => {
      let newState = { ...state, isTransitioning: true };

      // Apply choice effects
      if (choice.effects && choice.effects.length > 0) {
        newState = applyEffects(newState, choice.effects, effectContext);
      }

      // Get target node and apply onEnter effects
      const targetNode = nodeMap.get(choice.targetId);
      if (targetNode?.onEnter && targetNode.onEnter.length > 0) {
        newState = applyEffects(newState, targetNode.onEnter, effectContext);
      }

      // Update state
      newState = {
        ...newState,
        previousNodeId: state.currentNodeId,
        currentNodeId: choice.targetId,
        visitedNodes: [...state.visitedNodes, choice.targetId],
        choicesMade: [
          ...state.choicesMade,
          {
            nodeId: state.currentNodeId,
            choiceId,
            timestamp: Date.now(),
          },
        ],
        isTransitioning: false,
      };

      state = newState;
    });

    analyzer.recordTransition({
      fromNodeId: currentNode.id,
      toNodeId: choice.targetId,
      durationMs,
      effectCount: (choice.effects?.length ?? 0) + (nodeMap.get(choice.targetId)?.onEnter?.length ?? 0),
    });

    transitionsCompleted++;

    // Check for ending (no choices)
    const targetNode = nodeMap.get(choice.targetId);
    if (!targetNode || targetNode.choices.length === 0) {
      // Restart from beginning
      state = createInitialState(manifest);
    }
  }
}

function simulateSaveLoad(
  manifest: ContentManifest,
  analyzer: PerformanceAnalyzer,
  config: SimulationConfig
): void {
  const nodeMap = new Map(manifest.nodes.map(n => [n.id, n]));

  // Create a state with significant history for realistic save size
  let state = createInitialState(manifest);

  // Add some history to make state realistic
  for (let i = 0; i < 50 && state.visitedNodes.length < 100; i++) {
    const node = nodeMap.get(state.currentNodeId);
    if (!node || node.choices.length === 0) break;

    const availableIds = getAvailableChoices(node.choices, state);
    if (availableIds.length === 0) break;

    const choiceId = availableIds[0];
    const choice = node.choices.find(c => c.id === choiceId);
    if (!choice) break;

    state = {
      ...state,
      currentNodeId: choice.targetId,
      visitedNodes: [...state.visitedNodes, choice.targetId],
      choicesMade: [
        ...state.choicesMade,
        { nodeId: state.currentNodeId, choiceId, timestamp: Date.now() },
      ],
    };
  }

  // Simulate save/load cycles
  for (let cycle = 0; cycle < config.saveLoadCycles; cycle++) {
    for (let slot = 0; slot < 4; slot++) {
      // Measure save
      const { durationMs: saveDuration } = measureSync(() => {
        // Simulate serialization (what SaveManager does)
        const serialized = {
          currentNodeId: state.currentNodeId,
          previousNodeId: state.previousNodeId,
          flags: { ...state.flags },
          stats: { ...state.stats },
          inventory: state.inventory.map(e => ({ ...e })),
          factions: { ...state.factions },
          visitedNodes: [...state.visitedNodes],
          choicesMade: state.choicesMade.map(c => ({ ...c })),
        };
        const json = JSON.stringify(serialized);
        // Simulate checksum calculation (djb2 hash)
        let hash = 5381;
        for (let i = 0; i < json.length; i++) {
          hash = ((hash << 5) + hash) ^ json.charCodeAt(i);
        }
        // Simulate storage write
        const saveFile = {
          version: '1.0.0',
          timestamp: Date.now(),
          state: serialized,
          checksum: (hash >>> 0).toString(16),
        };
        return JSON.stringify(saveFile);
      });

      const stateSize = JSON.stringify(state).length;
      analyzer.recordSave({ slot, durationMs: saveDuration, stateSize });

      // Measure load
      const { durationMs: loadDuration } = measureSync(() => {
        // Simulate parsing (what SaveManager does)
        const serialized = {
          currentNodeId: state.currentNodeId,
          previousNodeId: state.previousNodeId,
          flags: { ...state.flags },
          stats: { ...state.stats },
          inventory: state.inventory.map(e => ({ ...e })),
          factions: { ...state.factions },
          visitedNodes: [...state.visitedNodes],
          choicesMade: state.choicesMade.map(c => ({ ...c })),
        };
        const json = JSON.stringify(serialized);
        // Simulate checksum verification
        let hash = 5381;
        for (let i = 0; i < json.length; i++) {
          hash = ((hash << 5) + hash) ^ json.charCodeAt(i);
        }
        // Simulate deserialization
        const loaded = JSON.parse(json);
        return {
          ...loaded,
          isTransitioning: false,
          pendingEffects: [],
        };
      });

      analyzer.recordLoad({ slot, durationMs: loadDuration, stateSize });
    }
  }
}

// =============================================================================
// Main
// =============================================================================

function main(): void {
  console.log('Performance Analyzer');
  console.log('====================\n');

  // Load content
  console.log('Loading content...');
  const { result: manifest, durationMs: contentLoadMs } = measureSync(() => loadContent());
  console.log(`Loaded ${manifest.nodes.length} nodes in ${contentLoadMs.toFixed(1)}ms\n`);

  // Static analysis
  console.log('Running static analysis...');
  const staticAnalysis = analyzeContentComplexity(manifest);
  console.log(formatStaticAnalysis(staticAnalysis));
  console.log('');

  // Initialize analyzer
  const analyzer = new PerformanceAnalyzer();
  analyzer.recordContentLoad(contentLoadMs);

  // Record initial state setup
  const { durationMs: stateSetupMs } = measureSync(() => createInitialState(manifest));
  analyzer.recordInitialStateSetup(stateSetupMs);

  // Record baseline (memory not available in Node.js CLI)
  analyzer.recordBaseline();

  // Run simulations
  const config: SimulationConfig = {
    transitionCount: 200, // Simulate 200 transitions
    saveLoadCycles: 5,    // 5 cycles of save/load for all 4 slots
  };

  console.log(`\nSimulating ${config.transitionCount} scene transitions...`);
  simulateTransitions(manifest, analyzer, config);

  console.log(`Simulating ${config.saveLoadCycles * 4} save/load operations...`);
  simulateSaveLoad(manifest, analyzer, config);

  // Generate report
  console.log('\n');
  const report = analyzer.generateReport();
  console.log(formatReport(report));

  // Exit with error code if failed
  if (!report.valid) {
    process.exit(1);
  }
}

main();
