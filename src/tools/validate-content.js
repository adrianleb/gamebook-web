#!/usr/bin/env node
/**
 * Content Validation Script
 *
 * Validates game content JSON against ENGINE.md schema and rules.
 * Catches errors at build time to prevent runtime issues.
 *
 * Exit codes: 0 = pass, 1 = error (blocking), 2 = warning
 *
 * Usage:
 *   node validate-content.js [--force] [--warn-only] [content-file]
 *
 * Options:
 *   --force      Continue build even on errors (escape hatch)
 *   --warn-only  Report issues as warnings instead of errors
 *
 * Validation Rules (from ENGINE.md):
 *   1. DUPLICATE_NODE_ID   - Node ID uniqueness
 *   2. INVALID_TARGET      - Choice targets exist
 *   3. INVALID_ITEM_REF    - Item references in conditions/effects are valid
 *   4. POTENTIAL_DEAD_END  - Nodes with no choices that aren't endings
 *   5. ORPHAN_NODE         - Nodes unreachable from start
 *   6. INESCAPABLE_CYCLE   - Cycles with no exit path
 *   7. UNREACHABLE_ENDING  - Ending nodes not reachable from start
 *   8. INVALID_START_NODE  - Initial state references non-existent node
 *
 * @author agent-f (QA Lead)
 */

import fs from 'fs';
import path from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
const forceMode = args.includes('--force');
const warnOnly = args.includes('--warn-only');
const contentFile = args.find(arg => !arg.startsWith('--')) || 'src/content/content.json';

// Validation result tracking
const results = {
  errors: [],
  warnings: []
};

/**
 * @typedef {Object} ValidationError
 * @property {string} code - Error code from ENGINE.md
 * @property {string} message - Human-readable error message
 * @property {string} [nodeId] - Related node ID
 * @property {string} [choiceId] - Related choice ID
 * @property {string} [itemId] - Related item ID
 */

/**
 * Log an error
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {Object} [context] - Additional context
 */
function error(code, message, context = {}) {
  const err = { code, message, ...context };
  results.errors.push(err);
  console.error(`[ERROR] ${code}: ${message}`);
}

/**
 * Log a warning
 * @param {string} code - Warning code
 * @param {string} message - Warning message
 * @param {Object} [context] - Additional context
 */
function warn(code, message, context = {}) {
  const warning = { code, message, ...context };
  results.warnings.push(warning);
  console.warn(`[WARN] ${code}: ${message}`);
}

/**
 * Log info
 * @param {string} message - Info message
 */
function info(message) {
  console.log(`[INFO] ${message}`);
}

/**
 * Load and parse content JSON
 * @param {string} filePath - Path to content file
 * @returns {Object|null} Parsed content or null on error
 */
function loadContent(filePath) {
  const fullPath = path.join(process.cwd(), filePath);

  if (!fs.existsSync(fullPath)) {
    error('FILE_NOT_FOUND', `Content file not found: ${filePath}`);
    return null;
  }

  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    error('PARSE_ERROR', `Failed to parse content file: ${e.message}`);
    return null;
  }
}

/**
 * Validate basic schema structure
 * @param {Object} manifest - Content manifest
 * @returns {boolean} True if structure is valid
 */
function validateSchema(manifest) {
  let valid = true;

  if (!manifest.schemaVersion) {
    error('MISSING_SCHEMA_VERSION', 'Content manifest missing schemaVersion');
    valid = false;
  }

  if (!Array.isArray(manifest.nodes)) {
    error('MISSING_NODES', 'Content manifest missing nodes array');
    valid = false;
  }

  if (!Array.isArray(manifest.items)) {
    error('MISSING_ITEMS', 'Content manifest missing items array');
    valid = false;
  }

  if (!manifest.initialState) {
    error('MISSING_INITIAL_STATE', 'Content manifest missing initialState');
    valid = false;
  }

  return valid;
}

/**
 * Rule 1: Validate node ID uniqueness
 * @param {Array} nodes - Array of node objects
 * @returns {Set<string>} Set of valid node IDs
 */
