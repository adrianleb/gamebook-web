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

export {
  createConfirmDialog,
  type ConfirmDialog,
  type ConfirmDialogOptions,
} from './components/ConfirmDialog';

export {
  createItemInspect,
  type ItemInspect,
  type InspectableItem,
  type ItemInspectOptions,
  type ItemInspectCallbacks,
} from './components/ItemInspect';

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

export {
  createPauseScreen,
  type PauseScreen,
  type PauseScreenCallbacks,
  type PauseAction,
} from './screens/PauseScreen';

export {
  createSaveScreen,
  type SaveScreen,
  type SaveSlotData,
  type SaveScreenCallbacks,
} from './screens/SaveScreen';

export {
  createLoadScreen,
  type LoadScreen,
  type LoadSlotData,
  type LoadScreenCallbacks,
} from './screens/LoadScreen';

export {
  createInventoryScreen,
  type InventoryScreen,
  type InventoryItem,
  type InventoryScreenCallbacks,
} from './screens/InventoryScreen';

export {
  createOptionsScreen,
  type OptionsScreen,
  type OptionsScreenCallbacks,
} from './screens/OptionsScreen';

// Input
export {
  KeyboardHandler,
  getKeyboardHandler,
  createMenuNavigation,
  type KeyAction,
  type KeyEvent,
  type KeyHandler,
} from './input/KeyboardHandler';
