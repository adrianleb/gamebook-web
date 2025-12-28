# GANG.md — Coordination Contract

## 1. Definition of the Deliverable (Definition of Done)

### What we are building
A complete, browser-based RPG/adventure game that adapts the referenced gamebook content into a playable start-to-finish experience. The game must run locally in a modern browser (Chrome/Firefox/Safari) with an “old school DOS” presentation inspired by classic LucasArts/Full Throttle-era adventure games (text-heavy, scene-based exploration, inventory/choices, strong UI vibe).

### Core product requirements
- **Playable from start to end**: all major story nodes reachable, endings reachable, no dead-ends caused by missing implementation.
- **Gamebook adaptation**: the content from the provided gamebook repository is represented as locations/scenes/nodes with choices, state flags, inventory, checks, and outcomes.
- **Old-school DOS vibe**:
  - Pixel/bitmap-like UI styling (low-res feel, limited palette, CRT-ish optional filter).
  - Keyboard-friendly navigation.
  - Scene panel + text log + choice list (and optional portrait/scene art placeholders).
- **Save/Load**: local save slots (localStorage/IndexedDB acceptable).
- **Accessibility basics**: readable fonts, scalable text, non-mouse navigation supported.
- **Build & run**: `npm install`, `npm run dev`, `npm run build` produce a static build.

### Definition of Done (DoD)
- All story content is implemented and reachable; at least one full playthrough has been QA’d and recorded in notes.
- No P0 bugs (crashes, blocked progression, corrupted saves).
- Consistent UI/UX and content formatting; choices are clear and deterministic where intended.
- Repository includes:
  - Setup instructions.
  - Content pipeline docs.
  - QA checklist results.
  - Basic automated checks (lint/test/build).

## 2. Collaboration Rules (Decision Ownership & Protocol)

### Decision ownership
- **Agent A** owns integration decisions: architecture, folder structure, merges, and release readiness.
- **Agent B** owns runtime/game-engine decisions: state model, save system, scene rendering implementation.
- **Agent C** owns narrative/content adaptation decisions: node structure, branching logic fidelity, text formatting, content completeness.
- **Agent D** owns UI/UX and “DOS vibe” decisions: layout, typography, palette, interaction patterns, sound/feedback guidelines.

### Decision protocol
1. Any agent can propose a change via a short RFC in an issue or PR description.
2. The owning agent reviews and either:
   - Accepts as-is,
   - Requests revision,
   - Escalates to Agent A for tie-break.
3. Breaking changes (content schema changes, save format changes, routing/state rewrites) require:
   - A migration note,
   - Approval by Agent A and at least one other agent impacted.

## 3. Workflow: Phases and Cycles

### Macro phases
1. **Foundation**
   - Choose tech stack, create repo scaffold, establish content schema, basic renderer.
2. **Vertical Slice**
   - Implement one representative chapter/segment end-to-end (UI + content + save).
3. **Full Content Integration**
   - Convert/adapt all gamebook content into the schema and wire all branches.
4. **Polish & QA**
   - Balance UX, fix blockers, verify all endings, performance and save stability.
5. **Release**
   - Tag release, generate build, final documentation.

### Micro cycle (repeatable)
For each cycle (typically 1–3 days of work):
- Plan: pick 1–3 issues; confirm acceptance criteria.
- Implement: create branch, commit in small increments.
- Review: another agent reviews (Agent B/C/D reviewed by Agent A for integration risk).
- Validate: run checklist items relevant to change.
- Merge: only via Agent A after checks pass.

## 4. Content Format & Conventions (Domain-Specific)

### Content model (high-level)
- **Scene/Node**: unique id, title, body text, optional image key, tags.
- **Choices**: label, destination node id, conditions (flags/items/stats), effects (set/clear flags, add/remove items, stat deltas).
- **Game State**: inventory, flags, stats, visited nodes, quest markers.

### Writing/formatting conventions
- Second-person present tense unless original text strongly differs.
- Keep paragraphs short for DOS-style readability.
- Choices begin with verb phrases where possible (e.g., “Open the door”, “Talk to the bartender”).
- Use consistent naming for flags/items (`snake_case`).

### Determinism and fairness
- Any random rolls must be:
  - Visible to the player (result shown),
  - Seeded per run (optional),
  - Documented in the content.

## 5. Repo Layout

Proposed structure (Agent A may adjust once agreed):
- `README.md` — setup, run, build, game overview.
- `GANG.md` — this contract.
- `docs/`
  - `content-schema.md` — schema + examples.
  - `style-guide.md` — UI palette/typography rules.
  - `qa-playthrough-notes.md` — testing notes and known issues.
- `src/`
  - `app/` — app shell, routing (if any).
  - `engine/` — state machine, reducers, save/load.
  - `content/` — compiled game content JSON.
  - `content-pipeline/` — scripts to transform/import from source.
  - `ui/` — components, layout, theme.
  - `assets/` — fonts, sounds, images.
- `scripts/` — build-time utilities.
- `tests/` — unit tests and content validation tests.

## 6. QA & Validation Checklist

### Automated
- `npm run lint` passes.
- `npm run build` succeeds.
- Content validation script passes:
  - No missing node ids.
  - No dangling choice destinations.
  - No invalid condition/effect keys.
  - At least one valid start node and at least one ending node.

### Manual playthrough
- New game → can reach mid-game → can reach at least one ending.
- Save/Load works across refresh.
- Keyboard-only navigation works:
  - Move through choices, confirm selection, open inventory, open save/load.
- UI readability at multiple viewport sizes.
- No progression blockers:
  - Conditional choices correctly appear/disappear.
  - Inventory gating behaves as described.

### Regression checklist
- Existing saves either load or fail gracefully with a clear message.
- No duplicated or missing content segments after merges.

## 7. Kickoff Tasks (Initial Work Per Agent)

### Agent A
- Create repo scaffold, CI checks, and baseline app shell.
- Write `docs/content-schema.md` draft and get sign-off.
- Define initial milestones and acceptance criteria for vertical slice.

### Agent B
- Implement the core engine loop:
  - State model, reducer/actions, node transitions.
  - Save/load API.
  - Content validator (script and/or runtime checks).

### Agent C
- Analyze the source gamebook structure and propose mapping into nodes/choices.
- Produce the first converted segment for the vertical slice.
- Document edge cases (conditional passages, items, checks, endings).

### Agent D
- Produce UI theme proposal (palette, fonts, layout wireframe).
- Implement initial UI components for vertical slice (log panel, choices, inventory panel).
- Define interaction patterns (keyboard shortcuts, focus states).

## 8. Guardrails (Scope Control & Quality Bar)

### Scope control
- No multiplayer.
- No procedural world generation unless already implied by the gamebook.
- Art can be minimal (placeholders allowed) as long as the DOS vibe is coherent.
- Prioritize **complete playability** over extra features (achievements, extra mini-games, etc.).

### Quality bar
- Never merge incomplete branches that break progression.
- Content completeness is non-negotiable: every referenced node exists.
- Keep the engine simple: data-driven nodes and choices; avoid bespoke logic per scene unless absolutely required.

### Performance and compatibility
- Must run smoothly on typical laptops; avoid heavy libraries.
- Target latest two major versions of Chrome/Firefox/Safari.
