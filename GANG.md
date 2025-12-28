# GANG.md — Coordination Contract

## 1. Definition of the Deliverable (what we’re building, definition of done)

### Deliverable
A complete, browser-based, start-to-finish playable RPG/adventure game adapted from the referenced gamebook repository (https://github.com/adrianleb/gamebook), presented with an old-school DOS / LucasArts-style adventure vibe (e.g., chunky UI, pixel-ish presentation, strong dialogue scenes, inventory interactions, punchy SFX).

### Non-negotiables
- Playable from the first screen to an ending (win/lose or multiple endings), with no dead ends caused by missing content.
- Fully functional game loop: title → new game → gameplay → save/load → ending → credits.
- Narrative parity with the source: all book nodes/scenes are represented, including choices and outcomes, unless intentionally adapted (documented via ADR).
- DOS-era presentation: keyboard-friendly, strong text/box UI, optional mouse, retro typography, sound cues.
- Runs locally and in a typical static hosting environment (no server required unless explicitly decided).

### Definition of Done
Done means:
1) The entire story graph is implemented and reachable.
2) The engine supports all mechanics required by the story (flags, stats, combat if needed, inventory, skill checks, randomization if required).
3) UI/UX supports reading, choosing, navigating, and managing player state without friction.
4) Save/Load is reliable (slot-based) and versioned.
5) Audio/visual package is coherent and consistent with the intended vibe.
6) QA checklist passes; no P0/P1 bugs; the game can be completed in at least two full playthroughs.

## 2. Collaboration Rules (decision ownership by agent name, decision protocol)

### Decision ownership
- Agent A owns final integration decisions, repo health, and release readiness.
- Agent B owns narrative accuracy, dialogue tone, branching integrity, and content completeness.
- Agent C owns engine/system design (state machine, data formats, save system, core mechanics).
- Agent D owns UI/interaction patterns, visual language, accessibility, and “DOS vibe” execution.
- Agent E owns audio pipeline, asset organization, and build-time tooling for content ingestion.
- Agent F owns QA strategy, playthrough validation, bug triage, and regression tracking.

### Decision protocol
- Any non-trivial change requires a short RFC (in /docs/rfcs) before implementation.
- Architectural changes require an ADR (in /docs/adrs). Agent A merges ADRs after review by at least one other agent.
- Conflicts are resolved by:
  1) Documenting trade-offs in an RFC/ADR.
  2) Agent A makes the final call after input from the relevant owners.

### Review rules
- Every PR needs at least one reviewer.
- Cross-review expectations:
  - Agent B reviews story-data changes that affect narrative.
  - Agent C reviews engine/system changes.
  - Agent D reviews UI changes.
  - Agent F reviews anything that impacts testability or completion.

## 3. Workflow: Phases and Cycles (macro phases, micro cycle format)

### Macro phases
1) Discovery & Specification
   - Confirm source content structure, mechanics requirements, endings.
   - Produce GDD + Story Map + Data Schema.
2) Foundation Build
   - Implement engine skeleton, renderer/UI shell, content loader, save/load.
3) Vertical Slice (Representative Chapter)
   - One full segment including inventory, checks, transitions, audio, save/load.
4) Full Content Implementation
   - Implement all scenes/nodes, items, flags, combat/checks, endings.
5) Polish & Balancing
   - UI polish, pacing, difficulty tuning, missing art/sfx, performance.
6) QA & Release
   - Full playthroughs, fixes, final build, release notes.

### Micro cycle format (repeat weekly or per milestone)
1) Plan: each agent proposes tasks + acceptance criteria.
2) Implement: small PRs (ideally <500 LOC diff) aligned to acceptance.
3) Review: required reviewers per section 2.
4) Integrate: Agent A merges; resolve conflicts; update changelog.
5) Validate: Agent F runs targeted regression + at least one path check.

## 4. Content Format & Conventions (domain-specific)

### Story/content model
- Source material is treated as the canonical narrative reference.
- Game content must be data-driven:
  - Scenes/nodes with IDs
  - Text blocks with optional speaker tags
  - Choices with conditions/effects
  - Effects: set/clear flags, stat changes, inventory changes, route transitions

### Data conventions
- All nodes/scenes use stable IDs (no renaming without a migration note).
- Conditions/effects are declarative (no embedded arbitrary code in content files).
- Localization-ready text: no string concatenation for player-facing lines.
- Every node must define at least:
  - title (internal)
  - body (text)
  - exits/choices (or an explicit end)

