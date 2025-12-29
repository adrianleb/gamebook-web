#!/usr/bin/env node
/**
 * Content Validation Script
 *
 * Validates game content JSON against ENGINE.md schema and rules.
 * Catches errors at build time to prevent runtime issues.
 *
 * Supports multi-file validation with two-pass approach:
 *   Pass 1: Index all nodes with file origin, detect duplicate IDs
 *   Pass 2: Validate cross-references against combined index
 *
 * Exit codes: 0 = pass, 1 = error (blocking), 2 = warning
 *
 * Usage:
 *   node validate-content.js [--force] [--warn-only] [content-path]
 *
 * Examples:
 *   node validate-content.js src/content              # Validate all act*.json in directory
 *   node validate-content.js src/content/act1.json   # Validate single file
 *
 * Options:
 *   --force      Continue build even on errors (escape hatch)
 *   --warn-only  Report issues as warnings instead of errors
 *
 * Validation Rules (from ENGINE.md):
 *   1. DUPLICATE_NODE_ID   - Node ID uniqueness (across all files)
 *   2. INVALID_TARGET      - Choice targets exist (cross-act references supported)
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
const contentPath = args.find(arg => !arg.startsWith('--')) || 'src/content';

// Validation result tracking
const results = {
  errors: [],
  warnings: [],
  fileStats: new Map() // Track per-file statistics
};

/**
 * @typedef {Object} ValidationError
 * @property {string} code - Error code from ENGINE.md
 * @property {string} message - Human-readable error message
 * @property {string} [file] - Source file path
 * @property {string} [nodeId] - Related node ID
 * @property {string} [choiceId] - Related choice ID
 * @property {string} [itemId] - Related item ID
 */

/**
 * @typedef {Object} NodeEntry
 * @property {string} file - Source file path (relative)
 * @property {Object} node - The node object
 */

/**
 * Log an error
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {Object} [context] - Additional context (file, nodeId, etc.)
 */
function error(code, message, context = {}) {
  const err = { code, message, ...context };
  results.errors.push(err);
  const filePrefix = context.file ? `[${context.file}] ` : '';
  console.error(`[ERROR] ${filePrefix}${code}: ${message}`);
}

/**
 * Log a warning
 * @param {string} code - Warning code
 * @param {string} message - Warning message
 * @param {Object} [context] - Additional context (file, nodeId, etc.)
 */
function warn(code, message, context = {}) {
  const warning = { code, message, ...context };
  results.warnings.push(warning);
  const filePrefix = context.file ? `[${context.file}] ` : '';
  console.warn(`[WARN] ${filePrefix}${code}: ${message}`);
}

/**
 * Log info
 * @param {string} message - Info message
 */
function info(message) {
  console.log(`[INFO] ${message}`);
}

/**
 * Discover content files from path (file or directory)
 * @param {string} contentPath - Path to file or directory
 * @returns {string[]} Array of file paths
 */
function discoverContentFiles(contentPath) {
  const fullPath = path.join(process.cwd(), contentPath);

  if (!fs.existsSync(fullPath)) {
    error('PATH_NOT_FOUND', `Content path not found: ${contentPath}`);
    return [];
  }

  const stats = fs.statSync(fullPath);

  if (stats.isFile()) {
    return [contentPath];
  }

  if (stats.isDirectory()) {
    const files = fs.readdirSync(fullPath)
      .filter(f => f.match(/^act.*\.json$/i))
      .sort()
      .map(f => path.join(contentPath, f));

    if (files.length === 0) {
      error('NO_CONTENT_FILES', `No act*.json files found in: ${contentPath}`);
    }

    return files;
  }

  error('INVALID_PATH', `Path is neither file nor directory: ${contentPath}`);
  return [];
}

/**
 * Load and parse content JSON
 * @param {string} filePath - Path to content file
 * @returns {Object|null} Parsed content or null on error
 */
