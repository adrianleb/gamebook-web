/**
 * Main entry point for gamebook-web.
 *
 * This file bootstraps the game application, wiring the GameEngine
 * to the UI components for a complete gameplay experience.
 */

import {
  createTitleScreen,
  createGameScreen,
  createOptionsScreen,
  createCreditsScreen,
  createPauseScreen,
  createInventoryScreen,
  createSaveScreen,
  createLoadScreen,
  createEndingScreen,
  type TitleScreen,
  type GameScreen,
  type OptionsScreen,
  type CreditsScreen,
  type PauseScreen,
  type InventoryScreen,
  type SaveScreen,
  type LoadScreen,
  type EndingScreen,
  type InventoryItem,
  type SaveSlotData,
  type LoadSlotData,
  type EndingType,
} from './ui';

import {
  GameEngine,
  createContentLoader,
  createSaveManager,
  type ContentLoader,
  type SaveManager,
  type GameState,
  type Node,
} from './engine';

import { AudioManager, SFX_IDS, MUSIC_IDS } from './audio';

// =============================================================================
// Global State
// =============================================================================

type Screen = 'title' | 'game' | 'save' | 'load';

let currentScreen: TitleScreen | GameScreen | SaveScreen | LoadScreen | null = null;
let pauseOverlay: PauseScreen | null = null;
let optionsOverlay: OptionsScreen | null = null;
let creditsOverlay: CreditsScreen | null = null;
let inventoryOverlay: InventoryScreen | null = null;
let endingOverlay: EndingScreen | null = null;

// Engine components (initialized on first load)
let contentLoader: ContentLoader | null = null;
let gameEngine: GameEngine | null = null;
let saveManager: SaveManager | null = null;
let audioManager: AudioManager | null = null;

// Playtime tracking
let gameStartTime: number = 0;
let totalPlaytime: number = 0;

const app = document.getElementById('app');

// =============================================================================
// Content Loading
// =============================================================================

/**
 * Loads all game content from JSON files.
 * Returns a merged ContentLoader with all acts combined.
 */
async function loadGameContent(): Promise<ContentLoader> {
  const loader = createContentLoader();

  // Load act1-sample.json as the main content source
  // The content files are served from /src/content/ in dev mode
  // and from /content/ in production build
  const contentUrls = [
    './src/content/act1-sample.json',
    './src/content/act2-sample.json',
    './src/content/act3-sample.json',
  ];

  // Try to load content - in production the paths may differ
  let loaded = false;

  // Try development paths first - load ALL acts (don't break after first)
  for (const url of contentUrls) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const json = await response.text();
        if (!loaded) {
          loader.loadFromString(json); // First file: full load with validation
        } else {
          loader.mergeFromString(json); // Subsequent files: merge without clearing
        }
        loaded = true;
        // Continue loading remaining acts - don't break!
      }
    } catch {
      // Try next path
    }
  }

  // If not loaded, try production paths with base URL
  if (!loaded) {
    // Use Vite's BASE_URL to handle GitHub Pages deployment path (/gamebook-web/)
    const baseUrl = import.meta.env.BASE_URL || '/';
    const prodUrls = [
      `${baseUrl}content/act1-sample.json`,
      `${baseUrl}content/act2-sample.json`,
      `${baseUrl}content/act3-sample.json`,
    ];
    for (const url of prodUrls) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const json = await response.text();
          if (!loaded) {
            loader.loadFromString(json); // First file: full load with validation
          } else {
            loader.mergeFromString(json); // Subsequent files: merge without clearing
          }
          loaded = true;
          // Continue loading remaining acts - don't break!
        }
      } catch {
        // Try next path
      }
    }
  }

  if (!loaded) {
    throw new Error('Failed to load game content. Ensure content files are available.');
  }

  return loader;
}

/**
 * Initializes the game engine and related components.
 */
