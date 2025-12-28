/**
 * Load Screen
 *
 * Screen for loading saved games from one of 3 slots.
 * Displays slot metadata, handles empty slots and corruption warnings.
 *
 * Per UI.md and ENGINE.md specifications.
 */

import { createScreen, BoxChars } from '../components/Screen';
import { createConfirmDialog } from '../components/ConfirmDialog';
import { getKeyboardHandler, createMenuNavigation, type KeyHandler } from '../input/KeyboardHandler';

/** Save slot data from ENGINE.md SavePreview */
export interface LoadSlotData {
  slot: number;
  isEmpty: boolean;
  isCorrupted?: boolean;
  name?: string;
  nodeTitle?: string;
  actNumber?: number;
  choiceCount?: number;
  timestamp?: number;
  playtime?: number;
}

export interface LoadScreenCallbacks {
  onLoad: (slot: number) => void;
  onDelete: (slot: number) => void;
  onCancel: () => void;
}

export interface LoadScreen {
  element: HTMLElement;
  update: (slots: LoadSlotData[]) => void;
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
 * Creates the load game screen
 */
export function createLoadScreen(
  initialSlots: LoadSlotData[],
  callbacks: LoadScreenCallbacks
): LoadScreen {
  let slots = [...initialSlots];
  let selectedIndex = 0;
  const unsubscribers: (() => void)[] = [];

  // Create screen container
  const screen = createScreen({
    title: 'LOAD GAME',
    showBorder: true,
    borderStyle: 'double',
    ariaLabel: 'Load Game Screen',
  });

  // Layout container
  const layout = document.createElement('div');
  layout.className = 'load-layout';
  Object.assign(layout.style, {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: '1em 1ch',
  });

  // Instructions
  const instructions = document.createElement('p');
  instructions.className = 'load-instructions';
  instructions.textContent = 'Select a slot to load:';
  Object.assign(instructions.style, {
    marginBottom: '1em',
    color: 'var(--color-text-secondary, #AAAAAA)',
  });
  layout.appendChild(instructions);

  // Slots container
  const slotsContainer = document.createElement('div');
  slotsContainer.className = 'load-slots';
  slotsContainer.setAttribute('role', 'listbox');
  slotsContainer.setAttribute('aria-label', 'Load slots');
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
      slotEl.className = 'load-slot';
      slotEl.setAttribute('role', 'option');
      slotEl.setAttribute('tabindex', i === selectedIndex ? '0' : '-1');
      slotEl.setAttribute('aria-selected', i === selectedIndex ? 'true' : 'false');

      if (slot.isEmpty) {
        slotEl.setAttribute('aria-disabled', 'true');
      }
      if (slot.isCorrupted) {
        slotEl.setAttribute('aria-description', 'Save data corrupted');
      }

      Object.assign(slotEl.style, {
        marginBottom: '0.5em',
        cursor: slot.isEmpty || slot.isCorrupted ? 'not-allowed' : 'pointer',
      });

      updateSlotElement(slotEl, slot, i === selectedIndex);
      slotElements.push(slotEl);
      slotsContainer.appendChild(slotEl);

      // Mouse support - capture values for closure
      const index = i;
      const slotRef = slot;
      slotEl.addEventListener('mouseenter', () => updateSelection(index));
      slotEl.addEventListener('click', () => {
        if (!slotRef.isEmpty && !slotRef.isCorrupted) {
          handleConfirm(index);
        } else if (slotRef.isCorrupted) {
          handleCorruptedSlot(index);
        }
      });
    }
  }

  function updateSlotElement(el: HTMLElement, slot: LoadSlotData, isSelected: boolean): void {
    const isDisabled = slot.isEmpty;
    const isCorrupted = slot.isCorrupted;

    let borderColor = 'var(--color-border, #AA5500)';
    if (isSelected && !isDisabled && !isCorrupted) {
      borderColor = 'var(--color-selection, #55FF55)';
    } else if (isCorrupted) {
      borderColor = 'var(--color-error, #FF5555)';
    }

    const marker = isSelected ? '\u25BA' : ' '; // ►

    const slotWidth = 73;
    const innerWidth = slotWidth - 2;

    // Top border
    let content = `<div style="color: ${borderColor}">${BoxChars.topLeft}${BoxChars.horizontal.repeat(innerWidth)}${BoxChars.topRight}</div>`;

    // Line 1: Slot number and title/empty/corrupted
    const slotLabel = `SLOT ${slot.slot}:`;

    if (isCorrupted) {
      const line1Content = `${marker} ${slotLabel} [!] CORRUPTED`;
      const padding = innerWidth - line1Content.length;
      content += `<div style="color: var(--color-error, #FF5555)"><span style="color: ${borderColor}">${BoxChars.vertical}</span> ${line1Content}${' '.repeat(Math.max(0, padding))}<span style="color: ${borderColor}">${BoxChars.vertical}</span></div>`;
      // Second line: error message
      const line2Content = '  Save data corrupted. Press [D] to delete.';
      const line2Padding = innerWidth - line2Content.length;
      content += `<div><span style="color: ${borderColor}">${BoxChars.vertical}</span><span style="color: var(--color-text-secondary, #AAAAAA)">${line2Content}${' '.repeat(Math.max(0, line2Padding))}</span><span style="color: ${borderColor}">${BoxChars.vertical}</span></div>`;
    } else if (slot.isEmpty) {
      const line1Content = `${marker} ${slotLabel} [EMPTY]`;
      const padding = innerWidth - line1Content.length;
      content += `<div style="color: var(--color-text-disabled, #555555)"><span style="color: ${borderColor}">${BoxChars.vertical}</span> ${line1Content}${' '.repeat(Math.max(0, padding))}<span style="color: ${borderColor}">${BoxChars.vertical}</span></div>`;
      // Empty second line
      content += `<div><span style="color: ${borderColor}">${BoxChars.vertical}${' '.repeat(innerWidth)}${BoxChars.vertical}</span></div>`;
    } else {
      // Line 1: Slot number, title, and date
      const dateStr = slot.timestamp ? formatDate(slot.timestamp) : '';
      const titleText = slot.nodeTitle || slot.name || 'Unknown';
      const maxTitleLen = innerWidth - slotLabel.length - dateStr.length - 6;
      const truncTitle = titleText.length > maxTitleLen
        ? titleText.slice(0, maxTitleLen - 3) + '...'
        : titleText;
      const line1Left = `${marker} ${slotLabel} ${truncTitle}`;
      const line1Padding = innerWidth - line1Left.length - dateStr.length - 1;

      const textColor = isSelected
        ? 'var(--color-selection, #55FF55)'
        : 'var(--color-text-primary, #fff)';

      content += `<div><span style="color: ${borderColor}">${BoxChars.vertical}</span><span style="color: ${textColor}"> ${line1Left}${' '.repeat(Math.max(1, line1Padding))}${dateStr}</span><span style="color: ${borderColor}">${BoxChars.vertical}</span></div>`;

      // Line 2: Stats
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
    updateStatusMessage();
  }

  async function handleConfirm(index: number): Promise<void> {
    const slot = slots[index];
    if (!slot) return;

    if (slot.isEmpty) {
      return; // Can't load empty slot
    }

    if (slot.isCorrupted) {
      await handleCorruptedSlot(index);
      return;
    }

    callbacks.onLoad(slot.slot);
  }

  async function handleCorruptedSlot(index: number): Promise<void> {
    const slot = slots[index];
    if (!slot) return;

    const confirmDialog = createConfirmDialog({
      title: 'DELETE CORRUPTED SAVE',
      message: `Save data in Slot ${slot.slot} is corrupted.\nWould you like to delete it?`,
      confirmText: 'DELETE',
      cancelText: 'CANCEL',
      type: 'error',
    });
    const confirmed = await confirmDialog.show();
    if (confirmed) {
      callbacks.onDelete(slot.slot);
    }
  }

  renderSlots();
  layout.appendChild(slotsContainer);

  // Status message area
  const statusArea = document.createElement('div');
  statusArea.className = 'load-status';
  statusArea.setAttribute('role', 'status');
  statusArea.setAttribute('aria-live', 'polite');
  Object.assign(statusArea.style, {
    height: '1.5em',
    marginTop: '0.5em',
  });

  function updateStatusMessage(): void {
    const slot = slots[selectedIndex];
    if (!slot) {
      statusArea.textContent = '';
      return;
    }
    if (slot.isEmpty) {
      statusArea.innerHTML = '<span style="color: var(--color-text-disabled, #555555)">No save data in this slot.</span>';
    } else if (slot.isCorrupted) {
      statusArea.innerHTML = '<span style="color: var(--color-error, #FF5555)">[!] Save data corrupted. Cannot load.</span>';
    } else {
      statusArea.textContent = '';
    }
  }
  updateStatusMessage();
  layout.appendChild(statusArea);

  // Divider
  const divider = document.createElement('div');
  divider.style.color = 'var(--color-border, #AA5500)';
  divider.textContent = BoxChars.horizontal.repeat(78);
  divider.setAttribute('role', 'separator');
  layout.appendChild(divider);

  // Help text
  const helpText = document.createElement('div');
  helpText.className = 'load-help';
  Object.assign(helpText.style, {
    paddingTop: '0.5em',
    color: 'var(--color-text-secondary, #AAAAAA)',
  });
  helpText.textContent = 'Enter: Load    D: Delete    Esc: Cancel';
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

  // Delete key handler
  const deleteHandler = (e: KeyboardEvent) => {
    if (e.key === 'd' || e.key === 'D') {
      const slot = slots[selectedIndex];
      if (slot && !slot.isEmpty) {
        e.preventDefault();
        handleDeleteRequest(selectedIndex);
      }
    }
  };

  async function handleDeleteRequest(index: number): Promise<void> {
    const slot = slots[index];
    if (!slot) return;

    const confirmDialog = createConfirmDialog({
      title: 'DELETE SAVE',
      message: `Are you sure you want to delete the save in Slot ${slot.slot}?\nThis action cannot be undone.`,
      confirmText: 'DELETE',
      cancelText: 'CANCEL',
      type: 'warning',
    });
    const confirmed = await confirmDialog.show();
    if (confirmed) {
      callbacks.onDelete(slot.slot);
    }
  }

  document.addEventListener('keydown', deleteHandler);
  unsubscribers.push(() => document.removeEventListener('keydown', deleteHandler));

  return {
    element: screen,
    update: (newSlots: LoadSlotData[]) => {
      slots = [...newSlots];
      renderSlots();
      updateStatusMessage();
    },
    destroy: () => {
      for (const unsub of unsubscribers) {
        unsub();
      }
      screen.remove();
    },
  };
}
