/**
 * Game Screen
 *
 * Main gameplay screen with:
 * - Header (chapter title, inventory shortcut)
 * - Text panel (story content, scrollable)
 * - Status bar (HP, gold, items)
 * - Choice list (player options)
 *
 * Per UI.md specification with keyboard navigation.
 */

import { createScreen, createDivider, createStatusBar } from '../components/Screen';
import { getKeyboardHandler, createMenuNavigation, type KeyHandler } from '../input/KeyboardHandler';

export interface Choice {
  id: string;
  text: string;
  disabled?: boolean;
  disabledReason?: string;
}

export interface GameScreenState {
  chapterTitle: string;
  content: string;
  choices: Choice[];
  hp?: { current: number; max: number };
  gold?: number;
  statusItems?: string[];
}

export interface GameScreenCallbacks {
  onChoiceSelect: (choiceId: string) => void;
  onInventory: () => void;
  onPause: () => void;
}

export interface GameScreen {
  element: HTMLElement;
  update: (state: Partial<GameScreenState>) => void;
  destroy: () => void;
}

export function createGameScreen(
  initialState: GameScreenState,
  callbacks: GameScreenCallbacks
): GameScreen {
  let state = { ...initialState };
  let selectedIndex = 0;
  const unsubscribers: (() => void)[] = [];

  // Create screen container
  const screen = createScreen({
    showBorder: true,
    borderStyle: 'double',
    ariaLabel: 'Game Screen',
  });

  // Build layout
  const layout = document.createElement('div');
  layout.className = 'game-layout';
  Object.assign(layout.style, {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: '0 1ch',
  });

  // === Header (2 lines) ===
  const header = document.createElement('header');
  header.className = 'game-header';
  header.setAttribute('role', 'banner');
  Object.assign(header.style, {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 'calc(2 * 1.2em)',
    borderBottom: `1px solid var(--color-border, #AA5500)`,
    color: 'var(--color-header, #FFFF55)',
    backgroundColor: 'var(--color-bg-secondary, #0000AA)',
    padding: '0 1ch',
  });

  const chapterTitle = document.createElement('span');
  chapterTitle.className = 'chapter-title';
  chapterTitle.textContent = state.chapterTitle;
  header.appendChild(chapterTitle);

  const inventoryHint = document.createElement('span');
  inventoryHint.className = 'inventory-hint';
  inventoryHint.textContent = '[I]nv';
  inventoryHint.style.color = 'var(--color-text-secondary, #AAAAAA)';
  inventoryHint.setAttribute('aria-label', 'Press I for Inventory');
  header.appendChild(inventoryHint);

  layout.appendChild(header);

  // === Main Content Area (18 lines) ===
  const contentArea = document.createElement('main');
  contentArea.className = 'game-content';
  contentArea.setAttribute('role', 'main');
  contentArea.setAttribute('aria-label', 'Story content');
  contentArea.setAttribute('aria-live', 'polite');
  Object.assign(contentArea.style, {
    flex: '1',
    overflow: 'hidden',
    padding: '0.6em 0',
    lineHeight: '1.4',
    position: 'relative',
  });

  const textPanel = document.createElement('div');
  textPanel.className = 'text-panel';
  textPanel.setAttribute('role', 'article');
  Object.assign(textPanel.style, {
    height: '100%',
    overflowY: 'auto',
    paddingRight: '1ch',
  });

  // Render content
  function renderContent(): void {
    textPanel.innerHTML = '';
    const paragraphs = state.content.split('\n\n');
    for (const para of paragraphs) {
      if (para.trim()) {
        const p = document.createElement('p');
        p.textContent = para.trim();
        p.style.marginBottom = '1.2em';
        textPanel.appendChild(p);
      }
    }
  }
  renderContent();

  contentArea.appendChild(textPanel);
  layout.appendChild(contentArea);

  // Divider before status bar
  layout.appendChild(createDivider('single'));

  // === Status Bar (1 line) ===
  const statusBar = createStatusBar();
  statusBar.innerHTML = '';

  function renderStatusBar(): void {
    statusBar.innerHTML = '';

    // HP display
    if (state.hp) {
      const hpDisplay = document.createElement('span');
      hpDisplay.className = 'hp-display';
      const filled = Math.round((state.hp.current / state.hp.max) * 10);
      const empty = 10 - filled;
      const hpColor = state.hp.current / state.hp.max > 0.3
        ? 'var(--color-success, #55FF55)'
        : 'var(--color-error, #FF5555)';
      hpDisplay.innerHTML = `HP: <span style="color: ${hpColor}">${'\u2588'.repeat(filled)}${'\u2591'.repeat(empty)}</span> ${state.hp.current}/${state.hp.max}`;
      statusBar.appendChild(hpDisplay);
    }

    // Gold display
    if (state.gold !== undefined) {
      const goldDisplay = document.createElement('span');
      goldDisplay.className = 'gold-display';
      goldDisplay.innerHTML = `<span style="color: var(--color-warning, #FFFF55)">Gold:</span> ${state.gold}`;
      statusBar.appendChild(goldDisplay);
    }

    // Additional status items
    if (state.statusItems && state.statusItems.length > 0) {
      const itemsDisplay = document.createElement('span');
      itemsDisplay.className = 'status-items';
      itemsDisplay.textContent = state.statusItems.join('  ');
      statusBar.appendChild(itemsDisplay);
    }
  }
  renderStatusBar();

  layout.appendChild(statusBar);

  // Divider before choices
  layout.appendChild(createDivider('single'));

  // === Choices Area (3 lines) ===
  const choicesArea = document.createElement('nav');
  choicesArea.className = 'choices-area';
  choicesArea.setAttribute('role', 'menu');
  choicesArea.setAttribute('aria-label', 'Available choices');
  Object.assign(choicesArea.style, {
    minHeight: 'calc(3 * 1.2em)',
    padding: '0.3em 0',
  });

  const choiceElements: HTMLElement[] = [];

  function renderChoices(): void {
    choicesArea.innerHTML = '';
    choiceElements.length = 0;

    for (let i = 0; i < state.choices.length; i++) {
      const choice = state.choices[i];
      if (!choice) continue;
      const choiceEl = document.createElement('div');
      choiceEl.id = `choice-${choice.id}`;
      choiceEl.className = 'choice-item';
      choiceEl.setAttribute('role', 'menuitem');
      choiceEl.setAttribute('tabindex', i === selectedIndex ? '0' : '-1');
      choiceEl.setAttribute('aria-selected', i === selectedIndex ? 'true' : 'false');

      if (choice.disabled) {
        choiceEl.setAttribute('aria-disabled', 'true');
        choiceEl.title = choice.disabledReason || 'Unavailable';
      }

      updateChoiceItem(choiceEl, choice, i, i === selectedIndex);
      choiceElements.push(choiceEl);
      choicesArea.appendChild(choiceEl);

      // Mouse support - capture choice reference in closure
      const isDisabled = choice.disabled;
      choiceEl.addEventListener('mouseenter', () => {
        if (!isDisabled) {
          updateSelection(i);
        }
      });
      choiceEl.addEventListener('click', () => {
        if (!isDisabled) {
          handleConfirm(i);
        }
      });
    }
  }

  function updateChoiceItem(
    el: HTMLElement,
    choice: Choice,
    index: number,
    isSelected: boolean
  ): void {
    const marker = isSelected ? '\u25BA' : ' '; // ►
    const number = `[${index + 1}]`;

    if (choice.disabled) {
      el.innerHTML = `<span style="color: var(--color-text-disabled, #555555)">[-] ${number} ${choice.text}</span>`;
      el.style.backgroundColor = 'transparent';
    } else {
      el.innerHTML = `<span style="color: ${isSelected ? 'var(--color-selection-bg, #55FF55)' : 'var(--color-text-primary, #FFFFFF)'}">${marker} ${number} ${choice.text}</span>`;
      el.style.backgroundColor = isSelected ? 'rgba(85, 255, 85, 0.1)' : 'transparent';
    }
  }

  function updateSelection(newIndex: number): void {
    // Skip disabled choices
    const choice = state.choices[newIndex];
    if (!choice || choice.disabled) return;

    for (let i = 0; i < choiceElements.length; i++) {
      const choiceData = state.choices[i];
      const choiceEl = choiceElements[i];
      if (choiceData && choiceEl) {
        updateChoiceItem(choiceEl, choiceData, i, i === newIndex);
        choiceEl.setAttribute('aria-selected', i === newIndex ? 'true' : 'false');
        choiceEl.setAttribute('tabindex', i === newIndex ? '0' : '-1');
      }
    }
    selectedIndex = newIndex;
  }

  function handleConfirm(index: number): void {
    const choice = state.choices[index];
    if (choice && !choice.disabled) {
      callbacks.onChoiceSelect(choice.id);
    }
  }

  renderChoices();
  layout.appendChild(choicesArea);

  screen.appendChild(layout);

  // === Keyboard Navigation ===
  const keyboard = getKeyboardHandler();

  // Menu navigation for choices
  const navHandler: KeyHandler = createMenuNavigation({
    getSelectedIndex: () => selectedIndex,
    setSelectedIndex: (index) => {
      // Find next non-disabled choice
      let targetIndex = index;
      const direction = index > selectedIndex ? 1 : -1;
      while (state.choices[targetIndex]?.disabled) {
        targetIndex += direction;
        if (targetIndex < 0 || targetIndex >= state.choices.length) {
          return; // No valid choice in this direction
        }
      }
      updateSelection(targetIndex);
    },
    getItemCount: () => state.choices.length,
    onConfirm: handleConfirm,
    onCancel: callbacks.onPause,
  });
  unsubscribers.push(keyboard.onAny(navHandler));

  // Inventory shortcut
  unsubscribers.push(keyboard.on('inventory', () => {
    callbacks.onInventory();
  }));

  // Scrolling
  unsubscribers.push(keyboard.on('scrollUp', () => {
    textPanel.scrollBy({ top: -100, behavior: 'smooth' });
  }));
  unsubscribers.push(keyboard.on('scrollDown', () => {
    textPanel.scrollBy({ top: 100, behavior: 'smooth' });
  }));
  unsubscribers.push(keyboard.on('scrollTop', () => {
    textPanel.scrollTo({ top: 0, behavior: 'smooth' });
  }));
  unsubscribers.push(keyboard.on('scrollBottom', () => {
    textPanel.scrollTo({ top: textPanel.scrollHeight, behavior: 'smooth' });
  }));

  // Update function
  function update(newState: Partial<GameScreenState>): void {
    state = { ...state, ...newState };

    if (newState.chapterTitle !== undefined) {
      chapterTitle.textContent = state.chapterTitle;
    }

    if (newState.content !== undefined) {
      renderContent();
    }

    if (newState.choices !== undefined) {
      selectedIndex = 0;
      renderChoices();
    }

    if (
      newState.hp !== undefined ||
      newState.gold !== undefined ||
      newState.statusItems !== undefined
    ) {
      renderStatusBar();
    }
  }

  return {
    element: screen,
    update,
    destroy: () => {
      for (const unsub of unsubscribers) {
        unsub();
      }
      screen.remove();
    },
  };
}
