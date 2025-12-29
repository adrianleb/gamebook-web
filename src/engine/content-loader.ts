/**
 * Content loading and management.
 * Based on ENGINE.md specification v1.0.0
 *
 * Provides:
 * - JSON content loading from file or string
 * - Node and item lookup by ID
 * - Basic schema validation
 *
 * @module engine/content-loader
 */

import type {
  ContentManifest,
  Node,
  Item,
  InitialState,
  GameState,
} from './types';
import { SCHEMA_VERSION } from './types';
import { EngineError } from './errors';

export interface ContentLoader {
  isLoaded(): boolean;
  getManifest(): ContentManifest;
  getNode(nodeId: string): Node;
  getItem(itemId: string): Item;
  getAllNodes(): Node[];
  getAllItems(): Item[];
  getInitialState(): InitialState;
  createInitialGameState(): GameState;
  loadFromString(json: string): void;
  mergeFromString(json: string): void;
}

export class JsonContentLoader implements ContentLoader {
  private manifest: ContentManifest | null = null;
  private nodeMap: Map<string, Node> = new Map();
  private itemMap: Map<string, Item> = new Map();

  /**
   * Loads content from a JSON string.
   *
   * @param json - JSON string containing the content manifest
   * @throws EngineError if JSON is invalid or schema version mismatches
   */
  loadFromString(json: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new EngineError('INVALID_CONTENT', 'Failed to parse content JSON');
    }