async function initializeEngine(): Promise<void> {
  if (gameEngine) return; // Already initialized

  contentLoader = await loadGameContent();

  gameEngine = new GameEngine({
    contentLoader,
    onStateChange: handleStateChange,
    onPhaseChange: (phase) => {
      console.log('[Engine] Phase:', phase);
    },
    onEvent: (event) => {
      console.log('[Engine] Event:', event.type, event.data);

      // Play SFX and music based on events
      if (audioManager) {
        switch (event.type) {
          case 'game_started':
            audioManager.play(SFX_IDS.MENU_SELECT);
            // Start exploration music for gameplay
            audioManager.play(MUSIC_IDS.EXPLORATION, { loop: true });
            break;
          case 'node_entered':
            audioManager.play(SFX_IDS.PAGE_TURN);
            break;
          case 'game_ended': {
            // Play ending sound based on type
            const data = event.data as { tags?: string[] } | undefined;
            if (data?.tags?.includes('victory')) {
              audioManager.play(SFX_IDS.VICTORY);
            } else if (data?.tags?.includes('defeat')) {
              audioManager.play(SFX_IDS.GAME_OVER);
            }
            break;
          }
        }
      }

      // Trigger autosave on node transitions
      if (event.type === 'node_entered' && saveManager && gameEngine) {
        const state = gameEngine.getGameState();
        if (state) {
          saveManager.onNodeTransition(state);
        }
      }
    },
    onError: (error) => {
      console.error('[Engine] Error:', error);
    },
  });

  saveManager = createSaveManager({
    getNode: (nodeId) => contentLoader!.getNode(nodeId),
    getPlaytime: () => totalPlaytime + (Date.now() - gameStartTime),
  });

  // Initialize audio
  audioManager = AudioManager.getInstance();
  try {
    await audioManager.init();
  } catch (err) {
    console.warn('[Audio] Failed to initialize audio:', err);
  }
}

// =============================================================================
// State Change Handler
// =============================================================================

/**
 * Handles game state changes from the engine.
 */
function handleStateChange(state: GameState): void {
  if (!gameEngine || !contentLoader) return;

  const node = contentLoader.getNode(state.currentNodeId);

  // Check for ending (no choices available)
  if (node.choices.length === 0) {
    showEndingScreen(node, state);
    return;
  }

  // Update game screen with new state
  if (currentScreen && 'update' in currentScreen) {
    const gameScreen = currentScreen as GameScreen;
    const availableChoices = gameEngine.getAvailableChoices();

    gameScreen.update({
      chapterTitle: node.title,
      content: node.body,
      choices: availableChoices.map(c => ({
        id: c.id,
        text: c.text,
      })),
      hp: {
        current: state.stats.health ?? 100,
        max: state.stats.maxHealth ?? 100,
      },
      gold: state.stats.gold ?? 0,
      statusItems: buildStatusItems(state),
    });
  }
}

/**
 * Builds status items for the game screen status bar.
 */
function buildStatusItems(state: GameState): string[] {
  const items: string[] = [];

  // Faction standings
  if (state.factions.factionA !== undefined && state.factions.factionA !== 50) {
    items.push(`Alliance: ${state.factions.factionA}`);
  }
  if (state.factions.factionB !== undefined && state.factions.factionB !== 50) {
    items.push(`Conclave: ${state.factions.factionB}`);
  }
  if (state.factions.factionC !== undefined && state.factions.factionC !== 50) {
    items.push(`Circle: ${state.factions.factionC}`);
  }

  // Item count
  const itemCount = state.inventory.reduce((sum, e) => sum + e.quantity, 0);
  if (itemCount > 0) {
    items.push(`Items: ${itemCount}`);
  }

  return items;
}

// =============================================================================
// Screen Management
// =============================================================================

/**
 * Shows a screen by type.
 */
function showScreen(screen: Screen): void {
  if (!app) return;

  // Destroy previous screen
  if (currentScreen) {
    currentScreen.destroy();
    currentScreen = null;
  }

  // Close any overlays
  closePauseOverlay();
  closeInventoryOverlay();
  closeEndingOverlay();

  switch (screen) {
    case 'title':
      showTitleScreen();
      break;
    case 'game':
      showGameScreen();
      break;
    case 'save':
      showSaveScreen();
      break;
    case 'load':
      showLoadScreen();
      break;
  }
}

/**
 * Shows the title screen.
 */
