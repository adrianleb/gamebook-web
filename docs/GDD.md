# Game Design Document (GDD)

## Vision

A browser-based, start-to-finish playable RPG/adventure game adapted from the [gamebook repository](https://github.com/adrianleb/gamebook), presented with an old-school DOS / LucasArts-style adventure aesthetic featuring chunky UI, pixel-style presentation, strong dialogue scenes, inventory interactions, and punchy SFX.

## Core Pillars

1. **Narrative Fidelity** - All book nodes/scenes are represented with choices and outcomes intact
2. **DOS-Era Presentation** - Keyboard-friendly, strong text/box UI, retro typography, sound cues
3. **Complete Game Loop** - Title → New Game → Gameplay → Save/Load → Ending → Credits
4. **No Dead Ends** - Every path leads somewhere; no missing content breaks playthrough
5. **Data-Driven Content** - Scenes, choices, and effects are declarative, not hardcoded

## Game Loop

```
┌─────────────────────────────────────────────────────────┐
│                      TITLE SCREEN                        │
│                   [New Game] [Load] [Options]            │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                      GAMEPLAY LOOP                       │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │ Display     │───▶│ Player      │───▶│ Apply       │  │
│  │ Scene       │    │ Choice      │    │ Effects     │  │
│  └─────────────┘    └─────────────┘    └─────────────┘  │
│         ▲                                    │          │
│         └────────────────────────────────────┘          │
│                                                         │
│  [Inventory] [Save/Load] [Menu]                         │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    ENDING / CREDITS                      │
└─────────────────────────────────────────────────────────┘
```

## Systems Overview

### State Management
- Player flags (boolean states tracking story progress)
- Inventory (items with IDs, quantities, and effects)
- Stats (if required by source material)
- Current node/scene position

### Save System
- 3 save slots + autosave
- Versioned format with migration support
- Stores complete player state

### Content System
- Node-based scene graph
- Declarative conditions and effects
- No embedded code in content files

### UI System
- Fixed grid layout with strong borders
- High-contrast palette
- Monospace/bitmap-style fonts
- Keyboard-first navigation (Arrow keys, Enter, Esc, 1-9 hotkeys)

### Audio System
- Short, punchy SFX for UI actions
- Optional background music
- Volume controls and mute option

## Acceptance Criteria Format

All features and tasks should define acceptance criteria using this format:

```markdown
### [Feature/Task Name]

**Given** [initial context/state]
**When** [action is performed]
**Then** [expected outcome]

**Verification:**
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3
```

### Example

```markdown
### Save Game Feature

**Given** the player is in the middle of gameplay
**When** they press the Save button and select a slot
**Then** the game state is persisted and can be restored later

**Verification:**
- [ ] Save button is accessible from pause menu
- [ ] 3 save slots are available
- [ ] Saved game shows timestamp and current scene
- [ ] Loading a save restores exact game state
- [ ] Save format is versioned for future migrations
```

## Milestones

### M1: Discovery & Specification
- [ ] Source gamebook structure audited
- [ ] Node/scene index produced
- [ ] GDD complete with all systems defined
- [ ] Story map with endings and dependencies documented
- [ ] Engine schema and save format specified
- [ ] UI screen flows defined
- [ ] Audio plan established
- [ ] QA test plan drafted

### M2: Foundation Build
- [ ] Engine skeleton implemented (load node → render → apply choice → next)
- [ ] Content loader functional
- [ ] Save/load system working
- [ ] Basic UI shell rendered
- [ ] Content validator running

### M3: Vertical Slice
- [ ] One complete chapter playable
- [ ] Inventory system functional
- [ ] Skill checks / combat (if needed) working
- [ ] Audio integrated
- [ ] Save/load tested in slice

### M4: Full Content Implementation
- [ ] All scenes/nodes implemented
- [ ] All items and flags working
- [ ] All endings reachable
- [ ] Combat/checks complete

### M5: Polish & Balancing
- [ ] UI polish complete
- [ ] Pacing reviewed
- [ ] Difficulty balanced
- [ ] All art/SFX final
- [ ] Performance optimized

### M6: QA & Release
- [ ] Full playthroughs completed
- [ ] All P0/P1 bugs fixed
- [ ] Final build produced
- [ ] Release notes written
- [ ] Deployment verified

---

*This document is maintained by Agent A (Integrator). Updates require PR review.*