function validateNodeIdUniqueness(nodes) {
  const seenIds = new Set();
  const validIds = new Set();

  for (const node of nodes) {
    if (!node.id) {
      error('MISSING_NODE_ID', 'Node missing required id field', { nodeId: '(unknown)' });
      continue;
    }

    if (seenIds.has(node.id)) {
      error('DUPLICATE_NODE_ID', `Duplicate node ID: ${node.id}`, { nodeId: node.id });
    } else {
      seenIds.add(node.id);
      validIds.add(node.id);
    }
  }

  return validIds;
}

/**
 * Rule 2: Validate choice targets exist
 * @param {Array} nodes - Array of node objects
 * @param {Set<string>} nodeIds - Set of valid node IDs
 */
function validateChoiceTargets(nodes, nodeIds) {
  for (const node of nodes) {
    if (!Array.isArray(node.choices)) continue;

    for (const choice of node.choices) {
      if (!choice.targetId) {
        error('MISSING_TARGET', `Choice "${choice.id}" missing targetId`, {
          nodeId: node.id,
          choiceId: choice.id
        });
        continue;
      }

      if (!nodeIds.has(choice.targetId)) {
        error('INVALID_TARGET', `Choice "${choice.id}" targets non-existent node "${choice.targetId}"`, {
          nodeId: node.id,
          choiceId: choice.id
        });
      }
    }
  }
}

/**
 * Rule 3: Validate item references in conditions and effects
 * @param {Array} nodes - Array of node objects
 * @param {Set<string>} itemIds - Set of valid item IDs
 */
function validateItemReferences(nodes, itemIds) {
  for (const node of nodes) {
    // Check onEnter effects
    if (Array.isArray(node.onEnter)) {
      validateEffectItemRefs(node.onEnter, itemIds, node.id, null);
    }

    if (!Array.isArray(node.choices)) continue;

    for (const choice of node.choices) {
      // Check choice conditions
      if (Array.isArray(choice.conditions)) {
        validateConditionItemRefs(choice.conditions, itemIds, node.id, choice.id);
      }

      // Check choice effects
      if (Array.isArray(choice.effects)) {
        validateEffectItemRefs(choice.effects, itemIds, node.id, choice.id);
      }
    }
  }
}

/**
 * Recursively validate item references in conditions
 * @param {Array} conditions - Array of condition objects
 * @param {Set<string>} itemIds - Set of valid item IDs
 * @param {string} nodeId - Parent node ID
 * @param {string|null} choiceId - Parent choice ID
 */
function validateConditionItemRefs(conditions, itemIds, nodeId, choiceId) {
  for (const condition of conditions) {
    if (condition.type === 'item') {
      if (!itemIds.has(condition.itemId)) {
        error('INVALID_ITEM_REF', `Condition references non-existent item "${condition.itemId}"`, {
          nodeId,
          choiceId,
          itemId: condition.itemId
        });
      }
    } else if (condition.type === 'not' && condition.condition) {
      validateConditionItemRefs([condition.condition], itemIds, nodeId, choiceId);
    } else if ((condition.type === 'and' || condition.type === 'or') && Array.isArray(condition.conditions)) {
      validateConditionItemRefs(condition.conditions, itemIds, nodeId, choiceId);
    }
  }
}

/**
 * Validate item references in effects
 * @param {Array} effects - Array of effect objects
 * @param {Set<string>} itemIds - Set of valid item IDs
 * @param {string} nodeId - Parent node ID
 * @param {string|null} choiceId - Parent choice ID
 */
function validateEffectItemRefs(effects, itemIds, nodeId, choiceId) {
  for (const effect of effects) {
    if (effect.type === 'addItem' || effect.type === 'removeItem') {
      if (!itemIds.has(effect.itemId)) {
        error('INVALID_ITEM_REF', `Effect references non-existent item "${effect.itemId}"`, {
          nodeId,
          choiceId,
          itemId: effect.itemId
        });
      }
    }
  }
}

/**
 * Rule 4: Detect potential dead-ends
 * @param {Array} nodes - Array of node objects
 */
function validateDeadEnds(nodes) {
  for (const node of nodes) {
    const hasChoices = Array.isArray(node.choices) && node.choices.length > 0;
    const isEnding = Array.isArray(node.tags) && node.tags.includes('ending');

    if (!hasChoices && !isEnding) {
      warn('POTENTIAL_DEAD_END', `Node "${node.id}" has no choices and is not tagged as ending`, {
        nodeId: node.id
      });
    }
  }
}

