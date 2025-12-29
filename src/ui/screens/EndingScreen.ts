/**
 * Ending Screen
 *
 * Displays game conclusion (Victory/Defeat/Neutral) with stats and navigation.
 * Shown when player reaches an ending node per UI.md screen flow.
 *
 * Layout:
 * - Header with ending type (styled appropriately)
 * - Ending message/description
 * - Game statistics summary
 * - Navigation: [View Credits] and [Return to Title]
 */

import { BoxChars } from '../components/Screen';
import { getKeyboardHandler, type KeyHandler, type KeyEvent } from '../input/KeyboardHandler';

/**
 * Ending type determines visual styling and messaging
 */
export type EndingType = 'victory' | 'defeat' | 'neutral';

/**
 * Game statistics to display on ending screen
 */
export interface EndingStats {
  /** Number of chapters/acts completed */
  chaptersCompleted: number;
  /** Total chapters in the game */
  totalChapters: number;
  /** Number of items collected */
  itemsCollected: number;
  /** Total choices made during playthrough */
  choicesMade: number;
  /** Play time in seconds */
  playtimeSeconds: number;
}

/**
 * Configuration for the ending screen
 */
export interface EndingScreenOptions {
  /** Type of ending (victory, defeat, neutral) */
  type: EndingType;
  /** Title shown in the header (e.g., "VICTORY", "DEFEAT", "THE END") */
  title: string;
  /** Main ending message/description */
  message: string;
  /** Optional subtitle or flavor text */
  subtitle?: string;
  /** Game statistics to display */
  stats?: EndingStats;
}

/**
 * Callbacks for ending screen navigation
 */
export interface EndingScreenCallbacks {
  /** Called when player selects "View Credits" */
  onViewCredits: () => void;
  /** Called when player selects "Return to Title" */
  onReturnToTitle: () => void;
}

/**
 * Ending screen instance
 */
export interface EndingScreen {
  /** Root DOM element */
  element: HTMLElement;
  /** Clean up and remove the screen */
  destroy: () => void;
}

/**
 * Menu options for navigation
 */
type MenuOption = 'credits' | 'title';

const MENU_ITEMS: { id: MenuOption; label: string }[] = [
  { id: 'credits', label: 'View Credits' },
  { id: 'title', label: 'Return to Title' },
];

/**
 * Get color based on ending type
 */
function getEndingColor(type: EndingType): string {
  switch (type) {
    case 'victory':
      return 'var(--color-light-green, #55FF55)';
    case 'defeat':
      return 'var(--color-light-red, #FF5555)';
    case 'neutral':
      return 'var(--color-light-cyan, #55FFFF)';
  }
}

/**
 * Get header style based on ending type
 */
function getEndingHeaderStyle(type: EndingType): string {
  switch (type) {
    case 'victory':
      return 'color: var(--color-light-green, #55FF55); text-shadow: 0 0 10px rgba(85, 255, 85, 0.5);';
    case 'defeat':
      return 'color: var(--color-light-red, #FF5555); text-shadow: 0 0 10px rgba(255, 85, 85, 0.5);';
    case 'neutral':
      return 'color: var(--color-light-cyan, #55FFFF); text-shadow: 0 0 10px rgba(85, 255, 255, 0.5);';
  }
}

/**
 * Format playtime from seconds to human-readable string
 */
function formatPlaytime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

/**
 * Creates an ending screen overlay
 */
