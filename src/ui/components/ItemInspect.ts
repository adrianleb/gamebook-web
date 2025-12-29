/**
 * Item Inspect Component
 *
 * Reusable panel for displaying item details with:
 * - Item name (header)
 * - Description text
 * - Stats display
 * - Equipped status
 * - Use/Drop action buttons
 *
 * Per UI.md specification.
 */

import { BoxChars } from './Screen';

/**
 * Item data for inspection display
 */
export interface InspectableItem {
  itemId: string;
  name: string;
  description: string;
  usable: boolean;
  consumable: boolean;
  equipped?: boolean;
  stats?: Record<string, number | string>;
  tags?: string[];
}

export interface ItemInspectOptions {
  showActions?: boolean;
  width?: number;
}

export interface ItemInspectCallbacks {
  onUse?: (itemId: string) => void;
  onDrop?: (itemId: string) => void;
}

export interface ItemInspect {
  element: HTMLElement;
  update: (item: InspectableItem | null) => void;
  destroy: () => void;
}

/**
 * Creates an item inspection panel
 */
export function createItemInspect(
  item: InspectableItem | null,
  callbacks: ItemInspectCallbacks = {},
  options: ItemInspectOptions = {}
): ItemInspect {
  const { showActions = true, width = 38 } = options;
  let currentItem = item;

  const container = document.createElement('div');
  container.className = 'item-inspect';
  container.setAttribute('aria-label', 'Item details');
  container.setAttribute('aria-live', 'polite');
  Object.assign(container.style, {
    width: `${width}ch`,
    color: 'var(--color-text-primary, #fff)',
    fontFamily: 'var(--font-mono, monospace)',
  });

  function render(): void {
    container.innerHTML = '';

    if (!currentItem) {
      const emptyEl = document.createElement('div');
      Object.assign(emptyEl.style, {
        color: 'var(--color-text-disabled, #555555)',
        fontStyle: 'italic',
        padding: '1em 0',
      });
      emptyEl.textContent = 'Select an item to inspect.';
      container.appendChild(emptyEl);
      return;
    }

    // Item name header
    const nameEl = document.createElement('div');
    nameEl.className = 'item-name';
    Object.assign(nameEl.style, {
      color: 'var(--color-header, #FFFF55)',
      fontWeight: 'bold',
      marginBottom: '0.3em',
    });
    nameEl.textContent = currentItem.name.toUpperCase();
    container.appendChild(nameEl);

    // Separator line
    const sep = document.createElement('div');
    sep.className = 'item-separator';
    sep.setAttribute('role', 'separator');
    Object.assign(sep.style, {
      color: 'var(--color-border, #AA5500)',
      marginBottom: '0.5em',
    });
    sep.textContent = BoxChars.horizontal.repeat(width - 2);
    container.appendChild(sep);

    // Description
    const descEl = document.createElement('div');
    descEl.className = 'item-description';
    Object.assign(descEl.style, {
      marginBottom: '0.5em',
      lineHeight: '1.3',
    });
    descEl.textContent = currentItem.description;
    container.appendChild(descEl);

    // Stats block
    if (currentItem.stats && Object.keys(currentItem.stats).length > 0) {
      const statsBlock = document.createElement('div');
      statsBlock.className = 'item-stats';
      Object.assign(statsBlock.style, {
        marginTop: '0.5em',
        marginBottom: '0.5em',
      });

      for (const [key, value] of Object.entries(currentItem.stats)) {
        const statLine = document.createElement('div');
        const formattedKey = key.toUpperCase();
        const formattedValue = typeof value === 'number' && value > 0 ? `+${value}` : String(value);

        // Color positive values green, negative red
        let valueColor = 'var(--color-text-secondary, #AAAAAA)';
        if (typeof value === 'number') {
          if (value > 0) {
            valueColor = 'var(--color-success, #55FF55)';
          } else if (value < 0) {
            valueColor = 'var(--color-error, #FF5555)';
          }
        }

        statLine.innerHTML = `<span style="color: var(--color-text-secondary, #AAAAAA)">${formattedKey}:</span> <span style="color: ${valueColor}">${formattedValue}</span>`;
        statsBlock.appendChild(statLine);
      }
      container.appendChild(statsBlock);
    }

    // Equipped status
    if (currentItem.equipped) {
      const equippedEl = document.createElement('div');
      equippedEl.className = 'item-equipped';
      Object.assign(equippedEl.style, {
        color: 'var(--color-success, #55FF55)',
        marginTop: '0.3em',
      });
      equippedEl.textContent = 'Equipped: Yes';
      container.appendChild(equippedEl);
    }

    // Consumable indicator
    if (currentItem.consumable) {
      const consumableEl = document.createElement('div');
      consumableEl.className = 'item-consumable';
      Object.assign(consumableEl.style, {
        color: 'var(--color-warning, #FFFF55)',
        fontSize: '0.9em',
        marginTop: '0.3em',
      });
      consumableEl.textContent = '(Consumable)';
      container.appendChild(consumableEl);
    }

    // Tags
    if (currentItem.tags && currentItem.tags.length > 0) {
      const tagsEl = document.createElement('div');
      tagsEl.className = 'item-tags';
      Object.assign(tagsEl.style, {
        color: 'var(--color-text-disabled, #555555)',
        fontSize: '0.85em',
        marginTop: '0.5em',
      });
      tagsEl.textContent = `[${currentItem.tags.join(', ')}]`;
      container.appendChild(tagsEl);
    }

    // Action buttons
    if (showActions) {
      const actionsEl = document.createElement('div');
      actionsEl.className = 'item-actions';
      Object.assign(actionsEl.style, {
        marginTop: '1em',
        paddingTop: '0.5em',
        borderTop: `1px solid var(--color-border, #AA5500)`,
        display: 'flex',
        gap: '2ch',
      });

      if (currentItem.usable && callbacks.onUse) {
        const useBtn = document.createElement('button');
        useBtn.className = 'item-action-use';
        Object.assign(useBtn.style, {
          background: 'none',
          border: 'none',
          color: 'var(--color-interactive, #00AAAA)',
          fontFamily: 'inherit',
          fontSize: 'inherit',
          cursor: 'pointer',
          padding: '0.2em 0.5ch',
        });
        useBtn.textContent = '[U]se';
        useBtn.addEventListener('click', () => {
          if (currentItem && callbacks.onUse) {
            callbacks.onUse(currentItem.itemId);
          }
        });
        actionsEl.appendChild(useBtn);
      }

      if (callbacks.onDrop) {
        const dropBtn = document.createElement('button');
        dropBtn.className = 'item-action-drop';
        Object.assign(dropBtn.style, {
          background: 'none',
          border: 'none',
          color: 'var(--color-warning, #FFFF55)',
          fontFamily: 'inherit',
          fontSize: 'inherit',
          cursor: 'pointer',
          padding: '0.2em 0.5ch',
        });
        dropBtn.textContent = '[X]Drop';
        dropBtn.addEventListener('click', () => {
          if (currentItem && callbacks.onDrop) {
            callbacks.onDrop(currentItem.itemId);
          }
        });
        actionsEl.appendChild(dropBtn);
      }

      if (actionsEl.children.length > 0) {
        container.appendChild(actionsEl);
      }
    }
  }

  // Initial render
  render();

  return {
    element: container,
    update: (newItem: InspectableItem | null) => {
      currentItem = newItem;
      render();
    },
    destroy: () => {
      container.remove();
    },
  };
}