/**
 * Rule 5: Find reachable nodes from start
 * @param {Array} nodes - Array of node objects
 * @param {string} startId - Starting node ID
 * @returns {Set<string>} Set of reachable node IDs
 */
function findReachableNodes(nodes, startId) {
  const reachable = new Set();
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const queue = [startId];

  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (reachable.has(nodeId)) continue;
    reachable.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node || !Array.isArray(node.choices)) continue;

    for (const choice of node.choices) {
      if (choice.targetId && !reachable.has(choice.targetId)) {
        queue.push(choice.targetId);
      }
    }
  }

  return reachable;
}

/**
 * Detect orphan nodes (unreachable from start)
 * @param {Array} nodes - Array of node objects
 * @param {Set<string>} reachable - Set of reachable node IDs
 */
function validateOrphanNodes(nodes, reachable) {
  for (const node of nodes) {
    if (!reachable.has(node.id)) {
      warn('ORPHAN_NODE', `Node "${node.id}" is not reachable from start`, {
        nodeId: node.id
      });
    }
  }
}

/**
 * Rule 6: Find cycles using Tarjan's algorithm for strongly connected components
 * @param {Array} nodes - Array of node objects
 * @returns {Array<Array<string>>} Array of cycle node ID arrays
 */
function findStronglyConnectedComponents(nodes) {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const index = new Map();
  const lowlink = new Map();
  const onStack = new Set();
  const stack = [];
  const sccs = [];
  let currentIndex = 0;

  function strongConnect(nodeId) {
    index.set(nodeId, currentIndex);
    lowlink.set(nodeId, currentIndex);
    currentIndex++;
    stack.push(nodeId);
    onStack.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (node && Array.isArray(node.choices)) {
      for (const choice of node.choices) {
        const targetId = choice.targetId;
        if (!targetId) continue;

        if (!index.has(targetId)) {
          strongConnect(targetId);
          lowlink.set(nodeId, Math.min(lowlink.get(nodeId), lowlink.get(targetId)));
        } else if (onStack.has(targetId)) {
          lowlink.set(nodeId, Math.min(lowlink.get(nodeId), index.get(targetId)));
        }
      }
    }

    if (lowlink.get(nodeId) === index.get(nodeId)) {
      const scc = [];
      let w;
      do {
        w = stack.pop();
        onStack.delete(w);
        scc.push(w);
      } while (w !== nodeId);

      // Only consider SCCs with more than one node (actual cycles)
      if (scc.length > 1) {
        sccs.push(scc);
      }
    }
  }

  for (const node of nodes) {
    if (!index.has(node.id)) {
      strongConnect(node.id);
    }
  }

  return sccs;
}

/**
 * Check if a cycle has an exit path
 * @param {Array<string>} cycle - Array of node IDs in the cycle
 * @param {Array} nodes - All nodes
 * @returns {boolean} True if cycle has an exit
 */
function cycleHasExit(cycle, nodes) {
  const cycleSet = new Set(cycle);
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  for (const nodeId of cycle) {
    const node = nodeMap.get(nodeId);
    if (!node || !Array.isArray(node.choices)) continue;

    for (const choice of node.choices) {
      if (choice.targetId && !cycleSet.has(choice.targetId)) {
        return true; // Found an exit from the cycle
      }
    }
  }

  return false;
}

/**
 * Validate cycles have exits
 * @param {Array} nodes - Array of node objects
 */
function validateCycles(nodes) {
  const cycles = findStronglyConnectedComponents(nodes);

  for (const cycle of cycles) {
    if (!cycleHasExit(cycle, nodes)) {
      error('INESCAPABLE_CYCLE', `Cycle detected with no exit: ${cycle.join(' -> ')}`, {
        nodeId: cycle[0]
      });
    }
  }
}

/**
 * Rule 7: Validate ending reachability
 * @param {Array} nodes - Array of node objects
 * @param {Set<string>} reachable - Set of reachable node IDs
 */
function validateEndingReachability(nodes, reachable) {
  const endings = nodes.filter(n => Array.isArray(n.tags) && n.tags.includes('ending'));

  if (endings.length === 0) {
    warn('NO_ENDINGS', 'No nodes tagged as endings found');
    return;
  }

  for (const ending of endings) {
    if (!reachable.has(ending.id)) {
      error('UNREACHABLE_ENDING', `Ending "${ending.id}" is not reachable from start`, {
        nodeId: ending.id
      });
    }
  }
}

