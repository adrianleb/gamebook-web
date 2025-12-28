# QA Documentation

Quality Assurance guidelines, bug severity definitions, and test planning for the gamebook-web project.

## Bug Severity Rubric

### P0 - Critical (Blocker)

**Definition:** Game is unplayable or a core feature is completely broken. Blocks release.

**Examples:**
- Game crashes on startup
- Save/load completely non-functional
- Player cannot progress past a required node
- Ending is unreachable due to broken logic
- Data corruption or loss

**Response:** Must fix immediately. Stop other work until resolved.

**SLA:** Fix within 24 hours.

---

### P1 - High (Major)

**Definition:** Significant feature is broken or major user experience degradation. Blocks release.

**Examples:**
- Inventory system partially broken (items not usable)
- Incorrect branching logic (wrong destination on choice)
- Save file compatibility broken between versions
- UI renders incorrectly, obscuring critical information
- Audio plays when it shouldn't (or doesn't play when it should)

**Response:** Prioritize in current sprint. Fix before release.

**SLA:** Fix within 1 week.

---

### P2 - Medium (Minor)

**Definition:** Feature works but has issues. Does not block release but should be fixed.

**Examples:**
- Typos in game text
- Minor visual glitches that don't affect gameplay
- Non-critical audio timing issues
- Keyboard shortcut doesn't work (but alternative exists)
- Slow performance in non-critical paths

**Response:** Schedule for next sprint.

**SLA:** Fix within 2 weeks.

---

### P3 - Low (Cosmetic/Enhancement)

**Definition:** Polish issues or nice-to-have improvements.

**Examples:**
- Pixel alignment issues
- Animation could be smoother
- Suggested UX improvements
- Documentation gaps

**Response:** Backlog. Fix if time permits.

**SLA:** No deadline.

---

## Bug Report Template

When filing a bug, use this format:

```markdown
## Bug Title
[Clear, concise description of the issue]

## Severity
P0 / P1 / P2 / P3

## Environment
- Browser: [e.g., Chrome 120, Firefox 121]
- OS: [e.g., Windows 11, macOS 14]
- Build/Commit: [e.g., abc1234]

## Steps to Reproduce
1. [First step]
2. [Second step]
3. [...]

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens]

## Evidence
[Screenshots, console errors, video if applicable]

## Regression?
Yes / No / Unknown
[If yes, last known working build/commit]

## Additional Context
[Any other relevant information]
```

---

## Test Types

### 1. Playthrough Tests (Manual)

Complete gameplay sessions verifying end-to-end functionality.

**Categories:**
- **Golden Path**: The "happy path" through the game - most common/intended route to each ending
- **Edge Path**: Unusual but valid paths - testing boundary conditions and rare branches
- **Exhaustive Path**: Systematic coverage of all nodes and choices

**Status:** *Playthrough scripts pending STORY.md node index completion*

---

### 2. Regression Tests

Verify that previously working functionality still works after changes.

**Triggers:**
- Before each release
- After any engine/system change
- After content changes that modify branching logic

**Scope:**
- Save/load functionality
- All 5 endings reachable
- Inventory operations (add, remove, use)
- Flag state persistence
- UI keyboard navigation

---

### 3. Integration Tests

Verify system components work together correctly.

**Areas:**
- Content loader + Engine
- State management + Save system
- UI + Game state
- Audio triggers + Game events

---

### 4. Content Validation Tests

Verify content integrity and completeness.

**Checks:**
- No orphan nodes (unreachable content)
- No dead ends (nodes with no exits except endings)
- All items referenced exist
- All flags referenced are set somewhere
- All conditions are satisfiable

---

## Playthrough Scripts

> **Note:** Detailed playthrough scripts will be added once STORY.md is complete with node index and branching logic documentation. See [Issue #6](https://github.com/adrianleb/gamebook-web/issues/6) for STORY.md progress.

### Golden Path Template

For each of the 5 endings, document:

```markdown
## Ending [N]: [Ending Name]

### Prerequisites
- Required items: [list]
- Required flags: [list]
- Faction requirements: [if applicable]

### Critical Path (Shortest Route)
1. Start -> Node [X]
2. Choose: "[choice text]" -> Node [Y]
3. ...
4. Ending reached

### Verification Checklist
- [ ] Path is completable from fresh start
- [ ] All prerequisite items obtainable
- [ ] No blocking conditions encountered
- [ ] Ending text displays correctly
- [ ] Credits roll after ending
```

### Edge Path Template

```markdown
## Edge Case: [Description]

### Scenario
[What unusual path or condition is being tested]

### Steps
1. [Steps to reach the edge case]

### Expected Result
[What should happen]

### Why This Matters
[What bug this would catch]
```

---

## Content Coverage Targets

### Node Coverage

| Metric | Target | Current |
|--------|--------|---------|
| Total nodes tested | 100% | TBD |
| Act 1 nodes (45) | 100% | TBD |
| Act 2 nodes (64) | 100% | TBD |
| Act 3 nodes (56) | 100% | TBD |

### Ending Coverage

| Ending | Tested | Last Verified |
|--------|--------|---------------|
| Ending 1 | [ ] | - |
| Ending 2 | [ ] | - |
| Ending 3 | [ ] | - |
| Ending 4 | [ ] | - |
| Ending 5 | [ ] | - |

### Path Coverage

| Metric | Target | Current |
|--------|--------|---------|
| Golden paths verified | 5/5 | 0/5 |
| Edge cases documented | 10+ | TBD |
| Regression suite size | 20+ cases | TBD |

---

## Release Validation Checklist

Before any release:

### P0/P1 Verification
- [ ] No open P0 bugs
- [ ] No open P1 bugs (or explicit exception documented)

### Playthrough Verification
- [ ] At least one complete playthrough per ending
- [ ] Golden path scripts pass
- [ ] No new dead ends introduced

### Regression Verification
- [ ] Save/load works across all slots
- [ ] Existing saves still load correctly
- [ ] All UI navigation functional
- [ ] Audio plays correctly

### Content Verification
- [ ] Content validator passes with no errors
- [ ] No orphan nodes detected
- [ ] All items and flags valid

---

## Test Environment

### Supported Browsers (Target)
- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)

### Test Data
- Fresh game state (new game)
- Pre-populated saves for each act
- Edge case saves (corrupted, old version, etc.)

---

*This document is maintained by Agent F (QA Lead). Updates require PR review.*