export function createEndingScreen(
  options: EndingScreenOptions,
  callbacks: EndingScreenCallbacks
): EndingScreen {
  let selectedIndex = 0;
  const unsubscribers: (() => void)[] = [];

  // Create overlay backdrop
  const overlay = document.createElement('div');
  overlay.className = 'ending-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', `${options.title} - Game Ending`);
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '100',
  });

  // Create ending box (80 chars wide to match terminal)
  const menuWidth = 78;
  const menuBox = document.createElement('div');
  menuBox.className = 'ending-screen';
  Object.assign(menuBox.style, {
    width: `${menuWidth}ch`,
    backgroundColor: 'var(--color-bg-primary, #000)',
    color: 'var(--color-text-primary, #fff)',
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: 'var(--font-size-base, 16px)',
    lineHeight: '1.4',
  });

  const innerWidth = menuWidth - 2;
  const endingColor = getEndingColor(options.type);

  // Top border (double)
  const topBorder = document.createElement('div');
  topBorder.style.color = endingColor;
  topBorder.textContent = BoxChars.dblTopLeft + BoxChars.dblHorizontal.repeat(innerWidth) + BoxChars.dblTopRight;
  menuBox.appendChild(topBorder);

  // Empty line for spacing
  const spacer1 = document.createElement('div');
  spacer1.innerHTML = `<span style="color: ${endingColor}">${BoxChars.dblVertical}</span>${' '.repeat(innerWidth)}<span style="color: ${endingColor}">${BoxChars.dblVertical}</span>`;
  menuBox.appendChild(spacer1);

  // Title (centered, styled by ending type)
  const titleEl = document.createElement('div');
  const titlePadding = Math.floor((innerWidth - options.title.length) / 2);
  titleEl.innerHTML = `<span style="color: ${endingColor}">${BoxChars.dblVertical}</span>${' '.repeat(titlePadding)}<span style="${getEndingHeaderStyle(options.type)}; font-weight: bold;">${options.title}</span>${' '.repeat(innerWidth - titlePadding - options.title.length)}<span style="color: ${endingColor}">${BoxChars.dblVertical}</span>`;
  menuBox.appendChild(titleEl);

  // Subtitle if provided
  if (options.subtitle) {
    const subtitleEl = document.createElement('div');
    const subPadding = Math.floor((innerWidth - options.subtitle.length) / 2);
    subtitleEl.innerHTML = `<span style="color: ${endingColor}">${BoxChars.dblVertical}</span>${' '.repeat(subPadding)}<span style="color: var(--color-text-secondary, #AAAAAA); font-style: italic;">${options.subtitle}</span>${' '.repeat(innerWidth - subPadding - options.subtitle.length)}<span style="color: ${endingColor}">${BoxChars.dblVertical}</span>`;
    menuBox.appendChild(subtitleEl);
  }

  // Spacer
  const spacer2 = document.createElement('div');
  spacer2.innerHTML = `<span style="color: ${endingColor}">${BoxChars.dblVertical}</span>${' '.repeat(innerWidth)}<span style="color: ${endingColor}">${BoxChars.dblVertical}</span>`;
  menuBox.appendChild(spacer2);

  // Divider
  const divider1 = document.createElement('div');
  divider1.innerHTML = `<span style="color: ${endingColor}">${BoxChars.dblLeftT}</span><span style="color: var(--color-border, #AA5500)">${BoxChars.horizontal.repeat(innerWidth)}</span><span style="color: ${endingColor}">${BoxChars.dblRightT}</span>`;
  menuBox.appendChild(divider1);

  // Message area (wrap text to fit)
  const messageLines = wrapText(options.message, innerWidth - 4);
  for (const line of messageLines) {
    const msgEl = document.createElement('div');
    const paddedLine = '  ' + line + ' '.repeat(Math.max(0, innerWidth - 2 - line.length));
    msgEl.innerHTML = `<span style="color: ${endingColor}">${BoxChars.dblVertical}</span><span style="color: var(--color-text-primary, #fff)">${paddedLine}</span><span style="color: ${endingColor}">${BoxChars.dblVertical}</span>`;
    menuBox.appendChild(msgEl);
  }

  // Spacer after message
  const spacer3 = document.createElement('div');
  spacer3.innerHTML = `<span style="color: ${endingColor}">${BoxChars.dblVertical}</span>${' '.repeat(innerWidth)}<span style="color: ${endingColor}">${BoxChars.dblVertical}</span>`;
  menuBox.appendChild(spacer3);

  // Stats section (if provided)
  if (options.stats) {
    // Stats divider
    const statsDivider = document.createElement('div');
    const statsLabel = ' STATISTICS ';
    const statsLeftPad = Math.floor((innerWidth - statsLabel.length) / 2);
    const statsRightPad = innerWidth - statsLeftPad - statsLabel.length;
    statsDivider.innerHTML = `<span style="color: ${endingColor}">${BoxChars.dblLeftT}</span><span style="color: var(--color-border, #AA5500)">${BoxChars.horizontal.repeat(statsLeftPad)}</span><span style="color: var(--color-header, #FFFF55)">${statsLabel}</span><span style="color: var(--color-border, #AA5500)">${BoxChars.horizontal.repeat(statsRightPad)}</span><span style="color: ${endingColor}">${BoxChars.dblRightT}</span>`;
    menuBox.appendChild(statsDivider);

    // Stats content
    const statsData = [
      { label: 'Chapters Completed', value: `${options.stats.chaptersCompleted}/${options.stats.totalChapters}` },
      { label: 'Items Collected', value: `${options.stats.itemsCollected}` },
      { label: 'Choices Made', value: `${options.stats.choicesMade}` },
      { label: 'Play Time', value: formatPlaytime(options.stats.playtimeSeconds) },
    ];

    for (const stat of statsData) {
      const statEl = document.createElement('div');
      const labelPart = `  ${stat.label}:`;
      const valuePart = stat.value;
      const spacing = ' '.repeat(Math.max(1, innerWidth - 4 - labelPart.length - valuePart.length));
      statEl.innerHTML = `<span style="color: ${endingColor}">${BoxChars.dblVertical}</span><span style="color: var(--color-text-secondary, #AAAAAA)">${labelPart}</span>${spacing}<span style="color: var(--color-text-primary, #fff)">${valuePart}  </span><span style="color: ${endingColor}">${BoxChars.dblVertical}</span>`;
      menuBox.appendChild(statEl);
    }

    // Spacer after stats
    const spacer4 = document.createElement('div');
    spacer4.innerHTML = `<span style="color: ${endingColor}">${BoxChars.dblVertical}</span>${' '.repeat(innerWidth)}<span style="color: ${endingColor}">${BoxChars.dblVertical}</span>`;
    menuBox.appendChild(spacer4);
  }

  // Navigation divider
  const navDivider = document.createElement('div');
  navDivider.innerHTML = `<span style="color: ${endingColor}">${BoxChars.dblLeftT}</span><span style="color: var(--color-border, #AA5500)">${BoxChars.horizontal.repeat(innerWidth)}</span><span style="color: ${endingColor}">${BoxChars.dblRightT}</span>`;
  menuBox.appendChild(navDivider);

  // Navigation menu
  const menuContainer = document.createElement('div');
  menuContainer.className = 'ending-menu';
  menuContainer.setAttribute('role', 'menu');

  const menuElements: HTMLElement[] = [];

  function renderMenu(): void {
    menuContainer.innerHTML = '';
    menuElements.length = 0;

    // Spacer
    const navSpacer1 = document.createElement('div');
    navSpacer1.innerHTML = `<span style="color: ${endingColor}">${BoxChars.dblVertical}</span>${' '.repeat(innerWidth)}<span style="color: ${endingColor}">${BoxChars.dblVertical}</span>`;
    menuContainer.appendChild(navSpacer1);

    for (let i = 0; i < MENU_ITEMS.length; i++) {
      const item = MENU_ITEMS[i];
      if (!item) continue;

      const itemEl = document.createElement('div');
      itemEl.className = 'ending-menu-item';
      itemEl.setAttribute('role', 'menuitem');
      itemEl.setAttribute('tabindex', i === selectedIndex ? '0' : '-1');
      itemEl.setAttribute('data-id', item.id);
      Object.assign(itemEl.style, {
        cursor: 'pointer',
      });

      updateMenuItem(itemEl, item, i === selectedIndex);
      menuElements.push(itemEl);
      menuContainer.appendChild(itemEl);

      // Mouse support
      const index = i;
      itemEl.addEventListener('mouseenter', () => updateSelection(index));
      itemEl.addEventListener('click', () => handleConfirm());
    }

    // Spacer
    const navSpacer2 = document.createElement('div');
    navSpacer2.innerHTML = `<span style="color: ${endingColor}">${BoxChars.dblVertical}</span>${' '.repeat(innerWidth)}<span style="color: ${endingColor}">${BoxChars.dblVertical}</span>`;
    menuContainer.appendChild(navSpacer2);
  }

  function updateMenuItem(el: HTMLElement, item: { id: MenuOption; label: string }, isSelected: boolean): void {
    const marker = isSelected ? '\u25BA' : ' '; // ►
    const markerColor = isSelected ? 'var(--color-selection, #55FF55)' : 'var(--color-text-primary, #fff)';
    const labelColor = isSelected ? 'var(--color-selection, #55FF55)' : 'var(--color-text-primary, #fff)';
    const bracketedLabel = `[${item.label}]`;
    const labelPadding = Math.floor((innerWidth - bracketedLabel.length - 2) / 2);

    el.innerHTML = `<span style="color: ${endingColor}">${BoxChars.dblVertical}</span>${' '.repeat(labelPadding)}<span style="color: ${markerColor}">${marker}</span> <span style="color: ${labelColor}">${bracketedLabel}</span>${' '.repeat(innerWidth - labelPadding - bracketedLabel.length - 2)}<span style="color: ${endingColor}">${BoxChars.dblVertical}</span>`;
  }

  function updateSelection(newIndex: number): void {
    for (let i = 0; i < menuElements.length; i++) {
      const el = menuElements[i];
      const item = MENU_ITEMS[i];
      if (el && item) {
        updateMenuItem(el, item, i === newIndex);
        el.setAttribute('tabindex', i === newIndex ? '0' : '-1');
      }
    }
    selectedIndex = newIndex;
  }

  function handleConfirm(): void {
    const item = MENU_ITEMS[selectedIndex];
    if (!item) return;

    switch (item.id) {
      case 'credits':
        callbacks.onViewCredits();
        break;
      case 'title':
        callbacks.onReturnToTitle();
        break;
    }
  }

  renderMenu();
  menuBox.appendChild(menuContainer);

  // Bottom border
  const bottomBorder = document.createElement('div');
  bottomBorder.style.color = endingColor;
  bottomBorder.textContent = BoxChars.dblBottomLeft + BoxChars.dblHorizontal.repeat(innerWidth) + BoxChars.dblBottomRight;
  menuBox.appendChild(bottomBorder);

  // Help text
  const helpText = document.createElement('div');
  helpText.className = 'ending-help';
  helpText.setAttribute('role', 'note');
  Object.assign(helpText.style, {
    textAlign: 'center',
    marginTop: '0.5em',
    color: 'var(--color-text-secondary, #AAAAAA)',
    fontSize: '0.9em',
  });
  helpText.textContent = '\u2191\u2193 Navigate    Enter: Select';
  menuBox.appendChild(helpText);

  overlay.appendChild(menuBox);

  // Keyboard navigation
  const keyboard = getKeyboardHandler();

  const keyHandler: KeyHandler = (event: KeyEvent) => {
    const { action } = event;

    switch (action) {
      case 'up':
        if (selectedIndex > 0) {
          updateSelection(selectedIndex - 1);
        } else {
          updateSelection(MENU_ITEMS.length - 1);
        }
        break;

      case 'down':
        if (selectedIndex < MENU_ITEMS.length - 1) {
          updateSelection(selectedIndex + 1);
        } else {
          updateSelection(0);
        }
        break;

      case 'confirm':
        handleConfirm();
        break;

      // Note: No 'cancel'/Esc handler - player must choose an option
      // This is intentional per UI.md flow (Ending -> Credits or Title only)
    }
  };

  unsubscribers.push(keyboard.onAny(keyHandler));

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

/**
 * Wrap text to fit within a given width
 */
function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length === 0) {
      currentLine = word;
    } else if (currentLine.length + 1 + word.length <= maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [''];
}
