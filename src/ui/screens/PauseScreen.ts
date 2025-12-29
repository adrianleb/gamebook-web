/**
 * Pause Screen
 *
 * Overlay menu accessible via Esc from GameScreen.
 * Options: Resume, Save, Load, Options, Quit to Title
 *
 * Per UI.md specification with keyboard navigation.
 */

import { BoxChars } from '../components/Screen';
import { createConfirmDialog } from '../components/ConfirmDialog';
import { getKeyboardHandler, createMenuNavigation, type KeyHandler } from '../input/KeyboardHandler';

export type PauseAction = 'resume' | 'save' | 'load' | 'options' | 'quit';

export interface PauseScreenCallbacks {
  onResume: () => void;
  onSave: () => void;
  onLoad: () => void;
  onOptions: () => void;
  onQuit: () => void;
}

export interface PauseScreen {
  element: HTMLElement;
  destroy: () => void;
}

const MENU_ITEMS: { id: PauseAction; label: string }[] = [
  { id: 'resume', label: 'RESUME' },
  { id: 'save', label: 'SAVE GAME' },
  { id: 'load', label: 'LOAD GAME' },
  { id: 'options', label: 'OPTIONS' },
  { id: 'quit', label: 'QUIT TO TITLE' },
];

/**
 * Creates a pause menu overlay
 */