function loadContent(filePath) {
  const fullPath = path.join(process.cwd(), filePath);

  if (!fs.existsSync(fullPath)) {
    error('FILE_NOT_FOUND', `Content file not found: ${filePath}`, { file: filePath });
    return null;
  }

  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    error('PARSE_ERROR', `Failed to parse content file: ${e.message}`, { file: filePath });
    return null;
  }
}

/**
 * Validate basic schema structure (per-file check)
 * @param {Object} manifest - Content manifest
 * @param {string} filePath - Source file path
 * @returns {boolean} True if structure is valid
 */
function validateSchema(manifest, filePath) {
  let valid = true;

  if (!manifest.schemaVersion) {
    error('MISSING_SCHEMA_VERSION', 'Content manifest missing schemaVersion', { file: filePath });
    valid = false;
  }

  if (!Array.isArray(manifest.nodes)) {
    error('MISSING_NODES', 'Content manifest missing nodes array', { file: filePath });
    valid = false;
  }

  // items and initialState are optional for individual act files
  // Only the first act (act1) needs these for combined validation

  return valid;
}

/**
 * PASS 1: Build node index with file origin tracking
 * Indexes all nodes from all files and detects duplicate IDs early
 * @param {Map<string, Object>} manifests - Map of filePath -> parsed manifest
 * @returns {{nodeIndex: Map<string, NodeEntry>, itemIds: Set<string>, initialState: Object|null, startFile: string|null}}
 */
function buildNodeIndex(manifests) {
  const nodeIndex = new Map(); // nodeId -> { file, node }
  const itemIds = new Set();
  let initialState = null;
  let startFile = null;

  for (const [filePath, manifest] of manifests) {
    const shortPath = path.basename(filePath);

    // Track per-file stats
    results.fileStats.set(filePath, {
      nodes: manifest.nodes?.length || 0,
      items: manifest.items?.length || 0
    });

    // Index nodes with file origin
    if (Array.isArray(manifest.nodes)) {
      for (const node of manifest.nodes) {
        if (!node.id) {
          error('MISSING_NODE_ID', 'Node missing required id field', {
            file: shortPath,
            nodeId: '(unknown)'
          });
          continue;
        }

        if (nodeIndex.has(node.id)) {
          const existing = nodeIndex.get(node.id);
          error('DUPLICATE_NODE_ID', `Duplicate node ID '${node.id}' found in ${shortPath} and ${path.basename(existing.file)}`, {
            file: shortPath,
            nodeId: node.id
          });
        } else {
          nodeIndex.set(node.id, { file: filePath, node });
        }
      }
    }

    // Collect all item IDs
    if (Array.isArray(manifest.items)) {
      for (const item of manifest.items) {
        if (item.id) {
          itemIds.add(item.id);
        }
      }
    }

    // Use initialState from first file that has one (act1)
    if (manifest.initialState && !initialState) {
      initialState = manifest.initialState;
      startFile = filePath;
    }
  }

  return { nodeIndex, itemIds, initialState, startFile };
}

/**
 * PASS 2: Validate cross-references against combined index
 * All validation functions now use nodeIndex for file origin tracking
 */

/**
 * Rule 2: Validate choice targets exist (using combined node index)
 * @param {Map<string, NodeEntry>} nodeIndex - Node index with file origins
 */
function validateChoiceTargets(nodeIndex) {
  for (const [nodeId, { file, node }] of nodeIndex) {
    if (!Array.isArray(node.choices)) continue;
    const shortPath = path.basename(file);

    for (const choice of node.choices) {
      if (!choice.targetId) {
        error('MISSING_TARGET', `Choice "${choice.id}" missing targetId`, {
          file: shortPath,
          nodeId: node.id,
          choiceId: choice.id
        });
        continue;
      }

      if (!nodeIndex.has(choice.targetId)) {
        error('INVALID_TARGET', `Choice "${choice.id}" targets non-existent node "${choice.targetId}"`, {
          file: shortPath,
          nodeId: node.id,
          choiceId: choice.id
        });
      }
    }
  }
}

