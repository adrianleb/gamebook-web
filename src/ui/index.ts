/**
 * UI Module Exports
 *
 * DOS-style UI framework for gamebook-web
 */

// Styles
import './styles/dos-theme.css';

// Components
export {
  createScreen,
  createContentArea,
  createDivider,
  createStatusBar,
  createInputArea,
  BoxChars,
  type ScreenOptions,
  type ScreenSection,
} from './components/Screen';

// Screens
export {
  createTitleScreen,
  type TitleScreen,
  type TitleScreenOptions,
} from './screens/TitleScreen';

export {
  createGameScreen,
  type GameScreen,
  type GameScreenState,
  type GameScreenCallbacks,
  type Choice,
} from './screens/GameScreen';

// Input
export {
  KeyboardHandler,
  getKeyboardHandler,
  createMenuNavigation,
  type KeyAction,
  type KeyEvent,
  type KeyHandler,
} from './input/KeyboardHandler';
