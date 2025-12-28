/**
 * Title Screen
 *
 * Main menu with NEW GAME, LOAD GAME, OPTIONS, CREDITS
 * Per UI.md specification with ASCII art title and keyboard navigation.
 */

import { createScreen, createDivider, BoxChars } from '../components/Screen';
import { getKeyboardHandler, createMenuNavigation, type KeyHandler } from '../input/KeyboardHandler';

export interface TitleScreenOptions {
  onNewGame: () => void;
  onLoadGame: () => void;
  onOptions: () => void;
  onCredits: () => void;
}

export interface TitleScreen {
  element: HTMLElement;
  destroy: () => void;
}

// ASCII art title (simplified from UI.md spec)
const TITLE_ART = [
  '  ██████╗  █████╗ ███╗   ███╗███████╗██████╗  ██████╗  ██████╗ ██╗  ██╗',
  ' ██╔════╝ ██╔══██╗████╗ ████║██╔════╝██╔══██╗██╔═══██╗██╔═══██╗██║ ██╔╝',
  ' ██║  ███╗███████║██╔████╔██║█████╗  ██████╔╝██║   ██║██║   ██║█████╔╝ ',
  ' ██║   ██║██╔══██║██║╚██╔╝██║██╔══╝  ██╔══██╗██║   ██║██║   ██║██╔═██╗ ',
  ' ╚██████╔╝██║  ██║██║ ╚═╝ ██║███████╗██████╔╝╚██████╔╝╚██████╔╝██║  ██╗',
  '  ╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝╚═════╝  ╚═════╝  ╚═════╝ ╚═╝  ╚═╝',
];

const MENU_ITEMS = [
  { id: 'new-game', label: 'NEW GAME' },
  { id: 'load-game', label: 'LOAD GAME' },
  { id: 'options', label: 'OPTIONS' },
  { id: 'credits', label: 'CREDITS' },
];

export function createTitleScreen(options: TitleScreenOptions): TitleScreen {
  let selectedIndex = 0;
  let unsubscribe: (() => void) | null = null;

  // Create screen container
  const screen = createScreen({
    showBorder: true,
    borderStyle: 'double',
    ariaLabel: 'Title Screen - Main Menu',
  });

  // Build content
  const content = document.createElement('div');
  content.className = 'title-content';
  Object.assign(content.style, {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: '1.2em 1ch',
  });

  // Title art section
  const titleSection = document.createElement('div');
  titleSection.className = 'title-art';
  titleSection.setAttribute('role', 'banner');
  titleSection.setAttribute('aria-label', 'GAMEBOOK');
  Object.assign(titleSection.style, {
    textAlign: 'center',
    color: 'var(--color-header, #FFFF55)',
    marginTop: '1.2em',
    marginBottom: '1.2em',
  });

  // Add ASCII art lines
  for (const line of TITLE_ART) {
    const artLine = document.createElement('div');
    artLine.textContent = line;
    artLine.style.fontSize = '0.6em';
    artLine.style.lineHeight = '1.2';
    artLine.style.whiteSpace = 'pre';
    titleSection.appendChild(artLine);
  }

  content.appendChild(titleSection);

  // Divider
  const divider = createDivider('double');
  content.appendChild(divider);

  // Menu section
  const menuSection = document.createElement('nav');
  menuSection.className = 'title-menu';
  menuSection.setAttribute('role', 'menu');
  menuSection.setAttribute('aria-label', 'Main Menu');
  Object.assign(menuSection.style, {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: '2.4em',
    gap: '0.6em',
  });

  // Create menu items
  const menuElements: HTMLElement[] = [];
  for (let i = 0; i < MENU_ITEMS.length; i++) {
    const item = MENU_ITEMS[i];
    const menuItem = document.createElement('div');
    menuItem.id = `menu-${item.id}`;
    menuItem.className = 'menu-item';
    menuItem.setAttribute('role', 'menuitem');
    menuItem.setAttribute('tabindex', i === 0 ? '0' : '-1');
    menuItem.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    Object.assign(menuItem.style, {
      padding: '0 2ch',
      cursor: 'pointer',
      transition: 'color 0.1s',
    });
    updateMenuItem(menuItem, item.label, i === selectedIndex);
    menuElements.push(menuItem);
    menuSection.appendChild(menuItem);
  }

  content.appendChild(menuSection);

  // Spacer
  const spacer = document.createElement('div');
  spacer.style.flex = '1';
  content.appendChild(spacer);

  // Prompt at bottom
  const prompt = document.createElement('div');
  prompt.className = 'title-prompt';
  prompt.setAttribute('role', 'status');
  prompt.textContent = 'Press ENTER to select';
  Object.assign(prompt.style, {
    textAlign: 'center',
    color: 'var(--color-text-secondary, #AAAAAA)',
    marginBottom: '1.2em',
  });
  content.appendChild(prompt);

  screen.appendChild(content);

  // Helper to update menu item appearance
  function updateMenuItem(el: HTMLElement, label: string, isSelected: boolean): void {
    const marker = isSelected ? '\u25BA ' : '  '; // ► or spaces
    el.textContent = marker + label;
    el.style.color = isSelected
      ? 'var(--color-selection-bg, #55FF55)'
      : 'var(--color-text-primary, #FFFFFF)';
    el.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    el.setAttribute('tabindex', isSelected ? '0' : '-1');
  }

  // Update visual selection
  function updateSelection(newIndex: number): void {
    for (let i = 0; i < menuElements.length; i++) {
      updateMenuItem(menuElements[i], MENU_ITEMS[i].label, i === newIndex);
    }
    selectedIndex = newIndex;
    // Announce for screen readers
    const selectedItem = MENU_ITEMS[newIndex];
    announceSelection(selectedItem.label);
  }

  // Screen reader announcement
  function announceSelection(label: string): void {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.className = 'sr-only';
    announcement.textContent = `${label} selected`;
    screen.appendChild(announcement);
    setTimeout(() => announcement.remove(), 1000);
  }

  // Handle menu selection
  function handleConfirm(index: number): void {
    const item = MENU_ITEMS[index];
    switch (item.id) {
      case 'new-game':
        options.onNewGame();
        break;
      case 'load-game':
        options.onLoadGame();
        break;
      case 'options':
        options.onOptions();
        break;
      case 'credits':
        options.onCredits();
        break;
    }
  }

  // Set up keyboard navigation
  const keyboard = getKeyboardHandler();
  const navHandler: KeyHandler = createMenuNavigation({
    getSelectedIndex: () => selectedIndex,
    setSelectedIndex: updateSelection,
    getItemCount: () => MENU_ITEMS.length,
    onConfirm: handleConfirm,
  });
  unsubscribe = keyboard.onAny(navHandler);

  // Mouse/touch support
  for (let i = 0; i < menuElements.length; i++) {
    const el = menuElements[i];
    el.addEventListener('mouseenter', () => updateSelection(i));
    el.addEventListener('click', () => handleConfirm(i));
  }

  // Return screen interface
  return {
    element: screen,
    destroy: () => {
      if (unsubscribe) {
        unsubscribe();
      }
      screen.remove();
    },
  };
}