function showTitleScreen(): void {
  if (!app) return;

  // Reset playtime tracking when returning to title
  gameStartTime = 0;
  totalPlaytime = 0;

  // Play title music
  if (audioManager) {
    audioManager.play(MUSIC_IDS.TITLE, { loop: true });
  }

  currentScreen = createTitleScreen({
    onNewGame: async () => {
      try {
        await initializeEngine();
        gameStartTime = Date.now();
        gameEngine!.startNewGame();
        showScreen('game');
      } catch (err) {
        console.error('Failed to start new game:', err);
        alert('Failed to load game content. Please refresh and try again.');
      }
    },
    onLoadGame: async () => {
      try {
        await initializeEngine();
        showScreen('load');
      } catch (err) {
        console.error('Failed to initialize for load:', err);
        alert('Failed to load game content. Please refresh and try again.');
      }
    },
    onOptions: () => {
      showOptionsOverlay();
    },
    onCredits: () => {
      showCreditsOverlay();
    },
  });

  app.appendChild(currentScreen.element);
  currentScreen.element.focus();
}

/**
 * Shows the game screen.
 */
function showGameScreen(): void {
  if (!app || !gameEngine || !contentLoader) return;

  const state = gameEngine.getGameState();
  if (!state) return;

  const node = contentLoader.getNode(state.currentNodeId);
  const availableChoices = gameEngine.getAvailableChoices();

  currentScreen = createGameScreen(
    {
      chapterTitle: node.title,
      content: node.body,
      choices: availableChoices.map(c => ({
        id: c.id,
        text: c.text,
      })),
      hp: {
        current: state.stats.health ?? 100,
        max: state.stats.maxHealth ?? 100,
      },
      gold: state.stats.gold ?? 0,
      statusItems: buildStatusItems(state),
    },
    {
      onChoiceSelect: (choiceId) => {
        // Play choice select SFX
        if (audioManager) {
          audioManager.play(SFX_IDS.MENU_SELECT);
        }

        try {
          gameEngine!.makeChoice(choiceId);
        } catch (err) {
          console.error('Failed to make choice:', err);
        }
      },
      onInventory: () => {
        showInventoryOverlay();
      },
      onPause: () => {
        showPauseOverlay();
      },
    }
  );

  app.appendChild(currentScreen.element);
  currentScreen.element.focus();
}

/**
 * Shows the save screen.
 */
function showSaveScreen(): void {
  if (!app || !saveManager) return;

  const slots = buildSaveSlotData();

  currentScreen = createSaveScreen(slots, {
    onSave: (slot) => {
      if (!saveManager || !gameEngine) return;

      const state = gameEngine.getGameState();
      if (!state) return;

      try {
        saveManager.saveGame(state, slot);
        if (audioManager) {
          audioManager.play(SFX_IDS.SAVE);
        }
        // Return to game after save
        showScreen('game');
      } catch (err) {
        console.error('Failed to save game:', err);
        alert('Failed to save game. Storage may be full.');
      }
    },
    onCancel: () => {
      showScreen('game');
    },
  });

  app.appendChild(currentScreen.element);
  currentScreen.element.focus();
}

/**
 * Shows the load screen.
 */
function showLoadScreen(): void {
  if (!app || !saveManager) return;

  const slots = buildLoadSlotData();

  currentScreen = createLoadScreen(slots, {
    onLoad: (slot) => {
      if (!saveManager || !gameEngine) return;

      try {
        const state = saveManager.loadGame(slot);

        // Get playtime from save for tracking
        const saves = saveManager.listSaves();
        const saveFile = saves[slot];
        if (saveFile) {
          totalPlaytime = saveFile.playtime || 0;
        }
        gameStartTime = Date.now();

        gameEngine.loadGameState(state);

        if (audioManager) {
          audioManager.play(SFX_IDS.LOAD);
        }

        showScreen('game');
      } catch (err) {
        console.error('Failed to load game:', err);
        alert('Failed to load save. The save file may be corrupted.');
      }
    },
    onDelete: (slot) => {
      if (!saveManager) return;
      saveManager.deleteSave(slot);

      // Refresh the load screen
      if (currentScreen && 'update' in currentScreen) {
        (currentScreen as LoadScreen).update(buildLoadSlotData());
      }
    },
    onCancel: () => {
      // Return to title or game depending on state
      if (gameEngine && gameEngine.getGameState()) {
        showScreen('game');
      } else {
        showScreen('title');
      }
    },
  });

  app.appendChild(currentScreen.element);
  currentScreen.element.focus();
}

