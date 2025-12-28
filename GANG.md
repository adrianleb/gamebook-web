# GANG.md — Coordination Contract

## 1) Definition of the Deliverable

### What we are building
A fully playable, browser-based RPG/adventure game that adapts the content and structure of the referenced gamebook repo (https://github.com/adrianleb/gamebook) into an interactive, end-to-end experience.

### Core experience requirements
- Player can start a new game, make choices, manage simple RPG state (at minimum: inventory + flags; optional: stats/health if supported by the source).
- The story can be completed from start to end with at least one valid victory/ending path.
- “Old-school DOS vibe” UI: chunky pixel/bitmap feel, limited palette, scanlines/CRT optional, sound cues optional; inspired by LucasArts adventure presentation (scene text, dialogue-style prompts, strong UI framing).
- Runs in modern browsers with no server required for core play (static hosting-friendly).

### Definition of Done (DoD)
- ✅ End-to-end playable build: start → multiple scenes → at least one ending reachable without debugging tools.
- ✅ All referenced scenes/sections from the chosen source path(s) are implemented (or explicitly marked as cut with rationale in `docs/cuts.md`).
- ✅ Save/Load (localStorage) works; resetting/starting over works.
- ✅ Deterministic state updates (choices consistently modify flags/inventory/stats).
- ✅ Basic accessibility: readable font sizes, keyboard navigation for choices, focus styles.
- ✅ QA checklist passes (see section 6).
- ✅ `README.md` contains how to run locally, how to build, and game controls.

Non-goals (unless explicitly promoted later): multiplayer, procedural generation, account systems, backend APIs.

---

## 2) Collaboration Rules

### Decision ownership
- Agent A owns integration decisions (architecture, repo structure, final merges, release readiness).
- Agent B owns narrative mapping decisions (how gamebook sections map to scenes, choice logic, endings criteria), reviewed by Agent A.
- Agent C owns UI presentation decisions (DOS/LucasArts vibe, layout system, typography, palette, interaction design), reviewed by Agent A.
- Agent D owns gameplay/state model decisions (inventory/flags/stats schema, save/load, engine rules), reviewed by Agent A.

### Decision protocol
1. Propose: agent opens a short design note in `/docs/decisions/NNN-title.md`.
2. Review: at least one other agent comments (Agent A must review if it impacts integration).
3. Decide: if no blocking concerns within one cycle, decision is accepted; otherwise revise.
4. Record: update `docs/decisions/README.md` index.

### Change control
- Any scope increase requires a decision note and Agent A approval.
- Breaking changes require a migration note and explicit test plan.

---

## 3) Workflow: Phases and Cycles

### Macro phases
1. **Discovery & Plan**
   - Identify playable slice, map source content, confirm state model, pick tech stack.
2. **Vertical Slice**
   - Implement engine + 3–5 scenes + UI shell + save/load.
3. **Content Build-out**
   - Convert all required sections into scenes; implement endings.
4. **Polish & QA**
   - Visual/UX polish, bug fixing, performance, accessibility, packaging.
5. **Release**
   - Tag release, publish build instructions, final playthrough sign-off.

### Micro cycle format (repeat every cycle)
- **Plan (30–60 min):** choose cycle goals and assign tasks.
- **Build:** each agent works on their owned tasks.
- **Review:** cross-review per rules; integration test.
- **Stabilize:** fix blockers, update docs, ensure green checks.
- **Demo:** one full playthrough of the slice targeted this cycle.

Cycle length: aim for small increments; always keep `main` playable.

---

## 4) Content Format & Conventions

### Scene and content model (domain-specific)
- Scenes are atomic “nodes” with:
  - `id`, `title`, `text` (supports inline markup), optional `art`, optional `musicSfx`.
  - `choices[]` each with: `label`, `to` (scene id), `conditions[]`, `effects[]`.
- State is explicit and versioned:
  - `flags` (boolean map), `inventory` (set/map), optional `stats` (numbers).
- Choice evaluation:
  - Conditions are pure predicates on state.
  - Effects are pure state transforms.

### Writing & tone
- Keep text punchy, evocative, and consistent with an 80s/90s adventure vibe.
- Prefer present tense, second-person narration unless the source strongly differs.
- Avoid long walls of text; use paragraphs and short lines.

### IDs and naming
- Scene IDs: `snake_case` (e.g., `junkyard_gate`).
- Flags: `flag_*` (e.g., `flag_met_bartender`).
- Inventory items: `item_*`.
- Stats: `stat_*`.

### Assets
- Pixel-art friendly constraints: low resolution source (e.g., 320x200 or 640x400) scaled via CSS.
- Palette defined in a single theme file.

---

## 5) Repo Layout

- `/src/`
  - `/engine/` (state machine, evaluator, save/load, data validation)
  - `/content/` (scenes, items, flags, localization-ready strings)
  - `/ui/` (retro shell, components, input handling)
  - `/assets/` (images, fonts, sfx)
- `/public/` (static entry, icons)
- `/docs/`
  - `/decisions/` (architecture + content decisions)
  - `walkthrough.md` (canonical test playthrough paths)
  - `cuts.md` (any omitted content with reasons)
- `/tests/`
  - engine unit tests
  - content validation tests (missing scene ids, unreachable endings, etc.)

---

## 6) QA & Validation Checklist

### Functional
- New Game starts at correct intro scene.
- No dead links: every choice target exists.
- At least one ending is reachable.
- Save/Load persists state and current scene.
- Restart clears state.

### Content integrity
- Content validator passes: no duplicate ids, no missing ids, no orphan scenes (unless intentionally hidden and documented).
- Conditions/effects are valid operations.

### UI/UX
- Keyboard navigation: arrow/Tab to move, Enter/Space to select.
- Focus visible on selectable elements.
- Text readable at common viewport sizes.
- Retro theme consistent across scenes.

### Performance/compat
- Loads fast on a static host.
- Works on latest Chrome/Firefox/Safari.

### Release readiness
- `README.md` updated.
- One full “happy path” playthrough and one alternate path playthrough completed with notes recorded in `docs/walkthrough.md`.

---

## 7) Kickoff Tasks (initial work per agent)

- Agent A
  - Choose stack and scaffolding (Vite/React or vanilla+Vite; testing approach).
  - Create repo skeleton, CI checks, and content validator placeholder.
  - Define minimal engine interface contracts.

- Agent B
  - Inspect the source gamebook repo; produce a scene map: key sections, branches, endings.
  - Identify required state variables (flags/items/stats) implied by the narrative.
  - Draft the first 5 scenes’ text + choices in the target schema.

- Agent C
  - Create UI style guide: palette, typography, layout frame, choice list styling.
  - Build the “DOS shell” mock (header, main text viewport, choice panel).
  - Specify asset constraints and propose 1–2 screen treatments.

- Agent D
  - Define state schema (versioned), condition/effect DSL, and save/load strategy.
  - Implement deterministic evaluator functions + unit tests.
  - Provide a sample content file that exercises conditions/effects.

---

## 8) Guardrails

- Keep `main` always playable (no long-lived broken branches).
- Prefer simple, testable primitives over complex frameworks.
- No unbounded content expansion: adapt the source faithfully; additions require a decision note.
- Visual polish is important but must not block end-to-end completion.
- Any cut content must be explicitly logged in `docs/cuts.md`.
- All engine/state changes require updating content validator + at least one test.