/**
 * Rule 8: Validate initial state
 * @param {Object} initialState - Initial state object
 * @param {Set<string>} nodeIds - Set of valid node IDs
 */
function validateInitialState(initialState, nodeIds) {
  if (!initialState.currentNodeId) {
    error('MISSING_START_NODE', 'Initial state missing currentNodeId');
    return;
  }

  if (!nodeIds.has(initialState.currentNodeId)) {
    error('INVALID_START_NODE', `Initial node "${initialState.currentNodeId}" does not exist`);
  }
}

/**
 * Main validation function
 */
function main() {
  console.log('');
  console.log('========================================');
  console.log('  Content Validation (ENGINE.md Rules)');
  console.log('========================================');
  console.log('');

  if (forceMode) {
    console.log('[MODE] Force mode enabled - errors will not block build');
  }
  if (warnOnly) {
    console.log('[MODE] Warn-only mode - all issues reported as warnings');
  }
  console.log(`[FILE] ${contentFile}`);
  console.log('');

  // Load content
  const manifest = loadContent(contentFile);
  if (!manifest) {
    printSummary();
    process.exit(1);
  }

  // Validate basic schema
  if (!validateSchema(manifest)) {
    printSummary();
    process.exit(1);
  }

  // Build lookup sets
  const nodeIds = validateNodeIdUniqueness(manifest.nodes);
  const itemIds = new Set(manifest.items.map(i => i.id));

  info(`Found ${nodeIds.size} nodes, ${itemIds.size} items`);
  info('');

  // Run validation rules
  info('Checking choice targets...');
  validateChoiceTargets(manifest.nodes, nodeIds);

  info('Checking item references...');
  validateItemReferences(manifest.nodes, itemIds);

  info('Checking for dead-ends...');
  validateDeadEnds(manifest.nodes);

  info('Checking reachability...');
  const reachable = findReachableNodes(manifest.nodes, manifest.initialState.currentNodeId);
  validateOrphanNodes(manifest.nodes, reachable);

  info('Checking for inescapable cycles...');
  validateCycles(manifest.nodes);

  info('Checking ending reachability...');
  validateEndingReachability(manifest.nodes, reachable);

  info('Checking initial state...');
  validateInitialState(manifest.initialState, nodeIds);

  // Summary
  printSummary();

  // Determine exit code
  if (results.errors.length > 0) {
    if (forceMode) {
      console.log('[RESULT] Errors found but --force enabled. Continuing.');
      process.exit(0);
    } else if (warnOnly) {
      console.log('[RESULT] Errors treated as warnings. Continuing.');
      process.exit(2);
    } else {
      console.log('[RESULT] Validation FAILED. Use --force to override.');
      process.exit(1);
    }
  } else if (results.warnings.length > 0) {
    console.log('[RESULT] Validation passed with warnings.');
    process.exit(2);
  } else {
    console.log('[RESULT] Validation PASSED.');
    process.exit(0);
  }
}

/**
 * Print validation summary
 */
function printSummary() {
  console.log('');
  console.log('========================================');
  console.log('  Validation Summary');
  console.log('========================================');
  console.log(`  Errors:   ${results.errors.length}`);
  console.log(`  Warnings: ${results.warnings.length}`);
  console.log('========================================');
  console.log('');

  if (results.errors.length > 0) {
    console.log('Errors by type:');
    const errorCounts = {};
    for (const err of results.errors) {
      errorCounts[err.code] = (errorCounts[err.code] || 0) + 1;
    }
    for (const [code, count] of Object.entries(errorCounts)) {
      console.log(`  ${code}: ${count}`);
    }
    console.log('');
  }

  if (results.warnings.length > 0) {
    console.log('Warnings by type:');
    const warnCounts = {};
    for (const warning of results.warnings) {
      warnCounts[warning.code] = (warnCounts[warning.code] || 0) + 1;
    }
    for (const [code, count] of Object.entries(warnCounts)) {
      console.log(`  ${code}: ${count}`);
    }
    console.log('');
  }
}

main();
