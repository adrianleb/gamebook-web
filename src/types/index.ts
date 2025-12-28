/**
 * Shared type definitions for the gamebook-web project.
 *
 * Core types are defined here and imported by engine, ui, and content modules.
 * Detailed schemas are documented in /docs/ENGINE.md.
 */

// Re-export all types from their respective modules once implemented
// For now, this serves as the entry point for shared types

export type NodeId = string;
export type ItemId = string;
export type FlagId = string;

/**
 * Version for save file compatibility checking.
 * Increment when save format changes.
 */
export const SAVE_VERSION = 1;