export function createPauseScreen(callbacks: PauseScreenCallbacks): PauseScreen {
  let selectedIndex = 0;
  const unsubscribers: (() => void)[] = [];

  // Create overlay backdrop
  const overlay = document.createElement('div');
  overlay.className = 'pause-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Pause Menu');
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '100',
  });

  // Create menu box
  const menuWidth = 40;
  const menuBox = document.createElement('div');
  menuBox.className = 'pause-menu';
  Object.assign(menuBox.style, {
    width: `${menuWidth}ch`,
    backgroundColor: 'var(--color-bg-primary, #000)',
    color: 'var(--color-text-primary, #fff)',
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: 'var(--font-size-base, 16px)',
    lineHeight: '1.2',
  });

  // Title bar (double border)
  const innerWidth = menuWidth - 2;
  const title = ' PAUSED ';
  const leftPad = Math.floor((innerWidth - title.length) / 2);
  const rightPad = innerWidth - leftPad - title.length;

  const titleBar = document.createElement('div');
  titleBar.innerHTML = `${BoxChars.dblTopLeft}${BoxChars.dblHorizontal.repeat(leftPad)}<span style="color: var(--color-header, #FFFF55)">${title}</span>${BoxChars.dblHorizontal.repeat(rightPad)}${BoxChars.dblTopRight}`;
  titleBar.style.color = 'var(--color-border, #AA5500)';
  menuBox.appendChild(titleBar);

  // Menu items area
  const menuArea = document.createElement('nav');
  menuArea.className = 'pause-menu-items';
  menuArea.setAttribute('role', 'menu');
  menuArea.setAttribute('aria-label', 'Pause menu options');
  Object.assign(menuArea.style, {
    padding: '1em 0',
  });

  const menuElements: HTMLElement[] = [];

  function renderMenu(): void {
    menuArea.innerHTML = '';
    menuElements.length = 0;

    for (let i = 0; i < MENU_ITEMS.length; i++) {
      const item = MENU_ITEMS[i];
      if (!item) continue;

      const itemEl = document.createElement('div');
      itemEl.className = 'pause-menu-item';
      itemEl.setAttribute('role', 'menuitem');
      itemEl.setAttribute('tabindex', i === selectedIndex ? '0' : '-1');
      itemEl.setAttribute('data-action', item.id);
      Object.assign(itemEl.style, {
        padding: '0.3em 2ch',
        cursor: 'pointer',
      });

      updateMenuItem(itemEl, item.label, i === selectedIndex);
      menuElements.push(itemEl);
      menuArea.appendChild(itemEl);

      // Mouse support
      const index = i;
      itemEl.addEventListener('mouseenter', () => updateSelection(index));
      itemEl.addEventListener('click', () => handleConfirm(index));
    }

    // Side borders
    for (const el of menuElements) {
      const content = el.innerHTML;
      el.innerHTML = `<span style="color: var(--color-border, #AA5500)">${BoxChars.dblVertical}</span> ${content}`;
    }
  }

  function updateMenuItem(el: HTMLElement, label: string, isSelected: boolean): void {
    const marker = isSelected ? '\u25BA' : ' '; // ►
    const color = isSelected ? 'var(--color-selection, #55FF55)' : 'var(--color-text-primary, #fff)';
    // Center the text
    const padding = Math.floor((innerWidth - 4 - label.length) / 2);
    el.innerHTML = `<span style="color: ${color}">${marker} ${' '.repeat(padding)}${label}</span>`;
    el.style.backgroundColor = isSelected ? 'rgba(85, 255, 85, 0.1)' : 'transparent';
  }

  function updateSelection(newIndex: number): void {
    for (let i = 0; i < menuElements.length; i++) {
      const el = menuElements[i];
      const item = MENU_ITEMS[i];
      if (el && item) {
        updateMenuItem(el, item.label, i === newIndex);
        el.setAttribute('tabindex', i === newIndex ? '0' : '-1');
      }
    }
    selectedIndex = newIndex;
  }

  async function handleConfirm(index: number): Promise<void> {
    const menuItem = MENU_ITEMS[index];
    if (!menuItem) return;
    const action = menuItem.id;

    switch (action) {
      case 'resume':
        callbacks.onResume();
        break;
      case 'save':
        callbacks.onSave();
        break;
      case 'load':
        callbacks.onLoad();
        break;
      case 'options':
        callbacks.onOptions();
        break;
      case 'quit':
        // Show confirmation dialog for quit
        const confirmDialog = createConfirmDialog({
          title: 'QUIT TO TITLE',
          message: 'Are you sure you want to quit?\nUnsaved progress will be lost.',
          confirmText: 'QUIT',
          cancelText: 'CANCEL',
          type: 'warning',
        });
        const confirmed = await confirmDialog.show();
        if (confirmed) {
          callbacks.onQuit();
        }
        break;
    }
  }

  renderMenu();
  menuBox.appendChild(menuArea);

  // Bottom border
  const bottomBorder = document.createElement('div');
  bottomBorder.textContent = BoxChars.dblBottomLeft + BoxChars.dblHorizontal.repeat(innerWidth) + BoxChars.dblBottomRight;
  bottomBorder.style.color = 'var(--color-border, #AA5500)';
  menuBox.appendChild(bottomBorder);

  // Help text
  const helpText = document.createElement('div');
  helpText.className = 'pause-help';
  helpText.setAttribute('role', 'note');
  Object.assign(helpText.style, {
    textAlign: 'center',
    marginTop: '1em',
    color: 'var(--color-text-secondary, #AAAAAA)',
    fontSize: '0.9em',
  });
  helpText.textContent = '\u2191\u2193 Navigate    Enter: Select    Esc: Resume';
  menuBox.appendChild(helpText);

  overlay.appendChild(menuBox);

  // Keyboard navigation
  const keyboard = getKeyboardHandler();

  const navHandler: KeyHandler = createMenuNavigation({
    getSelectedIndex: () => selectedIndex,
    setSelectedIndex: updateSelection,
    getItemCount: () => MENU_ITEMS.length,
    onConfirm: handleConfirm,
    onCancel: () => callbacks.onResume(),
  });

  unsubscribers.push(keyboard.onAny(navHandler));

  // Focus management
  overlay.tabIndex = -1;
  setTimeout(() => overlay.focus(), 0);

  return {
    element: overlay,
    destroy: () => {
      for (const unsub of unsubscribers) {
        unsub();
      }
      overlay.remove();
    },
  };
}