/**
 * Rule 3: Validate item references in conditions and effects
 * @param {Map<string, NodeEntry>} nodeIndex - Node index with file origins
 * @param {Set<string>} itemIds - Set of valid item IDs
 */
function validateItemReferences(nodeIndex, itemIds) {
  for (const [nodeId, { file, node }] of nodeIndex) {
    const shortPath = path.basename(file);

    // Check onEnter effects
    if (Array.isArray(node.onEnter)) {
      validateEffectItemRefs(node.onEnter, itemIds, node.id, null, shortPath);
    }

    if (!Array.isArray(node.choices)) continue;

    for (const choice of node.choices) {
      // Check choice conditions
      if (Array.isArray(choice.conditions)) {
        validateConditionItemRefs(choice.conditions, itemIds, node.id, choice.id, shortPath);
      }

      // Check choice effects
      if (Array.isArray(choice.effects)) {
        validateEffectItemRefs(choice.effects, itemIds, node.id, choice.id, shortPath);
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
 * @param {string} file - Source file path
 */
function validateConditionItemRefs(conditions, itemIds, nodeId, choiceId, file) {
  for (const condition of conditions) {
    if (condition.type === 'item') {
      if (!itemIds.has(condition.itemId)) {
        error('INVALID_ITEM_REF', `Condition references non-existent item "${condition.itemId}"`, {
          file,
          nodeId,
          choiceId,
          itemId: condition.itemId
        });
      }
    } else if (condition.type === 'not' && condition.condition) {
      validateConditionItemRefs([condition.condition], itemIds, nodeId, choiceId, file);
    } else if ((condition.type === 'and' || condition.type === 'or') && Array.isArray(condition.conditions)) {
      validateConditionItemRefs(condition.conditions, itemIds, nodeId, choiceId, file);
    }
  }
}

/**
 * Validate item references in effects
 * @param {Array} effects - Array of effect objects
 * @param {Set<string>} itemIds - Set of valid item IDs
 * @param {string} nodeId - Parent node ID
 * @param {string|null} choiceId - Parent choice ID
 * @param {string} file - Source file path
 */
function validateEffectItemRefs(effects, itemIds, nodeId, choiceId, file) {
  for (const effect of effects) {
    if (effect.type === 'addItem' || effect.type === 'removeItem') {
      if (!itemIds.has(effect.itemId)) {
        error('INVALID_ITEM_REF', `Effect references non-existent item "${effect.itemId}"`, {
          file,
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
 * @param {Map<string, NodeEntry>} nodeIndex - Node index with file origins
 */
function validateDeadEnds(nodeIndex) {
  for (const [nodeId, { file, node }] of nodeIndex) {
    const hasChoices = Array.isArray(node.choices) && node.choices.length > 0;
    const isEnding = Array.isArray(node.tags) && node.tags.includes('ending');

    if (!hasChoices && !isEnding) {
      warn('POTENTIAL_DEAD_END', `Node "${node.id}" has no choices and is not tagged as ending`, {
        file: path.basename(file),
        nodeId: node.id
      });
    }
  }
}

/**
 * Rule 5: Find reachable nodes from start (using node index)
 * @param {Map<string, NodeEntry>} nodeIndex - Node index with file origins
 * @param {string} startId - Starting node ID
 * @returns {Set<string>} Set of reachable node IDs
 */
function findReachableNodes(nodeIndex, startId) {
  const reachable = new Set();
  const queue = [startId];

  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (reachable.has(nodeId)) continue;
    reachable.add(nodeId);

    const entry = nodeIndex.get(nodeId);
    if (!entry || !Array.isArray(entry.node.choices)) continue;

    for (const choice of entry.node.choices) {
      if (choice.targetId && !reachable.has(choice.targetId)) {
        queue.push(choice.targetId);
      }
    }
  }

  return reachable;
}

/**
 * Detect orphan nodes (unreachable from start)
 * @param {Map<string, NodeEntry>} nodeIndex - Node index with file origins
 * @param {Set<string>} reachable - Set of reachable node IDs
 */
function validateOrphanNodes(nodeIndex, reachable) {
  for (const [nodeId, { file, node }] of nodeIndex) {
    if (!reachable.has(nodeId)) {
      warn('ORPHAN_NODE', `Node "${nodeId}" is not reachable from start`, {
        file: path.basename(file),
        nodeId
      });
    }
  }
}

/**
 * Rule 6: Find cycles using Tarjan's algorithm for strongly connected components
 * @param {Map<string, NodeEntry>} nodeIndex - Node index with file origins
 * @returns {Array<Array<string>>} Array of cycle node ID arrays
 */
function findStronglyConnectedComponents(nodeIndex) {
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

    const entry = nodeIndex.get(nodeId);
    if (entry && Array.isArray(entry.node.choices)) {
      for (const choice of entry.node.choices) {
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

  for (const nodeId of nodeIndex.keys()) {
    if (!index.has(nodeId)) {
      strongConnect(nodeId);
    }
  }

  return sccs;
}

/**
 * Check if a cycle has an exit path
 * @param {Array<string>} cycle - Array of node IDs in the cycle
 * @param {Map<string, NodeEntry>} nodeIndex - Node index with file origins
 * @returns {boolean} True if cycle has an exit
 */
function cycleHasExit(cycle, nodeIndex) {
  const cycleSet = new Set(cycle);

  for (const nodeId of cycle) {
    const entry = nodeIndex.get(nodeId);
    if (!entry || !Array.isArray(entry.node.choices)) continue;

    for (const choice of entry.node.choices) {
      if (choice.targetId && !cycleSet.has(choice.targetId)) {
        return true; // Found an exit from the cycle
      }
    }
  }

  return false;
}

/**
 * Validate cycles have exits
 * @param {Map<string, NodeEntry>} nodeIndex - Node index with file origins
 */
function validateCycles(nodeIndex) {
  const cycles = findStronglyConnectedComponents(nodeIndex);

  for (const cycle of cycles) {
    if (!cycleHasExit(cycle, nodeIndex)) {
      // Get file origin for the first node in cycle
      const firstEntry = nodeIndex.get(cycle[0]);
      error('INESCAPABLE_CYCLE', `Cycle detected with no exit: ${cycle.join(' -> ')}`, {
        file: firstEntry ? path.basename(firstEntry.file) : undefined,
        nodeId: cycle[0]
      });
    }
  }
}

/**
 * Rule 7: Validate ending reachability
 * @param {Map<string, NodeEntry>} nodeIndex - Node index with file origins
 * @param {Set<string>} reachable - Set of reachable node IDs
 */
function validateEndingReachability(nodeIndex, reachable) {
  const endings = [];
  for (const [nodeId, { file, node }] of nodeIndex) {
    if (Array.isArray(node.tags) && node.tags.includes('ending')) {
      endings.push({ nodeId, file, node });
    }
  }

  if (endings.length === 0) {
    warn('NO_ENDINGS', 'No nodes tagged as endings found');
    return;
  }

  for (const { nodeId, file } of endings) {
    if (!reachable.has(nodeId)) {
      error('UNREACHABLE_ENDING', `Ending "${nodeId}" is not reachable from start`, {
        file: path.basename(file),
        nodeId
      });
    }
  }
}

/**
 * Rule 8: Validate initial state
 * @param {Object} initialState - Initial state object
 * @param {Map<string, NodeEntry>} nodeIndex - Node index with file origins
 * @param {string} startFile - File containing the initial state
 */
function validateInitialState(initialState, nodeIndex, startFile) {
  if (!initialState) {
    error('MISSING_INITIAL_STATE', 'No initialState found in any content file');
    return;
  }

  if (!initialState.currentNodeId) {
    error('MISSING_START_NODE', 'Initial state missing currentNodeId', {
      file: path.basename(startFile)
    });
    return;
  }

  if (!nodeIndex.has(initialState.currentNodeId)) {
    error('INVALID_START_NODE', `Initial node "${initialState.currentNodeId}" does not exist`, {
      file: path.basename(startFile)
    });
  }
}

/**
 * Main validation function (two-pass approach)
 */
function main() {
  console.log('');
  console.log('========================================');
  console.log('  Content Validation (ENGINE.md Rules)');
  console.log('  Multi-file support enabled');
  console.log('========================================');
  console.log('');

  if (forceMode) {
    console.log('[MODE] Force mode enabled - errors will not block build');
  }
  if (warnOnly) {
    console.log('[MODE] Warn-only mode - all issues reported as warnings');
  }
  console.log(`[PATH] ${contentPath}`);
  console.log('');

  // Discover content files
  info('Discovering content files...');
  const contentFiles = discoverContentFiles(contentPath);

  if (contentFiles.length === 0) {
    printSummary();
    process.exit(1);
  }

  info(`Found ${contentFiles.length} content file(s): ${contentFiles.map(f => path.basename(f)).join(', ')}`);
  console.log('');

  // Load all content files
  info('Loading content files...');
  const manifests = new Map();
  let hasSchemaErrors = false;

  for (const filePath of contentFiles) {
    const manifest = loadContent(filePath);
    if (!manifest) {
      hasSchemaErrors = true;
      continue;
    }

    if (!validateSchema(manifest, filePath)) {
      hasSchemaErrors = true;
      continue;
    }

    manifests.set(filePath, manifest);
    info(`  ✓ Loaded ${path.basename(filePath)}`);
  }

  if (manifests.size === 0) {
    error('NO_VALID_FILES', 'No valid content files could be loaded');
    printSummary();
    process.exit(1);
  }

  console.log('');

  // PASS 1: Build combined node index
  info('Pass 1: Building node index...');
  const { nodeIndex, itemIds, initialState, startFile } = buildNodeIndex(manifests);

  // Report per-file and combined stats
  let totalNodes = 0;
  let totalItems = 0;
  for (const [filePath, stats] of results.fileStats) {
    info(`  ${path.basename(filePath)}: ${stats.nodes} nodes, ${stats.items} items`);
    totalNodes += stats.nodes;
    totalItems += stats.items;
  }
  info(`  Combined: ${nodeIndex.size} unique nodes, ${itemIds.size} items`);
  console.log('');

  // PASS 2: Validate cross-references against combined index
  info('Pass 2: Validating cross-references...');

  info('  Checking choice targets...');
  validateChoiceTargets(nodeIndex);

  info('  Checking item references...');
  validateItemReferences(nodeIndex, itemIds);

  info('  Checking for dead-ends...');
  validateDeadEnds(nodeIndex);

  info('  Checking initial state...');
  validateInitialState(initialState, nodeIndex, startFile);

  // Reachability analysis (requires valid start node)
  if (initialState && initialState.currentNodeId && nodeIndex.has(initialState.currentNodeId)) {
    info('  Checking reachability...');
    const reachable = findReachableNodes(nodeIndex, initialState.currentNodeId);
    validateOrphanNodes(nodeIndex, reachable);

    info('  Checking for inescapable cycles...');
    validateCycles(nodeIndex);

    info('  Checking ending reachability...');
    validateEndingReachability(nodeIndex, reachable);
  } else {
    warn('SKIP_REACHABILITY', 'Skipping reachability checks - no valid start node');
  }

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

  // Per-file breakdown
  if (results.fileStats.size > 1) {
    console.log('  Files validated:');
    for (const [filePath, stats] of results.fileStats) {
      console.log(`    ${path.basename(filePath)}: ${stats.nodes} nodes`);
    }
    console.log('');
  }

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
