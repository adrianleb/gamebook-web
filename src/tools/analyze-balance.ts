#!/usr/bin/env npx tsx
/**
 * Balance Analysis CLI
 *
 * Analyzes game content for balance issues:
 * - Stat/faction threshold achievability
 * - Item acquisition and requirement paths
 * - Ending reachability
 *
 * Usage:
 *   npx tsx src/tools/analyze-balance.ts [content-file...]
 *   npx tsx src/tools/analyze-balance.ts src/content/act1-sample.json
 *   npx tsx src/tools/analyze-balance.ts src/content/*.json
 *
 * Exit codes:
 *   0 - All checks pass
 *   1 - Balance issues found
 *   2 - File not found or parse error
 *
 * @module tools/analyze-balance
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { analyzeBalance, formatReport } from './balance-analyzer';
import type { ContentManifest } from '../engine/types';

function loadManifest(filePath: string): ContentManifest {
  const absolutePath = resolve(process.cwd(), filePath);

  if (!existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const content = readFileSync(absolutePath, 'utf-8');
  return JSON.parse(content) as ContentManifest;
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: npx tsx src/tools/analyze-balance.ts [content-file...]');
    console.log('');
    console.log('Examples:');
    console.log('  npx tsx src/tools/analyze-balance.ts src/content/act1-sample.json');
    console.log('  npx tsx src/tools/analyze-balance.ts src/content/*.json');
    process.exit(0);
  }

  let hasErrors = false;

  for (const filePath of args) {
    console.log(`\nAnalyzing: ${filePath}`);
    console.log('='.repeat(60));

    try {
      const manifest = loadManifest(filePath);
      const report = analyzeBalance(manifest);
      console.log(formatReport(report));

      if (!report.valid) {
        hasErrors = true;
      }
    } catch (error) {
      console.error(`Error processing ${filePath}:`, error);
      hasErrors = true;
    }
  }

  process.exit(hasErrors ? 1 : 0);
}

main();
