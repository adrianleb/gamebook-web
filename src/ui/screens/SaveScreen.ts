/**
 * Save Screen
 *
 * Screen for saving game progress to one of 3 slots.
 * Displays slot metadata (chapter, playtime, date) and overwrite warnings.
 *
 * Per UI.md and ENGINE.md specifications.
 */

import { createScreen, BoxChars } from '../components/Screen';
import { createConfirmDialog } from '../components/ConfirmDialog';
import { getKeyboardHandler, createMenuNavigation, type KeyHandler } from '../input/KeyboardHandler';

/** Save slot data from ENGINE.md SavePreview */
export interface SaveSlotData {
  slot: number;
  isEmpty: boolean;
  name?: string;
  nodeTitle?: string;
  actNumber?: number;
  choiceCount?: number;
  timestamp?: number;
  playtime?: number;
}

export interface SaveScreenCallbacks {
  onSave: (slot: number) => void;
  onCancel: () => void;
}

export interface SaveScreen {
  element: HTMLElement;
  update: (slots: SaveSlotData[]) => void;
  destroy: () => void;
}

/**
 * Format playtime in milliseconds to HH:MM:SS
 */
function formatPlaytime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Format timestamp to readable date
 */
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * Creates the save game screen
 */
export function createSaveScreen(
  initialSlots: SaveSlotData[],
  callbacks: SaveScreenCallbacks
): SaveScreen {
  let slots = [...initialSlots];
  let selectedIndex = 0;
  const unsubscribers: (() => void)[] = [];

  // Create screen container
  const screen = createScreen({
    title: 'SAVE GAME',
    showBorder: true,
    borderStyle: 'double',
    ariaLabel: 'Save Game Screen',
  });

  // Layout container
  const layout = document.createElement('div');
  layout.className = 'save-layout';
  Object.assign(layout.style, {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: '1em 1ch',
  });

  // Instructions
  const instructions = document.createElement('p');
  instructions.className = 'save-instructions';
  instructions.textContent = 'Select a slot to save your progress:';
  Object.assign(instructions.style, {
    marginBottom: '1em',
    color: 'var(--color-text-secondary, #AAAAAA)',
  });
  layout.appendChild(instructions);

  // Slots container
  const slotsContainer = document.createElement('div');
  slotsContainer.className = 'save-slots';
  slotsContainer.setAttribute('role', 'listbox');
  slotsContainer.setAttribute('aria-label', 'Save slots');
  Object.assign(slotsContainer.style, {
    flex: '1',
  });

  const slotElements: HTMLElement[] = [];

  function renderSlots(): void {
    slotsContainer.innerHTML = '';
    slotElements.length = 0;

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (!slot) continue;

      const slotEl = document.createElement('div');
      slotEl.className = 'save-slot';
      slotEl.setAttribute('role', 'option');
      slotEl.setAttribute('tabindex', i === selectedIndex ? '0' : '-1');
      slotEl.setAttribute('aria-selected', i === selectedIndex ? 'true' : 'false');
      Object.assign(slotEl.style, {
        marginBottom: '0.5em',
        cursor: 'pointer',
      });

      updateSlotElement(slotEl, slot, i === selectedIndex);
      slotElements.push(slotEl);
      slotsContainer.appendChild(slotEl);

      // Mouse support - capture index for closure
      const index = i;
      slotEl.addEventListener('mouseenter', () => updateSelection(index));
      slotEl.addEventListener('click', () => handleConfirm(index));
    }
  }

  function updateSlotElement(el: HTMLElement, slot: SaveSlotData, isSelected: boolean): void {
    const borderColor = isSelected
      ? 'var(--color-selection, #55FF55)'
      : 'var(--color-border, #AA5500)';
    const marker = isSelected ? '\u25BA' : ' '; // ►

    const slotWidth = 73; // Inner width for slot content
    const innerWidth = slotWidth - 2;

    // Top border
    let content = `<div style="color: ${borderColor}">${BoxChars.topLeft}${BoxChars.horizontal.repeat(innerWidth)}${BoxChars.topRight}</div>`;

    // Line 1: Slot number and title/empty
    const slotLabel = `SLOT ${slot.slot}:`;
    if (slot.isEmpty) {
      const line1Content = `${marker} ${slotLabel} [EMPTY]`;
      const padding = innerWidth - line1Content.length;
      content += `<div style="color: ${isSelected ? 'var(--color-selection, #55FF55)' : 'var(--color-text-disabled, #555555)'}">${BoxChars.vertical} ${line1Content}${' '.repeat(Math.max(0, padding))}${BoxChars.vertical}</div>`;
      // Empty second line
      content += `<div style="color: ${borderColor}">${BoxChars.vertical}${' '.repeat(innerWidth)}${BoxChars.vertical}</div>`;
    } else {
      // Line 1: Slot number, title, and date
      const dateStr = slot.timestamp ? formatDate(slot.timestamp) : '';
      const titleText = slot.nodeTitle || slot.name || 'Unknown';
      const maxTitleLen = innerWidth - slotLabel.length - dateStr.length - 6; // markers, spaces
      const truncTitle = titleText.length > maxTitleLen
        ? titleText.slice(0, maxTitleLen - 3) + '...'
        : titleText;
      const line1Left = `${marker} ${slotLabel} ${truncTitle}`;
      const line1Padding = innerWidth - line1Left.length - dateStr.length - 1;
      content += `<div><span style="color: ${borderColor}">${BoxChars.vertical}</span><span style="color: ${isSelected ? 'var(--color-selection, #55FF55)' : 'var(--color-text-primary, #fff)'}"> ${line1Left}${' '.repeat(Math.max(1, line1Padding))}${dateStr}</span><span style="color: ${borderColor}">${BoxChars.vertical}</span></div>`;

      // Line 2: Stats (act, choices, playtime)
      const stats: string[] = [];
      if (slot.actNumber !== undefined) {
        stats.push(`Act ${slot.actNumber}`);
      }
      if (slot.choiceCount !== undefined) {
        stats.push(`${slot.choiceCount} choices`);
      }
      if (slot.playtime !== undefined) {
        stats.push(`Time: ${formatPlaytime(slot.playtime)}`);
      }
      const statsLine = stats.join('  ');
      const line2Content = `  ${statsLine}`;
      const line2Padding = innerWidth - line2Content.length;
      content += `<div><span style="color: ${borderColor}">${BoxChars.vertical}</span><span style="color: var(--color-text-secondary, #AAAAAA)">${line2Content}${' '.repeat(Math.max(0, line2Padding))}</span><span style="color: ${borderColor}">${BoxChars.vertical}</span></div>`;
    }

    // Bottom border
    content += `<div style="color: ${borderColor}">${BoxChars.bottomLeft}${BoxChars.horizontal.repeat(innerWidth)}${BoxChars.bottomRight}</div>`;

    el.innerHTML = content;
  }

  function updateSelection(newIndex: number): void {
    for (let i = 0; i < slotElements.length; i++) {
      const el = slotElements[i];
      const slot = slots[i];
      if (el && slot) {
        updateSlotElement(el, slot, i === newIndex);
        el.setAttribute('aria-selected', i === newIndex ? 'true' : 'false');
        el.setAttribute('tabindex', i === newIndex ? '0' : '-1');
      }
    }
    selectedIndex = newIndex;
    updateWarning();
  }

  async function handleConfirm(index: number): Promise<void> {
    const slot = slots[index];
    if (!slot) return;

    if (!slot.isEmpty) {
      // Show overwrite confirmation
      const confirmDialog = createConfirmDialog({
        title: 'OVERWRITE SAVE',
        message: `This will overwrite your save in Slot ${slot.slot}.\nAre you sure you want to continue?`,
        confirmText: 'OVERWRITE',
        cancelText: 'CANCEL',
        type: 'warning',
      });
      const confirmed = await confirmDialog.show();
      if (!confirmed) {
        return;
      }
    }

    callbacks.onSave(slot.slot);
  }

  renderSlots();
  layout.appendChild(slotsContainer);

  // Warning message area
  const warningArea = document.createElement('div');
  warningArea.className = 'save-warning';
  warningArea.setAttribute('role', 'alert');
  warningArea.setAttribute('aria-live', 'polite');
  Object.assign(warningArea.style, {
    height: '1.5em',
    color: 'var(--color-warning, #FFFF55)',
    marginTop: '0.5em',
  });

  function updateWarning(): void {
    const slot = slots[selectedIndex];
    if (slot && !slot.isEmpty) {
      warningArea.textContent = `[!] Saving to SLOT ${slot.slot} will overwrite existing data.`;
    } else {
      warningArea.textContent = '';
    }
  }
  updateWarning();
  layout.appendChild(warningArea);

  // Divider
  const divider = document.createElement('div');
  divider.style.color = 'var(--color-border, #AA5500)';
  divider.textContent = BoxChars.horizontal.repeat(78);
  divider.setAttribute('role', 'separator');
  layout.appendChild(divider);

  // Help text
  const helpText = document.createElement('div');
  helpText.className = 'save-help';
  Object.assign(helpText.style, {
    paddingTop: '0.5em',
    color: 'var(--color-text-secondary, #AAAAAA)',
  });
  helpText.textContent = 'Enter: Save    Esc: Cancel';
  layout.appendChild(helpText);

  screen.appendChild(layout);

  // Keyboard navigation
  const keyboard = getKeyboardHandler();

  const navHandler: KeyHandler = createMenuNavigation({
    getSelectedIndex: () => selectedIndex,
    setSelectedIndex: updateSelection,
    getItemCount: () => slots.length,
    onConfirm: handleConfirm,
    onCancel: () => callbacks.onCancel(),
  });

  unsubscribers.push(keyboard.onAny(navHandler));

  return {
    element: screen,
    update: (newSlots: SaveSlotData[]) => {
      slots = [...newSlots];
      renderSlots();
      updateWarning();
    },
    destroy: () => {
      for (const unsub of unsubscribers) {
        unsub();
      }
      screen.remove();
    },
  };
}