// =============================================================================
// Overlay Management
// =============================================================================

/**
 * Shows the pause menu overlay.
 */
function showPauseOverlay(): void {
  if (!app || pauseOverlay) return;

  if (audioManager) {
    audioManager.play(SFX_IDS.INVENTORY_OPEN);
  }

  pauseOverlay = createPauseScreen({
    onResume: () => {
      closePauseOverlay();
    },
    onSave: () => {
      closePauseOverlay();
      showScreen('save');
    },
    onLoad: () => {
      closePauseOverlay();
      showScreen('load');
    },
    onOptions: () => {
      closePauseOverlay();
      showOptionsOverlay();
    },
    onQuit: () => {
      closePauseOverlay();
      // Reset engine state
      if (gameEngine) {
        gameEngine.reset();
      }
      showScreen('title');
    },
  });

  app.appendChild(pauseOverlay.element);
}

/**
 * Closes the pause overlay.
 */
function closePauseOverlay(): void {
  if (pauseOverlay) {
    if (audioManager) {
      audioManager.play(SFX_IDS.INVENTORY_CLOSE);
    }
    pauseOverlay.destroy();
    pauseOverlay = null;
    currentScreen?.element.focus();
  }
}

/**
 * Shows the options overlay.
 */
function showOptionsOverlay(): void {
  if (!app || optionsOverlay) return;

  optionsOverlay = createOptionsScreen({
    onBack: () => {
      if (optionsOverlay) {
        optionsOverlay.destroy();
        optionsOverlay = null;
        currentScreen?.element.focus();
      }
    },
    onTestSound: () => {
      if (audioManager) {
        audioManager.play(SFX_IDS.MENU_SELECT);
      }
    },
  });

  app.appendChild(optionsOverlay.element);
}

/**
 * Shows the credits overlay.
 */
function showCreditsOverlay(): void {
  if (!app || creditsOverlay) return;

  creditsOverlay = createCreditsScreen({
    onClose: () => {
      if (creditsOverlay) {
        creditsOverlay.destroy();
        creditsOverlay = null;
        currentScreen?.element.focus();
      }
    },
  });

  app.appendChild(creditsOverlay.element);
}

/**
 * Shows the inventory overlay.
 */
function showInventoryOverlay(): void {
  if (!app || inventoryOverlay || !gameEngine || !contentLoader) return;

  const state = gameEngine.getGameState();
  if (!state) return;

  if (audioManager) {
    audioManager.play(SFX_IDS.INVENTORY_OPEN);
  }

  const items = buildInventoryItems(state);

  inventoryOverlay = createInventoryScreen(items, {
    onClose: () => {
      closeInventoryOverlay();
    },
    onUseItem: (itemId) => {
      if (!gameEngine) return;

      try {
        gameEngine.useItem(itemId);

        if (audioManager) {
          audioManager.play(SFX_IDS.ITEM_USE);
        }

        // Update inventory display
        const newState = gameEngine.getGameState();
        if (newState && inventoryOverlay) {
          inventoryOverlay.update(buildInventoryItems(newState));
        }
      } catch (err) {
        console.error('Failed to use item:', err);
      }
    },
    onDropItem: (itemId) => {
      // For now, dropping is not implemented
      // Could add a drop effect to the engine
      console.log('Drop item:', itemId);
    },
  });

  app.appendChild(inventoryOverlay.element);
}

/**
 * Closes the inventory overlay.
 */
function closeInventoryOverlay(): void {
  if (inventoryOverlay) {
    if (audioManager) {
      audioManager.play(SFX_IDS.INVENTORY_CLOSE);
    }
    inventoryOverlay.destroy();
    inventoryOverlay = null;
    currentScreen?.element.focus();
  }
}

/**
 * Shows the ending screen.
 */
