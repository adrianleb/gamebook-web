/**
 * Inventory Screen
 *
 * Two-panel overlay accessible via I/Tab from GameScreen.
 * Left panel: Item list with selection marker and quantities
 * Right panel: Item details (ItemInspect) with Use/Drop actions
 *
 * Per UI.md specification with keyboard navigation.
 */

import { BoxChars } from '../components/Screen';
import { getKeyboardHandler, type KeyHandler, type KeyEvent } from '../input/KeyboardHandler';

/**
 * Inventory item data matching ENGINE.md InventoryEntry + Item
 */
export interface InventoryItem {
  itemId: string;
  quantity: number;
  name: string;
  description: string;
  usable: boolean;
  consumable: boolean;
  tags?: string[];
  stats?: Record<string, number | string>;
  equipped?: boolean;
}

export interface InventoryScreenCallbacks {
  onClose: () => void;
  onUseItem: (itemId: string) => void;
  onDropItem: (itemId: string) => void;
}

export interface InventoryScreen {
  element: HTMLElement;
  update: (items: InventoryItem[]) => void;
  destroy: () => void;
}

/**
 * Creates an inventory overlay with two-panel layout
 */
export function createInventoryScreen(
  items: InventoryItem[],
  callbacks: InventoryScreenCallbacks
): InventoryScreen {
  let selectedIndex = 0;
  let currentItems = [...items];
  const unsubscribers: (() => void)[] = [];

  // Create overlay backdrop
  const overlay = document.createElement('div');
  overlay.className = 'inventory-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Inventory');
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '100',
  });

  // Create inventory container
  const containerWidth = 78;
  const container = document.createElement('div');
  container.className = 'inventory-container';
  Object.assign(container.style, {
    width: `${containerWidth}ch`,
    backgroundColor: 'var(--color-bg-primary, #000)',
    color: 'var(--color-text-primary, #fff)',
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: 'var(--font-size-base, 16px)',
    lineHeight: '1.2',
  });

  // Title bar
  const innerWidth = containerWidth - 2;
  const title = ' INVENTORY ';
  const leftPad = Math.floor((innerWidth - title.length) / 2);
  const rightPad = innerWidth - leftPad - title.length;

  const titleBar = document.createElement('div');
  titleBar.innerHTML = `${BoxChars.topLeft}${BoxChars.horizontal.repeat(leftPad)}<span style="color: var(--color-header, #FFFF55)">${title}</span>${BoxChars.horizontal.repeat(rightPad)}${BoxChars.topRight}`;
  titleBar.style.color = 'var(--color-border, #AA5500)';
  container.appendChild(titleBar);

  // Content area with two panels
  const contentArea = document.createElement('div');
  contentArea.className = 'inventory-content';
  Object.assign(contentArea.style, {
    display: 'flex',
    minHeight: '14em',
  });

  // Left panel: Item list (35 chars wide)
  const leftPanelWidth = 35;
  const leftPanel = document.createElement('div');
  leftPanel.className = 'inventory-items';
  leftPanel.setAttribute('role', 'listbox');
  leftPanel.setAttribute('aria-label', 'Items');
  Object.assign(leftPanel.style, {
    width: `${leftPanelWidth}ch`,
    borderRight: `1px solid var(--color-border, #AA5500)`,
    padding: '0.5em 0',
  });

  // Right panel: Item details (remaining width)
  const rightPanel = document.createElement('div');
  rightPanel.className = 'inventory-details';
  rightPanel.setAttribute('aria-live', 'polite');
  Object.assign(rightPanel.style, {
    flex: '1',
    padding: '0.5em 1ch',
  });

  contentArea.appendChild(leftPanel);
  contentArea.appendChild(rightPanel);

  // Add border to sides
  const leftBorder = document.createElement('div');
  leftBorder.style.color = 'var(--color-border, #AA5500)';
  leftBorder.textContent = BoxChars.vertical;
  leftBorder.style.position = 'absolute';
  leftBorder.style.left = '0';

  container.appendChild(contentArea);

  // Divider above help text
  const divider = document.createElement('div');
  divider.textContent = BoxChars.leftT + BoxChars.horizontal.repeat(innerWidth) + BoxChars.rightT;
  divider.style.color = 'var(--color-border, #AA5500)';
  container.appendChild(divider);

  // Help text row
  const helpRow = document.createElement('div');
  helpRow.className = 'inventory-help';
  helpRow.setAttribute('role', 'note');
  Object.assign(helpRow.style, {
    padding: '0.3em 1ch',
    color: 'var(--color-text-secondary, #AAAAAA)',
  });
  helpRow.innerHTML = `${BoxChars.vertical}  <span>\u2191\u2193 Navigate    Enter: Inspect    U: Use    X: Drop    Esc/I: Close</span>`;
  container.appendChild(helpRow);

  // Bottom border
  const bottomBorder = document.createElement('div');
  bottomBorder.textContent = BoxChars.bottomLeft + BoxChars.horizontal.repeat(innerWidth) + BoxChars.bottomRight;
  bottomBorder.style.color = 'var(--color-border, #AA5500)';
  container.appendChild(bottomBorder);

  overlay.appendChild(container);

  /**
   * Render the item list
   */
  function renderItemList(): void {
    leftPanel.innerHTML = '';

    if (currentItems.length === 0) {
      const emptyMsg = document.createElement('div');
      Object.assign(emptyMsg.style, {
        padding: '1em 1ch',
        color: 'var(--color-text-disabled, #555555)',
        fontStyle: 'italic',
      });
      emptyMsg.textContent = '  (empty)';
      leftPanel.appendChild(emptyMsg);
      return;
    }

    for (let i = 0; i < currentItems.length; i++) {
      const item = currentItems[i];
      if (!item) continue;

      const isSelected = i === selectedIndex;
      const itemRow = document.createElement('div');
      itemRow.className = 'inventory-item';
      itemRow.setAttribute('role', 'option');
      itemRow.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      itemRow.setAttribute('data-index', String(i));
      Object.assign(itemRow.style, {
        padding: '0.2em 1ch',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      });

      const marker = isSelected ? '\u25BA' : ' '; // ►
      const equipped = item.equipped ? '[E]' : '   ';
      const quantity = item.quantity > 1 ? ` (x${item.quantity})` : '';
      const maxNameLen = leftPanelWidth - 10; // Leave room for marker, equipped, quantity
      const displayName = item.name.length > maxNameLen
        ? item.name.substring(0, maxNameLen - 2) + '..'
        : item.name;

      if (isSelected) {
        itemRow.innerHTML = `<span style="color: var(--color-selection, #55FF55)">${marker} ${displayName}${quantity}</span> <span style="color: var(--color-text-secondary, #AAAAAA)">${equipped}</span>`;
        itemRow.style.backgroundColor = 'rgba(85, 255, 85, 0.1)';
      } else {
        itemRow.innerHTML = `<span style="color: var(--color-text-primary, #fff)">${marker} ${displayName}${quantity}</span> <span style="color: var(--color-text-secondary, #AAAAAA)">${equipped}</span>`;
      }

      // Mouse support
      const index = i;
      itemRow.addEventListener('mouseenter', () => {
        selectedIndex = index;
        renderItemList();
        renderDetails();
      });
      itemRow.addEventListener('click', () => {
        selectedIndex = index;
        renderItemList();
        renderDetails();
      });

      leftPanel.appendChild(itemRow);
    }
  }

  /**
   * Render item details in right panel
   */
  function renderDetails(): void {
    rightPanel.innerHTML = '';

    if (currentItems.length === 0 || selectedIndex >= currentItems.length) {
      const noSelection = document.createElement('div');
      Object.assign(noSelection.style, {
        color: 'var(--color-text-disabled, #555555)',
        fontStyle: 'italic',
      });
      noSelection.textContent = 'No items in inventory.';
      rightPanel.appendChild(noSelection);
      return;
    }

    const item = currentItems[selectedIndex];
    if (!item) return;

    // Item name header
    const nameEl = document.createElement('div');
    Object.assign(nameEl.style, {
      color: 'var(--color-header, #FFFF55)',
      fontWeight: 'bold',
      marginBottom: '0.5em',
    });
    nameEl.textContent = item.name.toUpperCase();
    rightPanel.appendChild(nameEl);

    // Separator
    const sep = document.createElement('div');
    sep.style.color = 'var(--color-border, #AA5500)';
    sep.textContent = BoxChars.horizontal.repeat(38);
    rightPanel.appendChild(sep);

    // Description
    const descEl = document.createElement('div');
    Object.assign(descEl.style, {
      marginTop: '0.5em',
      marginBottom: '0.5em',
      color: 'var(--color-text-primary, #fff)',
    });
    // Word wrap description
    descEl.textContent = item.description;
    rightPanel.appendChild(descEl);

    // Stats (if any)
    if (item.stats && Object.keys(item.stats).length > 0) {
      const statsEl = document.createElement('div');
      Object.assign(statsEl.style, {
        marginTop: '0.5em',
        color: 'var(--color-text-secondary, #AAAAAA)',
      });
      for (const [key, value] of Object.entries(item.stats)) {
        const statLine = document.createElement('div');
        const formattedKey = key.charAt(0).toUpperCase() + key.slice(1);
        const formattedValue = typeof value === 'number' && value > 0 ? `+${value}` : String(value);
        statLine.textContent = `${formattedKey}: ${formattedValue}`;
        statsEl.appendChild(statLine);
      }
      rightPanel.appendChild(statsEl);
    }

    // Equipped status
    if (item.equipped) {
      const equippedEl = document.createElement('div');
      Object.assign(equippedEl.style, {
        marginTop: '0.5em',
        color: 'var(--color-success, #55FF55)',
      });
      equippedEl.textContent = 'Equipped: Yes';
      rightPanel.appendChild(equippedEl);
    }

    // Tags
    if (item.tags && item.tags.length > 0) {
      const tagsEl = document.createElement('div');
      Object.assign(tagsEl.style, {
        marginTop: '0.5em',
        color: 'var(--color-text-disabled, #555555)',
        fontSize: '0.9em',
      });
      tagsEl.textContent = `[${item.tags.join(', ')}]`;
      rightPanel.appendChild(tagsEl);
    }

    // Action hints
    const actionsEl = document.createElement('div');
    Object.assign(actionsEl.style, {
      marginTop: '1em',
      paddingTop: '0.5em',
      borderTop: `1px solid var(--color-border, #AA5500)`,
    });

    if (item.usable) {
      const useHint = document.createElement('span');
      useHint.style.color = 'var(--color-interactive, #00AAAA)';
      useHint.textContent = '[U]se  ';
      actionsEl.appendChild(useHint);
    }

    const dropHint = document.createElement('span');
    dropHint.style.color = 'var(--color-warning, #FFFF55)';
    dropHint.textContent = '[X]Drop';
    actionsEl.appendChild(dropHint);

    rightPanel.appendChild(actionsEl);
  }

  /**
   * Handle keyboard input
   */
  function handleKeyboard(event: KeyEvent): void {
    const { action } = event;

    // Prevent Tab default behavior when inventory is open
    if (event.originalEvent.key === 'Tab') {
      event.originalEvent.preventDefault();
    }

    switch (action) {
      case 'up':
        if (currentItems.length > 0) {
          selectedIndex = selectedIndex > 0 ? selectedIndex - 1 : currentItems.length - 1;
          renderItemList();
          renderDetails();
        }
        break;

      case 'down':
        if (currentItems.length > 0) {
          selectedIndex = selectedIndex < currentItems.length - 1 ? selectedIndex + 1 : 0;
          renderItemList();
          renderDetails();
        }
        break;

      case 'use':
        if (currentItems.length > 0 && selectedIndex < currentItems.length) {
          const item = currentItems[selectedIndex];
          if (item && item.usable) {
            callbacks.onUseItem(item.itemId);
          }
        }
        break;

      case 'drop':
        if (currentItems.length > 0 && selectedIndex < currentItems.length) {
          const item = currentItems[selectedIndex];
          if (item) {
            callbacks.onDropItem(item.itemId);
          }
        }
        break;

      case 'cancel':
      case 'inventory':
        callbacks.onClose();
        break;

      case 'confirm':
        // Enter inspects/focuses the item details (already shown)
        // Could add more detailed inspection modal here
        break;
    }
  }

  // Initial render
  renderItemList();
  renderDetails();

  // Keyboard navigation
  const keyboard = getKeyboardHandler();
  const keyHandler: KeyHandler = handleKeyboard;
  unsubscribers.push(keyboard.onAny(keyHandler));

  // Focus management
  overlay.tabIndex = -1;
  setTimeout(() => overlay.focus(), 0);

  return {
    element: overlay,
    update: (newItems: InventoryItem[]) => {
      currentItems = [...newItems];
      // Keep selection in bounds
      if (selectedIndex >= currentItems.length) {
        selectedIndex = Math.max(0, currentItems.length - 1);
      }
      renderItemList();
      renderDetails();
    },
    destroy: () => {
      for (const unsub of unsubscribers) {
        unsub();
      }
      overlay.remove();
    },
  };
}