    this.loadManifest(parsed as ContentManifest);
  }

  /**
   * Loads content from a pre-parsed object.
   *
   * @param manifest - Content manifest object
   * @throws EngineError if validation fails
   */
  loadManifest(manifest: ContentManifest): void {
    this.validateManifest(manifest);

    this.manifest = manifest;
    this.nodeMap.clear();
    this.itemMap.clear();

    for (const node of manifest.nodes) {
      if (this.nodeMap.has(node.id)) {
        throw new EngineError('DUPLICATE_NODE_ID', `Duplicate node ID: ${node.id}`, {
          nodeId: node.id,
        });
      }
      this.nodeMap.set(node.id, node);
    }

    for (const item of manifest.items) {
      if (this.itemMap.has(item.id)) {
        throw new EngineError('INVALID_CONTENT', `Duplicate item ID: ${item.id}`, {
          itemId: item.id,
        });
      }
      this.itemMap.set(item.id, item);
    }
  }

  /**
   * Merges content from a JSON string without clearing existing content.
   * Use this for loading additional content files (e.g., act2, act3).
   *
   * @param json - JSON string containing additional content
   * @throws EngineError if JSON is invalid
   */
  mergeFromString(json: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new EngineError('INVALID_CONTENT', 'Failed to parse content JSON');
    }

    const manifest = parsed as ContentManifest;

    // Add nodes without clearing (allow overwrites for cross-act references)
    if (Array.isArray(manifest.nodes)) {
      for (const node of manifest.nodes) {
        this.nodeMap.set(node.id, node);
      }
    }

    // Add items without clearing (allow overwrites for cross-act items)
    if (Array.isArray(manifest.items)) {
      for (const item of manifest.items) {
        this.itemMap.set(item.id, item);
      }
    }

    // Merge nodes and items into manifest.nodes/items arrays for getAllNodes/getAllItems
    if (this.manifest) {
      if (Array.isArray(manifest.nodes)) {
        this.manifest.nodes.push(...manifest.nodes);
      }
      if (Array.isArray(manifest.items)) {
        this.manifest.items.push(...manifest.items);
      }
    }
  }

  /**
   * Loads content from a URL (fetch).
   *
   * @param url - URL to fetch content from
   * @throws EngineError if fetch fails or content is invalid
   */
  async loadFromUrl(url: string): Promise<void> {
    let response: Response;
    try {
      response = await fetch(url);
    } catch (err) {
      throw new EngineError('INVALID_CONTENT', `Failed to fetch content: ${err}`, {
        url,
      });
    }

    if (!response.ok) {
      throw new EngineError(
        'INVALID_CONTENT',
        `HTTP error ${response.status}: ${response.statusText}`,
        { url, status: response.status }
      );
    }

    const json = await response.text();
    this.loadFromString(json);
  }

  private validateManifest(manifest: ContentManifest): void {
    if (!manifest) {
      throw new EngineError('INVALID_CONTENT', 'Content manifest is null or undefined');
    }

    if (!manifest.schemaVersion) {
      throw new EngineError(
        'INVALID_CONTENT',
        'Content manifest missing schemaVersion'
      );
    }

    // Warn if version mismatch but don't fail - allows forward compatibility
    if (manifest.schemaVersion !== SCHEMA_VERSION) {
      console.warn(
        `Content schema version ${manifest.schemaVersion} differs from engine version ${SCHEMA_VERSION}`
      );
    }

    if (!Array.isArray(manifest.nodes)) {
      throw new EngineError('INVALID_CONTENT', 'Content manifest missing nodes array');
    }

    if (!Array.isArray(manifest.items)) {
      throw new EngineError('INVALID_CONTENT', 'Content manifest missing items array');
    }

    if (!manifest.initialState) {
      throw new EngineError(
        'INVALID_CONTENT',
        'Content manifest missing initialState'
      );
    }

    if (!manifest.initialState.currentNodeId) {
      throw new EngineError(
        'INVALID_START_NODE',
        'initialState missing currentNodeId'
      );
    }
  }

  isLoaded(): boolean {
    return this.manifest !== null;
  }

  getManifest(): ContentManifest {
    if (!this.manifest) {
      throw new EngineError('CONTENT_NOT_LOADED', 'Content has not been loaded');
    }
    return this.manifest;
  }

  getNode(nodeId: string): Node {
    if (!this.manifest) {
      throw new EngineError('CONTENT_NOT_LOADED', 'Content has not been loaded');
    }

    const node = this.nodeMap.get(nodeId);
    if (!node) {
      throw new EngineError('INVALID_NODE', `Node not found: ${nodeId}`, {
        nodeId,
      });
    }
    return node;
  }

  getItem(itemId: string): Item {
    if (!this.manifest) {
      throw new EngineError('CONTENT_NOT_LOADED', 'Content has not been loaded');
    }

    const item = this.itemMap.get(itemId);
    if (!item) {
      throw new EngineError('INVALID_ITEM', `Item not found: ${itemId}`, {
        itemId,
      });
    }
    return item;
  }

  /**
   * Gets an item by ID, returning undefined if not found.
   * Useful for effect application where missing items should be handled gracefully.
   */
  getItemOrUndefined(itemId: string): Item | undefined {
    return this.itemMap.get(itemId);
  }

  getAllNodes(): Node[] {
    if (!this.manifest) {
      throw new EngineError('CONTENT_NOT_LOADED', 'Content has not been loaded');
    }
    return [...this.manifest.nodes];
  }

  getAllItems(): Item[] {
    if (!this.manifest) {
      throw new EngineError('CONTENT_NOT_LOADED', 'Content has not been loaded');
    }
    return [...this.manifest.items];
  }

  getInitialState(): InitialState {
    if (!this.manifest) {
      throw new EngineError('CONTENT_NOT_LOADED', 'Content has not been loaded');
    }
    return this.manifest.initialState;
  }

  /**
   * Creates a fresh GameState from the initial state configuration.
   */
  createInitialGameState(): GameState {
    const initial = this.getInitialState();

    return {
      currentNodeId: initial.currentNodeId,
      previousNodeId: null,
      flags: { ...initial.flags },
      stats: { ...initial.stats },
      inventory: initial.inventory.map((e) => ({ ...e })),
      factions: { ...initial.factions },
      visitedNodes: [initial.currentNodeId],
      choicesMade: [],
      isTransitioning: false,
      pendingEffects: [],
    };
  }
}

/**
 * Creates a new content loader instance.
 */
export function createContentLoader(): JsonContentLoader {
  return new JsonContentLoader();
}
