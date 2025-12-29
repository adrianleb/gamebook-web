# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- README.md with project overview, setup instructions, and gameplay guide
- CHANGELOG.md documenting milestone history

### In Progress
- M6.1: Full playthrough validation
- M6.2: Bug fixes and final polish
- M6.3: Documentation and release notes

## [0.1.0] - 2025-12-29 (M5 Complete)

### Milestone 5: Polish & Balancing

#### M5.1: Narrative Pacing Review
- Analyzed 176 nodes across 3 acts for pacing issues
- Verified emotional beat distribution follows proper 3-act structure
- Act 1: 25% exposition, Act 2: 55% development, Act 3: 50% tension+climax
- No critical pacing issues identified

#### M5.6: Final Content Validation
- Validated all 5 endings reachable via golden path tests
- Confirmed 176 nodes meet narrative standards
- All cross-act navigation verified functional

### Milestone 4: Full Content Implementation

#### M4.1: Act 1 Content Expansion (PR #72)
- Expanded Act 1 from 8 to 45 nodes
- Implemented all faction introduction paths
- Added optional exploration branches
- Completed ally recruitment storylines

#### M4.2: Act 2 Content Expansion (PR #81)
- Expanded Act 2 from 14 to 80 nodes (exceeds 64 target)
- Implemented artifact quest lines for each faction
- Added heist sequence and betrayal path
- Completed ally storyline branches

#### M4.3: Act 3 Content Expansion (PR #87)
- Expanded Act 3 from 17 to 56 nodes
- Implemented all 5 ending variations
- Added final confrontation branches
- Completed doom paths

#### Additional M4 Features
- SaveManager with slots, checksums, migration, autosave (PR #79)
- Ending Screen with styling for all 5 endings (PR #66)
- Options Screen with audio controls (PR #58)
- Credits Screen (PR #73)
- AudioManager + Settings wiring (PR #74)
- Edge path tests - 116 new tests (PR #77)

**Final State**: 176 total nodes (40 Act1 + 80 Act2 + 56 Act3), 320 tests passing

### Milestone 3: Vertical Slice

#### Core Engine (PR #42)
- Engine skeleton: load node, render, apply choice, next
- Content loader functional
- All 8 condition types (flag, stat, item, faction, visited, not, and, or)
- All 9 effect types (setFlag, clearFlag, modifyStat, setStat, addItem, removeItem, modifyFaction, setFaction, triggerEvent)

#### Content (PRs #31, #44, #51)
- Act 1 sample content: 8 core nodes
- Act 2 sample content: 14 core nodes
- Act 3 sample content: 17 core nodes with all 5 endings

#### UI (PRs #30, #41, #49)
- DOS-style UI shell with high-contrast theme
- Pause, Save, Load screens
- Inventory screen
- Keyboard navigation (Arrow keys, Enter, Escape, 1-9 hotkeys)

#### Audio (PRs #32, #40, #46, #54)
- Audio manager implementation
- 17+ UI sound effects
- 5 background music tracks
- Volume controls

#### Testing (PRs #33, #38)
- Content validator
- Test infrastructure
- 90 tests passing

### Milestone 2: Foundation Build

- Engine skeleton implemented
- Content loader functional
- Save/load system working
- Basic UI shell rendered
- Content validator running

### Milestone 1: Discovery & Specification

- Source gamebook structure audited
- Node/scene index produced (STORY.md)
- Game Design Document completed (GDD.md)
- Engine schema specified (ENGINE.md)
- UI screen flows defined (UI.md)
- Audio plan established (AUDIO.md)
- QA test plan drafted (QA.md)

## Development Notes

### Multi-Agent Development

This project was developed using a collaborative multi-agent workflow:

- **Agent A**: Integration and release coordination
- **Agent B**: Narrative content (176 nodes, 5 endings)
- **Agent C**: Engine architecture and save system
- **Agent D**: UI/UX implementation
- **Agent E**: Audio pipeline and assets
- **Agent F**: Quality assurance and testing

### Statistics

| Metric | Value |
|--------|-------|
| Total Story Nodes | 176 |
| Endings | 5 |
| Items | 9 |
| Flags | 16+ |
| Tests | 320 |
| Sound Effects | 17+ |
| Music Tracks | 5 |

---

*For detailed milestone acceptance criteria, see [docs/GDD.md](docs/GDD.md).*
