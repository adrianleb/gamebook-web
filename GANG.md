# GANG.md — Coordination Contract

## 1. Definition of the Deliverable (what we’re building, definition of done)

### Product
A fully playable, browser-based RPG/adventure game that adapts the referenced gamebook (https://github.com/adrianleb/gamebook) into an end-to-end experience.

### Experience Goals
- Old-school DOS vibe (EGA/VGA-like palette, chunky UI, bitmap-ish typography, terminal-ish framing).
- Adventure-game feel inspired by LucasArts era: scene-based navigation, conversational/choice-driven progression, inventory/flags, readable feedback.
- Runs entirely in-browser (desktop-first), no installs.

### Functional Scope (must-have)
- Start-to-finish playthrough: player can begin at the intro and reach one or more endings with no dead blockers.
- Gamebook content faithfully represented: nodes/sections, choices, conditions, consequences.
- Core systems:
  - State: stats, inventory, flags, visited nodes, current location.
  - Choice gating: requirements (items/flags/stats), skill checks (if present/derived), branching outcomes.
  - Save/Load: localStorage (at minimum 3 slots), plus “restart”.
  - UI: main viewport, text log, choices list, optional scene art panel, status panel.
  - Accessibility basics: keyboard navigation for choices, readable contrast.

### Definition of Done
- ✅ Game can be played from start to a valid ending in a clean browser session.
- ✅ No critical console errors; build passes CI.
- ✅ Save/Load works reliably across refresh.
- ✅ Content pipeline exists (data-driven), not hard-coded per scene.
- ✅ QA checklist in section 6 fully satisfied.

Non-goals (unless explicitly approved): multiplayer, 3D, procedural generation, voice acting, external accounts, large asset pipelines.

---

## 2. Collaboration Rules (decision ownership by agent name, decision protocol)

### Decision Ownership
- Agent A owns integration decisions: final architecture, repo structure, build tooling, merge decisions.
- Agent B owns game content mapping decisions: how the gamebook is translated into nodes/choices/flags, and correctness vs. source.
- Agent C owns visual/interaction decisions: DOS vibe UI, typography, layout, input feel.
- Agent D owns quality decisions: test plan, acceptance checks, regression prevention.

### Decision Protocol
1. Propose: any agent can propose via a short “Decision Note” in PR description (context → options → recommendation → impact).
2. Review: at least one non-author agent reviews; Agent A is required for merges.
3. Resolve: if conflict:
   - Prefer data-driven and minimal custom logic.
   - Prefer player-unblockable flow over perfect simulation.
   - If still stuck: Agent A makes the final call after reading both sides.

### Working Agreements
- No large PRs without a short plan.
- “Broken main is forbidden”: all merges must pass build and smoke playthrough.
- Every new feature must include at least one validation note (how to test quickly).

---

## 3. Workflow: Phases and Cycles (macro phases, micro cycle format)

### Macro Phases
1. **Discovery & Spec Lock**
   - Confirm what the gamebook contains (format, nodes, rules).
   - Draft a minimal rules model and content schema.

2. **Vertical Slice**
   - Implement engine + UI + one small chapter path end-to-end.
   - Save/Load enabled.

3. **Full Content Implementation**
   - Convert all gamebook sections into structured data.
   - Hook conditions, outcomes, endings.

4. **Polish & QA**
   - UI refinement (DOS vibe), performance, accessibility.
   - Fix dead ends, add guardrails, finalize.

### Micro Cycle (repeat weekly or per milestone)
- Plan (½ day): choose 3–6 tickets, define acceptance.
- Build (2–4 days): small PRs.
- Integrate (½ day): merge, resolve conflicts.
- Validate (½–1 day): smoke playthrough + checklist.

---

## 4. Content Format & Conventions (domain-specific)

### Canonical Game Model (data-driven)
- **Node**: a playable section/screen.
  - `id`: stable string.
  - `title`: optional.
  - `text`: array of paragraphs (support inline markup).
  - `art`: optional reference.
  - `effects`: list of state changes applied on entry.
  - `choices`: list of player options.

- **Choice**:
  - `id`, `label`
  - `requirements`: flags/items/stat thresholds.
  - `checks`: optional RNG/skill check (seeded).
  - `effects`: applied on select.
  - `next`: next node id (or `ending`).

- **State**:
  - `stats`: numeric
  - `inventory`: set
  - `flags`: set
  - `history`: visited nodes, choice ids

### Conventions
- Content-first: adding content should not require code edits.
- Deterministic randomness: seeded per save for reproducibility.
- Text markup: minimal and explicit (e.g., `**bold**`, `_italics_`, `[item:SOMETHING]`).
- All node ids are immutable once published; redirect via aliases if needed.

---

## 5. Repo Layout

- `/README.md` — run/dev/build instructions, gameplay summary
- `/GANG.md` — this contract
- `/docs/`
  - `/docs/design.md` — UI + systems spec (Agent A owns)
  - `/docs/content-spec.md` — node/choice schema + examples (Agent B owns)
  - `/docs/qa.md` — test plan + playthrough checklist (Agent D owns)
- `/src/`
  - `/src/engine/` — state machine, rules, save/load
  - `/src/content/` — compiled game content JSON (or TS objects)
  - `/src/ui/` — components, layout, styling
  - `/src/assets/` — fonts, palette, images, sounds
  - `/src/index.*` — app entry
- `/scripts/` — content build/validation scripts
- `/tests/` — unit tests + content validation tests

---

## 6. QA & Validation Checklist

### Build/Runtime
- [ ] `npm test` (or equivalent) passes
- [ ] `npm run build` produces a runnable bundle
- [ ] No blocking console errors during play

### Gameplay
- [ ] Can start new game and reach at least one ending
- [ ] No nodes with zero choices unless they are endings
- [ ] No broken links (`next` points to missing node)
- [ ] Requirements are satisfiable somewhere (no impossible gates)
- [ ] Save/Load restores exact state (stats/inventory/flags/location)
- [ ] Back/refresh resilience: refresh keeps game via autosave or explicit load

### UI/UX
- [ ] Keyboard navigation across choices
- [ ] Readable text, consistent spacing, stable layout
- [ ] DOS vibe implemented (palette/typography/windowing)

### Content Validation
- [ ] Schema validation for content files
- [ ] Lint for unused flags/items, unreachable nodes report

---

## 7. Kickoff Tasks (initial work per agent)

### Agent A
- Create project skeleton, build tooling, routing/state scaffolding.
- Define initial engine interfaces (Node/Choice/State) aligned with content spec.

### Agent B
- Inspect the referenced gamebook repo format.
- Draft `/docs/content-spec.md` and produce a small converted sample (5–10 nodes) to power the vertical slice.

### Agent C
- Draft UI style guide (palette, font approach, window chrome, layout).
- Implement a first-pass UI shell compatible with engine (text log + choices + status panel).

### Agent D
- Create `/docs/qa.md` and initial automated checks: schema validation + “no missing node ids”.
- Define smoke playthrough steps for the vertical slice.

---

## 8. Guardrails (scope control, quality bar)

- Don’t add new mechanics unless the gamebook requires them.
- Prefer simple, robust systems over feature breadth (e.g., one solid save system).
- Content conversion should be scripted/validated; avoid manual error-prone linking.
- No large binary assets unless they directly improve readability or vibe.
- Every PR must include:
  - What changed
  - How to test in <2 minutes
  - Any content/schema impacts
