/**
 * Balance Analyzer Tests
 *
 * Tests the balance analysis tool for M5.3 Difficulty & Balance Review.
 *
 * @see /docs/ENGINE.md for schema definitions
 * @see /src/tools/balance-analyzer.ts
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeBalance,
  formatReport,
  type BalanceReport,
} from '../../src/tools/balance-analyzer';
import type { ContentManifest } from '../../src/engine/types';

// =============================================================================
// Test Fixtures
// =============================================================================

function createMinimalManifest(
  overrides: Partial<ContentManifest> = {}
): ContentManifest {
  return {
    schemaVersion: '1.0.0',
    nodes: [
      {
        id: 'START',
        title: 'Start',
        body: 'Beginning',
        choices: [
          {
            id: 'go',
            text: 'Continue',
            targetId: 'END',
          },
        ],
        tags: ['start'],
      },
      {
        id: 'END',
        title: 'End',
        body: 'The end',
        choices: [],
        tags: ['ending'],
      },
    ],
    items: [],
    initialState: {
      currentNodeId: 'START',
      flags: {},
      stats: { health: 100, maxHealth: 100 },
      inventory: [],
      factions: { factionA: 50, factionB: 50 },
    },
    ...overrides,
  };
}

// =============================================================================
// Basic Analysis Tests
// =============================================================================

describe('Balance Analyzer', () => {
  describe('analyzeBalance', () => {
    it('should return valid for a simple reachable manifest', () => {
      const manifest = createMinimalManifest();
      const report = analyzeBalance(manifest);

      expect(report.valid).toBe(true);
      expect(report.summary.errors).toHaveLength(0);
      expect(report.summary.totalNodes).toBe(2);
      expect(report.summary.totalEndings).toBe(1);
      expect(report.summary.reachableEndings).toBe(1);
    });

    it('should detect unreachable endings', () => {
      const manifest = createMinimalManifest({
        nodes: [
          {
            id: 'START',
            title: 'Start',
            body: 'Beginning',
            choices: [
              {
                id: 'go',
                text: 'Continue',
                targetId: 'MIDDLE',
              },
            ],
          },
          {
            id: 'MIDDLE',
            title: 'Middle',
            body: 'In the middle',
            choices: [],
          },
          {
            id: 'UNREACHABLE_END',
            title: 'Secret Ending',
            body: 'You should not be here',
            choices: [],
            tags: ['ending'],
          },
        ],
      });

      const report = analyzeBalance(manifest);

      expect(report.valid).toBe(false);
      expect(report.endings.allReachable).toBe(false);
      expect(report.endings.endings).toHaveLength(1);
      expect(report.endings.endings[0].reachable).toBe(false);
      expect(report.summary.errors).toContain(
        '1 ending(s) are not reachable'
      );
    });
  });

  // ===========================================================================
  // Threshold Analysis Tests
  // ===========================================================================

  describe('Threshold Analysis', () => {
    it('should detect achievable stat thresholds', () => {
      const manifest = createMinimalManifest({
        nodes: [
          {
            id: 'START',
            title: 'Start',
            body: 'Beginning',
            choices: [
              {
                id: 'boost',
                text: 'Boost health',
                targetId: 'CHECK',
                effects: [
                  { type: 'modifyStat', stat: 'health', delta: 20 },
                ],
              },
            ],
          },
          {
            id: 'CHECK',
            title: 'Health Check',
            body: 'Checking health',
            choices: [
              {
                id: 'strong',
                text: 'Strong path',
                targetId: 'END',
                conditions: [
                  { type: 'stat', stat: 'health', operator: '>=', value: 110 },
                ],
              },
              {
                id: 'weak',
                text: 'Weak path',
                targetId: 'END',
              },
            ],
          },
          {
            id: 'END',
            title: 'End',
            body: 'The end',
            choices: [],
            tags: ['ending'],
          },
        ],
      });

      const report = analyzeBalance(manifest);

      expect(report.thresholds.stats).toHaveLength(1);
      expect(report.thresholds.stats[0].name).toBe('health');
      expect(report.thresholds.stats[0].minRequired).toBe(110);
      expect(report.thresholds.stats[0].initialValue).toBe(100);
      // With +20 boost, max achievable is 120
      expect(report.thresholds.stats[0].maxAchievable).toBe(120);
      expect(report.thresholds.stats[0].reachable).toBe(true);
    });

    it('should detect unreachable stat thresholds', () => {
      const manifest = createMinimalManifest({
        nodes: [
          {
            id: 'START',
            title: 'Start',
            body: 'Beginning',
            choices: [
              {
                id: 'go',
                text: 'Continue',
                targetId: 'CHECK',
              },
            ],
          },
          {
            id: 'CHECK',
            title: 'Impossible Check',
            body: 'This requires impossible stats',
            choices: [
              {
                id: 'impossible',
                text: 'Requires 200 health',
                targetId: 'END',
                conditions: [
                  { type: 'stat', stat: 'health', operator: '>=', value: 200 },
                ],
              },
            ],
          },
          {
            id: 'END',
            title: 'End',
            body: 'The end',
            choices: [],
            tags: ['ending'],
          },
        ],
      });

      const report = analyzeBalance(manifest);

      expect(report.thresholds.stats[0].reachable).toBe(false);
      expect(report.thresholds.warnings.length).toBeGreaterThan(0);
    });

    it('should analyze faction thresholds', () => {
      const manifest = createMinimalManifest({
        nodes: [
          {
            id: 'START',
            title: 'Start',
            body: 'Beginning',
            choices: [
              {
                id: 'faction_boost',
                text: 'Join faction A',
                targetId: 'CHECK',
                effects: [
                  { type: 'modifyFaction', faction: 'factionA', delta: 25 },
                ],
              },
            ],
          },
          {
            id: 'CHECK',
            title: 'Faction Check',
            body: 'Checking allegiance',
            choices: [
              {
                id: 'ally',
                text: 'Faction A ally path',
                targetId: 'END',
                conditions: [
                  { type: 'faction', faction: 'factionA', operator: '>=', value: 75 },
                ],
              },
              {
                id: 'neutral',
                text: 'Neutral path',
                targetId: 'END',
              },
            ],
          },
          {
            id: 'END',
            title: 'End',
            body: 'The end',
            choices: [],
            tags: ['ending'],
          },
        ],
      });

      const report = analyzeBalance(manifest);

      expect(report.thresholds.factions).toHaveLength(1);
      expect(report.thresholds.factions[0].name).toBe('factionA');
      expect(report.thresholds.factions[0].minRequired).toBe(75);
      expect(report.thresholds.factions[0].initialValue).toBe(50);
      // With +25 boost, max achievable is 75
      expect(report.thresholds.factions[0].maxAchievable).toBe(75);
      expect(report.thresholds.factions[0].reachable).toBe(true);
    });
  });

  // ===========================================================================
  // Item Analysis Tests
  // ===========================================================================

  describe('Item Analysis', () => {
    it('should detect items granted and required', () => {
      const manifest = createMinimalManifest({
        nodes: [
          {
            id: 'START',
            title: 'Start',
            body: 'Beginning',
            choices: [
              {
                id: 'take_key',
                text: 'Take the key',
                targetId: 'DOOR',
                effects: [{ type: 'addItem', itemId: 'ITEM_KEY' }],
              },
            ],
          },
          {
            id: 'DOOR',
            title: 'Locked Door',
            body: 'A door blocks your path',
            choices: [
              {
                id: 'unlock',
                text: 'Unlock the door',
                targetId: 'END',
                conditions: [
                  { type: 'item', itemId: 'ITEM_KEY', operator: 'has' },
                ],
              },
            ],
          },
          {
            id: 'END',
            title: 'End',
            body: 'The end',
            choices: [],
            tags: ['ending'],
          },
        ],
        items: [
          {
            id: 'ITEM_KEY',
            name: 'Key',
            description: 'A rusty key',
            stackable: false,
            usable: false,
            consumable: false,
          },
        ],
      });

      const report = analyzeBalance(manifest);

      expect(report.items.items).toHaveLength(1);
      expect(report.items.items[0].itemId).toBe('ITEM_KEY');
      expect(report.items.items[0].grantedBy).toContain('START');
      expect(report.items.items[0].requiredBy).toContain('DOOR');
      expect(report.items.items[0].reachable).toBe(true);
    });

    it('should detect items that are never granted', () => {
      const manifest = createMinimalManifest({
        nodes: [
          {
            id: 'START',
            title: 'Start',
            body: 'Beginning',
            choices: [
              {
                id: 'go',
                text: 'Continue',
                targetId: 'DOOR',
              },
            ],
          },
          {
            id: 'DOOR',
            title: 'Locked Door',
            body: 'A door blocks your path',
            choices: [
              {
                id: 'unlock',
                text: 'Unlock the door',
                targetId: 'END',
                conditions: [
                  { type: 'item', itemId: 'ITEM_KEY', operator: 'has' },
                ],
              },
            ],
          },
          {
            id: 'END',
            title: 'End',
            body: 'The end',
            choices: [],
            tags: ['ending'],
          },
        ],
      });

      const report = analyzeBalance(manifest);

      expect(report.items.items).toHaveLength(1);
      expect(report.items.items[0].reachable).toBe(false);
      expect(report.items.warnings.length).toBeGreaterThan(0);
    });

    it('should recognize items in initial inventory', () => {
      const manifest = createMinimalManifest({
        nodes: [
          {
            id: 'START',
            title: 'Start',
            body: 'Beginning',
            choices: [
              {
                id: 'use_item',
                text: 'Use starter item',
                targetId: 'END',
                conditions: [
                  { type: 'item', itemId: 'ITEM_STARTER', operator: 'has' },
                ],
              },
            ],
          },
          {
            id: 'END',
            title: 'End',
            body: 'The end',
            choices: [],
            tags: ['ending'],
          },
        ],
        initialState: {
          currentNodeId: 'START',
          flags: {},
          stats: { health: 100 },
          inventory: [{ itemId: 'ITEM_STARTER', quantity: 1 }],
          factions: {},
        },
      });

      const report = analyzeBalance(manifest);

      expect(report.items.items).toHaveLength(1);
      expect(report.items.items[0].itemId).toBe('ITEM_STARTER');
      expect(report.items.items[0].reachable).toBe(true);
    });
  });

  // ===========================================================================
  // Ending Analysis Tests
  // ===========================================================================

  describe('Ending Analysis', () => {
    it('should find all reachable endings', () => {
      const manifest = createMinimalManifest({
        nodes: [
          {
            id: 'START',
            title: 'Start',
            body: 'Beginning',
            choices: [
              { id: 'good', text: 'Good path', targetId: 'GOOD_END' },
              { id: 'bad', text: 'Bad path', targetId: 'BAD_END' },
            ],
          },
          {
            id: 'GOOD_END',
            title: 'Good Ending',
            body: 'Victory!',
            choices: [],
            tags: ['ending'],
          },
          {
            id: 'BAD_END',
            title: 'Bad Ending',
            body: 'Defeat!',
            choices: [],
            tags: ['ending'],
          },
        ],
      });

      const report = analyzeBalance(manifest);

      expect(report.endings.endings).toHaveLength(2);
      expect(report.endings.allReachable).toBe(true);
      expect(report.summary.reachableEndings).toBe(2);
    });
  });

  // ===========================================================================
  // Report Formatting Tests
  // ===========================================================================

  describe('formatReport', () => {
    it('should format a passing report', () => {
      const manifest = createMinimalManifest();
      const report = analyzeBalance(manifest);
      const formatted = formatReport(report);

      expect(formatted).toContain('Balance Analysis Report');
      expect(formatted).toContain('RESULT: PASS');
      expect(formatted).toContain('Total Nodes: 2');
    });

    it('should format a failing report with errors', () => {
      const manifest = createMinimalManifest({
        nodes: [
          {
            id: 'START',
            title: 'Start',
            body: 'Beginning',
            choices: [],
          },
          {
            id: 'UNREACHABLE',
            title: 'Unreachable Ending',
            body: 'Cannot get here',
            choices: [],
            tags: ['ending'],
          },
        ],
      });

      const report = analyzeBalance(manifest);
      const formatted = formatReport(report);

      expect(formatted).toContain('RESULT: FAIL');
      expect(formatted).toContain('ERRORS');
      expect(formatted).toContain('not reachable');
    });
  });

  // ===========================================================================
  // Complex Condition Tests
  // ===========================================================================

  describe('Complex Conditions', () => {
    it('should handle AND conditions', () => {
      const manifest = createMinimalManifest({
        nodes: [
          {
            id: 'START',
            title: 'Start',
            body: 'Beginning',
            choices: [
              {
                id: 'boost',
                text: 'Prepare',
                targetId: 'CHECK',
                effects: [
                  { type: 'modifyStat', stat: 'health', delta: 20 },
                  { type: 'modifyFaction', faction: 'factionA', delta: 30 },
                ],
              },
            ],
          },
          {
            id: 'CHECK',
            title: 'Combined Check',
            body: 'Multiple requirements',
            choices: [
              {
                id: 'combined',
                text: 'Combined path',
                targetId: 'END',
                conditions: [
                  {
                    type: 'and',
                    conditions: [
                      { type: 'stat', stat: 'health', operator: '>=', value: 110 },
                      { type: 'faction', faction: 'factionA', operator: '>=', value: 70 },
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: 'END',
            title: 'End',
            body: 'The end',
            choices: [],
            tags: ['ending'],
          },
        ],
      });

      const report = analyzeBalance(manifest);

      // Should extract both thresholds from AND condition
      expect(report.thresholds.stats.length).toBeGreaterThan(0);
      expect(report.thresholds.factions.length).toBeGreaterThan(0);
    });

    it('should handle OR conditions', () => {
      const manifest = createMinimalManifest({
        nodes: [
          {
            id: 'START',
            title: 'Start',
            body: 'Beginning',
            choices: [
              { id: 'go', text: 'Continue', targetId: 'CHECK' },
            ],
          },
          {
            id: 'CHECK',
            title: 'Alternative Check',
            body: 'Multiple options',
            choices: [
              {
                id: 'either',
                text: 'Either path',
                targetId: 'END',
                conditions: [
                  {
                    type: 'or',
                    conditions: [
                      { type: 'stat', stat: 'health', operator: '>=', value: 200 },
                      { type: 'faction', faction: 'factionA', operator: '>=', value: 80 },
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: 'END',
            title: 'End',
            body: 'The end',
            choices: [],
            tags: ['ending'],
          },
        ],
      });

      const report = analyzeBalance(manifest);

      // Both thresholds should be extracted from OR condition
      expect(report.thresholds.stats).toHaveLength(1);
      expect(report.thresholds.factions).toHaveLength(1);
    });

    it('should handle NOT conditions', () => {
      const manifest = createMinimalManifest({
        nodes: [
          {
            id: 'START',
            title: 'Start',
            body: 'Beginning',
            choices: [
              {
                id: 'go',
                text: 'Continue',
                targetId: 'CHECK',
              },
            ],
          },
          {
            id: 'CHECK',
            title: 'Negated Check',
            body: 'Inverse requirement',
            choices: [
              {
                id: 'inverse',
                text: 'Inverse path',
                targetId: 'END',
                conditions: [
                  {
                    type: 'not',
                    condition: {
                      type: 'stat',
                      stat: 'health',
                      operator: '<',
                      value: 50,
                    },
                  },
                ],
              },
            ],
          },
          {
            id: 'END',
            title: 'End',
            body: 'The end',
            choices: [],
            tags: ['ending'],
          },
        ],
      });

      const report = analyzeBalance(manifest);

      expect(report.thresholds.stats).toHaveLength(1);
    });
  });

  // ===========================================================================
  // onEnter Effects Tests
  // ===========================================================================

  describe('onEnter Effects', () => {
    it('should analyze effects from onEnter', () => {
      const manifest = createMinimalManifest({
        nodes: [
          {
            id: 'START',
            title: 'Start',
            body: 'Beginning',
            choices: [
              { id: 'go', text: 'Enter dungeon', targetId: 'DUNGEON' },
            ],
          },
          {
            id: 'DUNGEON',
            title: 'Dungeon',
            body: 'You take damage upon entry',
            onEnter: [
              { type: 'modifyStat', stat: 'health', delta: -20 },
              { type: 'addItem', itemId: 'ITEM_TORCH' },
            ],
            choices: [
              { id: 'exit', text: 'Exit', targetId: 'END' },
            ],
          },
          {
            id: 'END',
            title: 'End',
            body: 'The end',
            choices: [],
            tags: ['ending'],
          },
        ],
      });

      const report = analyzeBalance(manifest);

      // Should have detected stat modification and item grant
      expect(report.thresholds.stats.length).toBe(0); // No stat conditions
      expect(report.items.items).toHaveLength(1);
      expect(report.items.items[0].itemId).toBe('ITEM_TORCH');
      expect(report.items.items[0].grantedBy).toContain('DUNGEON');
    });
  });
});