### UI/UX conventions
- Keyboard-first navigation:
  - Arrow keys / WASD to move selection
  - Enter to confirm
  - Esc to back/menu
  - Hotkeys 1-9 for choices when applicable
- DOS vibe constraints:
  - Fixed grid-ish layout, strong borders, high-contrast palette
  - Monospace/bitmap-style font (or convincingly retro)
  - Responsive but keeps “terminal panel” feel on wide screens

### Save system conventions
- Versioned saves with automatic migration where possible.
- At minimum: 3 slots + autosave (optional but preferred).

### Audio conventions
- Short, punchy SFX for UI actions.
- Background music optional but consistent; must not obstruct readability.
- All assets credited and license-compatible.

## 5. Repo Layout

- /docs
  - GDD.md (game design overview)
  - STORY.md (story map, node index, endings)
  - ENGINE.md (state model, data schema, save format)
  - UI.md (screen flows, interaction, style guide)
  - AUDIO.md (audio plan, asset list, pipeline)
  - QA.md (test plan, playthrough scripts, bug rubric)
  - /rfcs (short proposals)
  - /adrs (architecture decisions)
- /src
  - /engine (state machine, rules, save/load)
  - /content (compiled content output)
  - /ui (components, screens, layout)
  - /assets (fonts, images, audio)
  - /tools (importers, validators)
- /content-src
  - (authoring format; imported/validated into /src/content)
- /tests
  - unit + content validation + golden path tests

## 6. QA & Validation Checklist

### Content completeness
- [ ] All source nodes/sections represented and reachable.
- [ ] No orphan nodes; no missing transitions.
- [ ] Every ending reachable via at least one validated path.

### Engine correctness
- [ ] Deterministic state updates (except explicit RNG).
- [ ] Conditions/effects behave as specified.
- [ ] Save/load preserves exact state (including RNG seed if used).

### UX quality
- [ ] Keyboard-only playthrough possible.
- [ ] Choice selection always clear; no hidden required interactions.
- [ ] Text is readable on common resolutions.

### Performance & stability
- [ ] No hard crashes in full playthrough.
- [ ] No memory leaks or runaway timers.

### Audio/visual
- [ ] Consistent palette/typography.
- [ ] Audio levels balanced; mute/volume controls present.

### Release readiness
- [ ] Credits and licenses included.
- [ ] Build produces a deployable artifact.

## 7. Kickoff Tasks (initial work per agent)

- Agent A
  - Create initial milestone plan and PR template.
  - Establish CI checks (lint/test/build) and branching strategy.
  - Draft /docs/GDD.md skeleton and acceptance criteria format.

- Agent B
  - Audit the source gamebook structure and produce a node/scene index.
  - Draft /docs/STORY.md with endings list and dependency notes (items/flags).
  - Identify any unclear/ambiguous passages requiring adaptation.

- Agent C
  - Propose content schema + save schema and document in /docs/ENGINE.md.
  - Implement minimal engine loop (load node → render → apply choice → next).
  - Add content validator (missing IDs, invalid effects, unreachable nodes).

- Agent D
  - Draft /docs/UI.md: screen flow (title, game, inventory, pause, save/load).
  - Produce a DOS-style layout spec (fonts, palette, borders, spacing).
  - Define interaction model for inventory and choice lists.

- Agent E
  - Draft /docs/AUDIO.md with UI SFX list and music plan.
  - Set up asset pipeline conventions and folder structure.
  - Create initial UI sounds (placeholder allowed, licensed) and volume controls plan.

- Agent F
  - Draft /docs/QA.md including playthrough scripts and bug severity rubric.
  - Define “golden path” test cases and content coverage targets.
  - Set up a lightweight bug report template.

## 8. Guardrails (scope control, quality bar)

- No “we’ll do it later” placeholders in shipped content. Placeholders are allowed only during implementation and must be tracked in an issue list.
- Any new mechanic must be justified by story needs and documented (RFC → ADR if accepted).
- Avoid over-engineering: prefer a simple, testable state machine + declarative content.
- Maintain retro vibe: do not drift into modern UI patterns that undermine the DOS/point-and-click feel.
- Respect licensing: all third-party assets must be compatible and credited.
- Quality bar: the game must be completable, readable, stable, and consistent; “MVP” shortcuts are out of scope.
