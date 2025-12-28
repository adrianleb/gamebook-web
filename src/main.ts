/**
 * Main entry point for gamebook-web.
 *
 * This file bootstraps the game application.
 * Engine, UI, and content modules will be initialized here.
 */

import {
  createTitleScreen,
  createGameScreen,
  type TitleScreen,
  type GameScreen,
} from './ui';

type Screen = 'title' | 'game';

let currentScreen: TitleScreen | GameScreen | null = null;

const app = document.getElementById('app');

if (app) {
  // Initialize with title screen
  showScreen('title');
}

function showScreen(screen: Screen): void {
  if (!app) return;

  // Destroy previous screen
  if (currentScreen) {
    currentScreen.destroy();
    currentScreen = null;
  }

  switch (screen) {
    case 'title':
      currentScreen = createTitleScreen({
        onNewGame: () => showScreen('game'),
        onLoadGame: () => {
          // TODO: Implement load game
          console.log('Load Game - not yet implemented');
        },
        onOptions: () => {
          // TODO: Implement options
          console.log('Options - not yet implemented');
        },
        onCredits: () => {
          // TODO: Implement credits
          console.log('Credits - not yet implemented');
        },
      });
      break;

    case 'game':
      currentScreen = createGameScreen(
        {
          chapterTitle: 'Chapter 1: The Beginning',
          content: `You stand at the edge of the ancient forest. The trees tower above you, their gnarled branches blocking out most of the moonlight. A narrow path winds into the darkness ahead.

From somewhere deep within, you hear the sound of running water. The air is thick with the scent of moss and decay.

Your torch flickers in the breeze.`,
          choices: [
            { id: 'path', text: 'Follow the path into the forest' },
            { id: 'search', text: 'Search the area for another way' },
            { id: 'torch', text: 'Light a new torch before proceeding' },
          ],
          hp: { current: 80, max: 100 },
          gold: 45,
          statusItems: ['Torch: 3 remaining'],
        },
        {
          onChoiceSelect: (choiceId) => {
            console.log('Choice selected:', choiceId);
            // TODO: Handle choice with game engine
          },
          onInventory: () => {
            console.log('Inventory opened');
            // TODO: Show inventory overlay
          },
          onPause: () => {
            showScreen('title');
          },
        }
      );
      break;
  }

  if (currentScreen) {
    app.appendChild(currentScreen.element);
    currentScreen.element.focus();
  }
}
