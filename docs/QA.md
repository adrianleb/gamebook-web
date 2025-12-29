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

**Status:** ✅ Playthrough scripts complete - see [Playthrough Scripts](#playthrough-scripts) section

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

> **Reference:** Node IDs and requirements from [STORY.md](./STORY.md)

### Golden Path 1: Victory (Faction-Aligned)

**Ending Node:** `ACT3_END_VICTORY`

#### Prerequisites
| Type | Requirement |
|------|-------------|
| Faction | Alignment ≥ 75 with chosen faction |
| Flags | `FACTION_LEADER_MET`, `FINAL_QUEST_ACCEPTED` |
| Items | Faction artifact (`ITEM_FACTION_A_ARTIFACT`, `ITEM_FACTION_B_ARTIFACT`, or `ITEM_FACTION_C_ARTIFACT`) |
| Allies | At least 2 faction-aligned allies alive |

#### Critical Path (Faction A Example)
| Step | Action | Node | Flags/Items Set |
|------|--------|------|-----------------|
| 1 | Start new game | `ACT1_START` | - |
| 2 | Proceed through introduction | `ACT1_FIRST_CHOICE` | - |
| 3 | **Choose Faction A** | `ACT1_FACTION_CHOICE` → `ACT1_FACTION_A_INTRO` | `FACTION_A_JOINED` |
| 4 | Recruit Marcus | `ACT1_ALLY_MARCUS` → `ACT1_MARCUS_JOIN` | `ALLY_MARCUS_ALIVE` |
| 5 | Complete Act 1 | `ACT1_ACT_END` | Faction locked |
| 6 | Meet faction leader | `ACT2_LEADER_AUDIENCE` | `FACTION_LEADER_MET` |
| 7 | Accept the quest | `ACT2_QUEST_DECISION` → `ACT2_ACCEPT_QUEST` | `FINAL_QUEST_ACCEPTED` |
| 8 | Claim Faction A artifact | `ACT2_ARTIFACT_A` | `ITEM_FACTION_A_ARTIFACT` |
| 9 | Save Elena | `ACT2_ALLY_ELENA` → `ACT2_ELENA_SAVED` | `ALLY_ELENA_ALIVE` |
| 10 | Complete Act 2 | `ACT2_ACT_END` | Alignment ≥75 |
| 11 | Reach final confrontation | `ACT3_FINAL_CONFRONTATION` | - |
| 12 | Victory ending | `ACT3_END_VICTORY` | **ENDING REACHED** |

#### Verification Checklist
- [ ] Faction alignment shows ≥75 before Act 3
- [ ] Both Marcus and Elena shown as alive in party
- [ ] Faction artifact visible in inventory
- [ ] Victory ending text displays correctly
- [ ] Credits roll after ending

---

### Golden Path 2: Sacrifice

**Ending Node:** `ACT3_END_SACRIFICE`

#### Prerequisites
| Type | Requirement |
|------|-------------|
| Flags | `SACRIFICE_PATH_UNLOCKED`, `LOVED_ONE_IN_DANGER` |
| Items | `ITEM_SACRED_AMULET` |
| Allies | At least 1 ally alive to save |
| Choice | Select sacrifice option at final confrontation |

#### Critical Path
| Step | Action | Node | Flags/Items Set |
|------|--------|------|-----------------|
| 1 | Start new game | `ACT1_START` | - |
| 2 | **Visit shrine (critical!)** | `ACT1_SHRINE` | `ITEM_SACRED_AMULET` |
| 3 | Choose any faction | `ACT1_FACTION_CHOICE` | `FACTION_X_JOINED` |
| 4 | Recruit at least one ally | `ACT1_ALLY_MARCUS` | `ALLY_MARCUS_ALIVE` |
| 5 | Complete Act 1 | `ACT1_ACT_END` | - |
| 6 | **Receive prophecy** | `ACT2_PROPHECY` | `SACRIFICE_PATH_UNLOCKED` |
| 7 | Complete Act 2 normally | `ACT2_ACT_END` | - |
| 8 | **Ally gets kidnapped** | `ACT3_KIDNAPPING` | `LOVED_ONE_IN_DANGER` |
| 9 | Reach final confrontation | `ACT3_FINAL_CONFRONTATION` | - |
| 10 | **Choose sacrifice option** | → `ACT3_END_SACRIFICE` | **ENDING REACHED** |

#### Verification Checklist
- [ ] Sacred Amulet obtained in Act 1
- [ ] `SACRIFICE_PATH_UNLOCKED` flag set after prophecy
- [ ] Kidnapping event triggers in Act 3
- [ ] Sacrifice option appears at final confrontation
- [ ] Sacrifice ending text displays correctly

---

### Golden Path 3: Betrayal

**Ending Node:** `ACT3_END_BETRAYAL`

#### Prerequisites
| Type | Requirement |
|------|-------------|
| Faction | Alignment < 25 with all factions OR `BETRAYER_PATH` flag |
| Flags | `SECRET_DEAL_MADE`, `ANTAGONIST_OFFER_ACCEPTED` |
| Items | `ITEM_DARK_PACT_SCROLL` |
| Allies | All allies either dead or betrayed |

#### Critical Path
| Step | Action | Node | Flags/Items Set |
|------|--------|------|-----------------|
| 1 | Start new game | `ACT1_START` | - |
| 2 | Choose any faction (will betray) | `ACT1_FACTION_CHOICE` | `FACTION_X_JOINED` |
| 3 | **Reject Marcus** (ally must die/leave) | `ACT1_ALLY_MARCUS` → `ACT1_MARCUS_LEAVE` | `ALLY_MARCUS_ALIVE` = false |
| 4 | Complete Act 1 | `ACT1_ACT_END` | - |
| 5 | **Embrace dark whispers** | `ACT2_TEMPTATION` → `ACT2_EMBRACE` | `BETRAYER_PATH` |
| 6 | **Make secret deal** | `ACT2_SECRET_DEAL` → `ACT2_DEAL_MADE` | `SECRET_DEAL_MADE`, `ITEM_DARK_PACT_SCROLL` |
| 7 | **Let Elena die** | `ACT2_ALLY_ELENA` → `ACT2_ELENA_LOST` | `ALLY_ELENA_ALIVE` = false |
| 8 | Complete Act 2 | `ACT2_ACT_END` | - |
| 9 | **Accept antagonist's offer** | `ACT3_FINAL_OFFER` → `ACT3_ACCEPT_OFFER` | `ANTAGONIST_OFFER_ACCEPTED` |
| 10 | Betrayal ending | `ACT3_END_BETRAYAL` | **ENDING REACHED** |

#### Verification Checklist
- [ ] Dark Pact Scroll in inventory
- [ ] No allies shown in party
- [ ] `BETRAYER_PATH` flag active
- [ ] `SECRET_DEAL_MADE` flag active
- [ ] Betrayal ending text displays correctly

---

### Golden Path 4: Neutral

**Ending Node:** `ACT3_END_NEUTRAL`

#### Prerequisites
| Type | Requirement |
|------|-------------|
| Faction | Alignment 25-50 with all factions |
| Flags | `NEUTRAL_PATH_AVAILABLE` (auto-set if no faction ≥50) |
| Items | None required |
| Allies | None required |

#### Critical Path
| Step | Action | Node | Flags/Items Set |
|------|--------|------|-----------------|
| 1 | Start new game | `ACT1_START` | - |
| 2 | Choose any faction | `ACT1_FACTION_CHOICE` | `FACTION_X_JOINED` |
| 3 | Complete Act 1 | `ACT1_ACT_END` | - |
| 4 | **Avoid major faction commitments** | Various | Keep all factions 25-50 |
| 5 | Refuse quest or complete minimally | `ACT2_QUEST_DECISION` → `ACT2_REFUSE_QUEST` | - |
| 6 | Complete Act 2 | `ACT2_ACT_END` | `NEUTRAL_PATH_AVAILABLE` auto-set |
| 7 | Reach final confrontation | `ACT3_FINAL_CONFRONTATION` | - |
| 8 | **Choose to walk away** | → `ACT3_END_NEUTRAL` | **ENDING REACHED** |

#### Verification Checklist
- [ ] All faction alignments between 25-50
- [ ] `NEUTRAL_PATH_AVAILABLE` flag is set
- [ ] Walk away option appears at final confrontation
- [ ] Neutral ending text displays correctly

---

### Golden Path 5: Death

**Ending Node:** `ACT3_END_DEATH`

#### Prerequisites
| Type | Requirement |
|------|-------------|
| Stats | Health reaches 0 during final battle |
| OR Flags | `DOOM_SEALED` (from critical failure) |
| Items | Missing required survival items |
| Allies | No allies available to rescue |

#### Critical Path (via DOOM_SEALED)
| Step | Action | Node | Flags/Items Set |
|------|--------|------|-----------------|
| 1 | Start new game | `ACT1_START` | - |
| 2 | **Skip survival kit** | Skip `ACT1_SUPPLIES` | No `ITEM_SURVIVAL_KIT` |
| 3 | Choose any faction | `ACT1_FACTION_CHOICE` | `FACTION_X_JOINED` |
| 4 | **Reject all allies** | Skip ally recruitment | No allies |
| 5 | Complete Act 1 | `ACT1_ACT_END` | - |
| 6 | Make poor choices in Act 2 | Various | Low faction standing |
| 7 | Complete Act 2 | `ACT2_ACT_END` | - |
| 8 | **Trigger critical failure** | `ACT3_CRITICAL_FAILURE` | `DOOM_SEALED` |
| 9 | Death ending | `ACT3_END_DEATH` | **ENDING REACHED** |

#### Verification Checklist
- [ ] No survival items in inventory
- [ ] No allies in party
- [ ] `DOOM_SEALED` flag triggers correctly OR health reaches 0
- [ ] Death/Game Over screen displays correctly

---

## Edge Path Test Cases

### Edge Case 1: Faction Switching Mid-Game

**Scenario:** Player attempts to change faction allegiance after initial choice.

**Steps:**
1. Choose Faction A in Act 1
2. In Act 2, take actions that lower Faction A standing below 25
3. Attempt to gain favor with Faction B (≥50)

**Expected Result:**
- `FACTION_A_JOINED` flag remains set
- New faction quests may unlock but Victory ending requires original faction
- A-aligned allies may leave (standing <25)

**Why This Matters:** Catches bugs in faction-locked content accessibility

---

### Edge Case 2: All Items Collected

**Scenario:** Player attempts to collect every available item.

**Steps:**
1. Visit `ACT1_SHRINE` → `ITEM_SACRED_AMULET`
2. Visit `ACT1_SUPPLIES` → `ITEM_SURVIVAL_KIT`
3. Visit `ACT1_EXPLORE_1` → `ITEM_MAP_FRAGMENT_1`
4. Complete `ACT2_ARTIFACT_A` → `ITEM_FACTION_A_ARTIFACT`
5. Complete `ACT2_SECRET_DEAL` → `ITEM_DARK_PACT_SCROLL`
6. Complete `ACT2_EXPLORE_2` → `ITEM_MAP_FRAGMENT_2`
7. Complete `ACT2_HEIST` → `ITEM_KEY_VAULT`

**Expected Result:**
- All 9 items visible in inventory
- No inventory overflow or corruption
- Conflicting items (faction artifacts + dark pact) coexist

**Why This Matters:** Catches inventory limit bugs and item conflict issues

---

### Edge Case 3: All Allies Recruited Then Lost

**Scenario:** Player recruits all allies then loses them.

**Steps:**
1. Recruit Marcus in Act 1
2. Save Elena in Act 2
3. Recruit Thorne in Act 2
4. Take actions causing all allies to die/leave

**Expected Result:**
- Ally flags correctly transition from true to false
- Endings requiring allies become unavailable
- Betrayal and Death endings remain available

**Why This Matters:** Catches ally state tracking bugs

---

### Edge Case 4: Rapid Save/Load During Critical Choice

**Scenario:** Player saves and loads repeatedly at `ACT3_FINAL_CONFRONTATION`.

**Steps:**
1. Reach `ACT3_FINAL_CONFRONTATION` with multiple ending paths available
2. Save game
3. Choose Ending 1, observe
4. Load, choose Ending 2, observe
5. Repeat for all available endings

**Expected Result:**
- Save state correctly restored each time
- All available endings reachable from same save
- No flag corruption between loads

**Why This Matters:** Catches save/load state corruption bugs

---

### Edge Case 5: Boundary Faction Values

**Scenario:** Test faction threshold boundaries (24, 25, 50, 74, 75).

**Steps:**
1. Manipulate faction values to exactly 24, then 25
2. Check if threshold-dependent content unlocks/locks correctly
3. Repeat for 50 and 75 boundaries

**Expected Result:**
- At 24: <25 effects apply (allies leave risk)
- At 25: 25-50 effects apply (neutral zone)
- At 74: Leader audience available, Victory not yet
- At 75: Victory ending unlocks

**Why This Matters:** Catches off-by-one errors in condition checks

---

### Edge Case 6: Map Fragment Unlocks

**Scenario:** Test that both map fragments unlock their respective hidden areas.

**Steps:**
1. Collect `ITEM_MAP_FRAGMENT_1` in Act 1
2. Verify `ACT2_HIDDEN_PATH` becomes accessible
3. Collect `ITEM_MAP_FRAGMENT_2` in Act 2
4. Verify `ACT3_SECRET_ENTRANCE` becomes accessible

**Expected Result:**
- Hidden paths only accessible with correct fragment
- UI indicates locked state without fragment
- No softlock if player skips fragments

**Why This Matters:** Catches item-gated content accessibility bugs

---

### Edge Case 7: Doom Sealed Override

**Scenario:** Test that `DOOM_SEALED` flag forces Death ending regardless of other conditions.

**Steps:**
1. Build toward Victory ending (high faction, all flags)
2. Trigger `ACT3_CRITICAL_FAILURE` to set `DOOM_SEALED`
3. Proceed to final confrontation

**Expected Result:**
- Victory path unavailable despite meeting requirements
- Death ending is forced
- Flag override is clearly communicated to player

**Why This Matters:** Catches flag priority/override bugs

---

### Edge Case 8: Skip All Optional Content

**Scenario:** Speed-run path avoiding all optional nodes.

**Steps:**
1. Skip shrine, supplies, exploration in Act 1
2. Skip optional ally recruitment
3. Skip hidden paths and vault in Act 2
4. Proceed directly to endings

**Expected Result:**
- Game completable without optional content
- Neutral or Death endings available (lacking items for others)
- No dead ends from missing optional content

**Why This Matters:** Catches required vs optional content misclassification

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

| Ending | Script Ready | Tested | Last Verified |
|--------|--------------|--------|---------------|
| Ending 1: Victory | ✅ | ✅ | 2025-12-29 |
| Ending 2: Sacrifice | ✅ | ✅ | 2025-12-29 |
| Ending 3: Betrayal | ✅ | ✅ | 2025-12-29 |
| Ending 4: Neutral | ✅ | ✅ | 2025-12-29 |
| Ending 5: Death | ✅ | ✅ | 2025-12-29 |

### Path Coverage

| Metric | Target | Current |
|--------|--------|---------|
| Golden paths documented | 5/5 | ✅ 5/5 |
| Golden paths verified | 5/5 | ✅ 5/5 |
| Edge cases documented | 10+ | ✅ 8 |
| Regression suite size | 20+ cases | ✅ 72 |

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
