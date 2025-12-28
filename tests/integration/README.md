# Integration Tests

This directory contains integration tests that verify system components work together correctly.

## Test Categories

Per `/docs/QA.md`, integration tests cover:

### 1. Content Loader + Engine
- Content loading and parsing
- Node traversal and choice evaluation
- Condition/effect processing

### 2. State Management + Save System
- Save serialization/deserialization
- State persistence across sessions
- Save file migration

### 3. UI + Game State
- UI state synchronization
- Keyboard navigation
- Choice selection and feedback

### 4. Audio Triggers + Game Events
- Event emission and handling
- Audio playback triggers
- Volume/mute controls

## File Structure

```
integration/
├── README.md           # This file
├── content-engine.test.ts    # Content loader + engine tests
├── state-save.test.ts        # State + save system tests
├── ui-state.test.ts          # UI + game state tests
└── audio-events.test.ts      # Audio + events tests
```

## Running Tests

```bash
# Run all integration tests
npm run test -- tests/integration/

# Run with coverage
npm run test -- tests/integration/ --coverage

# Run specific integration test
npm run test -- tests/integration/content-engine.test.ts
```

## Writing Integration Tests

Integration tests should:
1. Test interactions between 2+ system components
2. Use realistic game state and content
3. Verify end-to-end behavior, not just unit behavior
4. Be independent and not rely on execution order

Example:
```typescript
describe('Content + Engine Integration', () => {
  it('should load nodes and process choices correctly', () => {
    const content = loadTestContent();
    const engine = new GameEngine(content);
    const state = engine.start();

    // Verify initial state
    expect(state.currentNodeId).toBe('ACT1_START');

    // Make a choice
    const newState = engine.processChoice(state, 'choice_1');

    // Verify state transition
    expect(newState.currentNodeId).toBe('ACT1_NEXT_NODE');
  });
});
```
