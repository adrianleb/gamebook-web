/**
 * Keyboard Handler
 *
 * Manages keyboard input for DOS-style navigation.
 * Supports arrow keys, WASD, Enter, Esc, number hotkeys.
 */

export type KeyAction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'confirm'
  | 'cancel'
  | 'inventory'
  | 'use'
  | 'drop'
  | 'scrollUp'
  | 'scrollDown'
  | 'scrollTop'
  | 'scrollBottom'
  | 'mute'
  | 'volumeUp'
  | 'volumeDown'
  | 'number';

export interface KeyEvent {
  action: KeyAction;
  number?: number; // For number hotkeys 1-9
  originalEvent: KeyboardEvent;
}

export type KeyHandler = (event: KeyEvent) => void;

interface KeyMapping {
  action: KeyAction;
  number?: number;
}

const KEY_MAPPINGS: Record<string, KeyMapping> = {
  // Navigation - Arrow keys
  'ArrowUp': { action: 'up' },
  'ArrowDown': { action: 'down' },
  'ArrowLeft': { action: 'left' },
  'ArrowRight': { action: 'right' },
  // Navigation - WASD
  'w': { action: 'up' },
  'W': { action: 'up' },
  's': { action: 'down' },
  'S': { action: 'down' },
  'a': { action: 'left' },
  'A': { action: 'left' },
  'd': { action: 'right' },
  'D': { action: 'right' },
  // Confirm/Cancel
  'Enter': { action: 'confirm' },
  ' ': { action: 'confirm' },
  'Escape': { action: 'cancel' },
  // Inventory
  'i': { action: 'inventory' },
  'I': { action: 'inventory' },
  'Tab': { action: 'inventory' },
  // Item actions
  'u': { action: 'use' },
  'U': { action: 'use' },
  'x': { action: 'drop' },
  'X': { action: 'drop' },
  // Scrolling
  'PageUp': { action: 'scrollUp' },
  'PageDown': { action: 'scrollDown' },
  'Home': { action: 'scrollTop' },
  'End': { action: 'scrollBottom' },
  // Audio
  'm': { action: 'mute' },
  'M': { action: 'mute' },
  '+': { action: 'volumeUp' },
  '=': { action: 'volumeUp' },
  '-': { action: 'volumeDown' },
  // Number hotkeys
  '1': { action: 'number', number: 1 },
  '2': { action: 'number', number: 2 },
  '3': { action: 'number', number: 3 },
  '4': { action: 'number', number: 4 },
  '5': { action: 'number', number: 5 },
  '6': { action: 'number', number: 6 },
  '7': { action: 'number', number: 7 },
  '8': { action: 'number', number: 8 },
  '9': { action: 'number', number: 9 },
};

export class KeyboardHandler {
  private handlers: Map<string, KeyHandler[]> = new Map();
  private globalHandlers: KeyHandler[] = [];
  private enabled = true;
  private boundHandleKeyDown: (e: KeyboardEvent) => void;

  constructor() {
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
  }

  /**
   * Start listening for keyboard events
   */
  attach(target: HTMLElement | Document = document): void {
    target.addEventListener('keydown', this.boundHandleKeyDown);
  }

  /**
   * Stop listening for keyboard events
   */
  detach(target: HTMLElement | Document = document): void {
    target.removeEventListener('keydown', this.boundHandleKeyDown);
  }

  /**
   * Enable or disable keyboard handling
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Register a handler for a specific action
   */
  on(action: KeyAction, handler: KeyHandler): () => void {
    const handlers = this.handlers.get(action) || [];
    handlers.push(handler);
    this.handlers.set(action, handlers);

    // Return unsubscribe function
    return () => {
      const idx = handlers.indexOf(handler);
      if (idx !== -1) {
        handlers.splice(idx, 1);
      }
    };
  }

  /**
   * Register a global handler for all key events
   */
  onAny(handler: KeyHandler): () => void {
    this.globalHandlers.push(handler);
    return () => {
      const idx = this.globalHandlers.indexOf(handler);
      if (idx !== -1) {
        this.globalHandlers.splice(idx, 1);
      }
    };
  }

  /**
   * Remove all handlers for an action
   */
  off(action: KeyAction): void {
    this.handlers.delete(action);
  }

  /**
   * Clear all handlers
   */
  clear(): void {
    this.handlers.clear();
    this.globalHandlers = [];
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.enabled) return;

    // Don't intercept if user is in an input field
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    const mapping = KEY_MAPPINGS[e.key];
    if (!mapping) return;

    // Prevent default for game keys (except Tab which we want to handle but not block entirely)
    if (e.key !== 'Tab') {
      e.preventDefault();
    }

    const keyEvent: KeyEvent = {
      action: mapping.action,
      number: mapping.number,
      originalEvent: e,
    };

    // Call action-specific handlers
    const actionHandlers = this.handlers.get(mapping.action) || [];
    for (const handler of actionHandlers) {
      handler(keyEvent);
    }

    // Call global handlers
    for (const handler of this.globalHandlers) {
      handler(keyEvent);
    }
  }
}

// Singleton instance for global keyboard handling
let globalHandler: KeyboardHandler | null = null;

export function getKeyboardHandler(): KeyboardHandler {
  if (!globalHandler) {
    globalHandler = new KeyboardHandler();
    globalHandler.attach();
  }
  return globalHandler;
}

/**
 * Helper to create a menu navigation handler
 */
export function createMenuNavigation(options: {
  getSelectedIndex: () => number;
  setSelectedIndex: (index: number) => void;
  getItemCount: () => number;
  onConfirm: (index: number) => void;
  onCancel?: () => void;
}): KeyHandler {
  return (event: KeyEvent) => {
    const { action, number } = event;
    const currentIndex = options.getSelectedIndex();
    const itemCount = options.getItemCount();

    switch (action) {
      case 'up':
        if (currentIndex > 0) {
          options.setSelectedIndex(currentIndex - 1);
        } else {
          // Wrap to bottom
          options.setSelectedIndex(itemCount - 1);
        }
        break;

      case 'down':
        if (currentIndex < itemCount - 1) {
          options.setSelectedIndex(currentIndex + 1);
        } else {
          // Wrap to top
          options.setSelectedIndex(0);
        }
        break;

      case 'confirm':
        options.onConfirm(currentIndex);
        break;

      case 'cancel':
        if (options.onCancel) {
          options.onCancel();
        }
        break;

      case 'number':
        if (number && number >= 1 && number <= itemCount) {
          options.setSelectedIndex(number - 1);
          options.onConfirm(number - 1);
        }
        break;
    }
  };
}