function showEndingScreen(node: Node, state: GameState): void {
  if (!app || endingOverlay) return;

  // Determine ending type from node tags
  let endingType: EndingType = 'neutral';
  if (node.tags?.includes('victory')) {
    endingType = 'victory';
  } else if (node.tags?.includes('defeat') || node.tags?.includes('death')) {
    endingType = 'defeat';
  }

  // Build ending title and play ending music
  let title = 'THE END';
  if (endingType === 'victory') {
    title = 'VICTORY';
    if (audioManager) {
      audioManager.play(MUSIC_IDS.VICTORY, { loop: false });
    }
  } else if (endingType === 'defeat') {
    title = 'DEFEAT';
    if (audioManager) {
      audioManager.play(MUSIC_IDS.DEFEAT, { loop: false });
    }
  }

  // Calculate playtime
  const playtimeMs = totalPlaytime + (Date.now() - gameStartTime);
  const playtimeSeconds = Math.floor(playtimeMs / 1000);

  // Determine act number
  let actsCompleted = 1;
  if (node.id.startsWith('ACT3')) {
    actsCompleted = 3;
  } else if (node.id.startsWith('ACT2')) {
    actsCompleted = 2;
  }

  endingOverlay = createEndingScreen(
    {
      type: endingType,
      title,
      message: node.body,
      subtitle: node.title,
      stats: {
        chaptersCompleted: actsCompleted,
        totalChapters: 3,
        itemsCollected: state.inventory.reduce((sum, e) => sum + e.quantity, 0),
        choicesMade: state.choicesMade.length,
        playtimeSeconds,
      },
    },
    {
      onViewCredits: () => {
        closeEndingOverlay();
        showCreditsOverlay();
      },
      onReturnToTitle: () => {
        closeEndingOverlay();
        if (gameEngine) {
          gameEngine.reset();
        }
        showScreen('title');
      },
    }
  );

  app.appendChild(endingOverlay.element);
}

/**
 * Closes the ending overlay.
 */
function closeEndingOverlay(): void {
  if (endingOverlay) {
    endingOverlay.destroy();
    endingOverlay = null;
  }
}

// =============================================================================
// Data Building Helpers
// =============================================================================

/**
 * Builds inventory item data for the inventory screen.
 */
function buildInventoryItems(state: GameState): InventoryItem[] {
  if (!contentLoader) return [];

  return state.inventory.map(entry => {
    const item = contentLoader!.getItem(entry.itemId);
    const result: InventoryItem = {
      itemId: entry.itemId,
      quantity: entry.quantity,
      name: item.name,
      description: item.description,
      usable: item.usable,
      consumable: item.consumable,
    };
    if (item.tags) {
      result.tags = item.tags;
    }
    return result;
  });
}

/**
 * Builds save slot data for the save screen.
 */
function buildSaveSlotData(): SaveSlotData[] {
  if (!saveManager) return [];

  const saves = saveManager.listSaves();
  const slots: SaveSlotData[] = [];

  // Slots 1-3 (skip slot 0 which is autosave)
  for (let i = 1; i <= 3; i++) {
    const save = saves[i];
    if (save) {
      slots.push({
        slot: i,
        isEmpty: false,
        name: save.name,
        nodeTitle: save.preview.nodeTitle,
        actNumber: save.preview.actNumber,
        choiceCount: save.preview.choiceCount,
        timestamp: save.timestamp,
        playtime: save.playtime,
      });
    } else {
      slots.push({
        slot: i,
        isEmpty: true,
      });
    }
  }

  return slots;
}

/**
 * Builds load slot data for the load screen.
 */
function buildLoadSlotData(): LoadSlotData[] {
  if (!saveManager) return [];

  const saves = saveManager.listSaves();
  const slots: LoadSlotData[] = [];

  // Include autosave (slot 0) and manual saves (slots 1-3)
  for (let i = 0; i <= 3; i++) {
    const save = saves[i];
    if (save) {
      slots.push({
        slot: i,
        isEmpty: false,
        name: i === 0 ? 'AUTOSAVE' : save.name,
        nodeTitle: save.preview.nodeTitle,
        actNumber: save.preview.actNumber,
        choiceCount: save.preview.choiceCount,
        timestamp: save.timestamp,
        playtime: save.playtime,
      });
    } else {
      slots.push({
        slot: i,
        isEmpty: true,
      });
    }
  }

  return slots;
}

// =============================================================================
// App Initialization
// =============================================================================

if (app) {
  showScreen('title');
}
