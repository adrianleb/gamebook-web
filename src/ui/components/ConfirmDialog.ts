/**
 * Confirm Dialog Component
 *
 * Modal confirmation dialog for destructive actions.
 * Per UI.md: centered dialog box with Yes/No buttons.
 */

import { BoxChars } from './Screen';
import { getKeyboardHandler, type KeyHandler } from '../input/KeyboardHandler';

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'error' | 'success' | 'info';
}

export interface ConfirmDialog {
  element: HTMLElement;
  destroy: () => void;
  show: () => Promise<boolean>;
}

/**
 * Creates a confirmation dialog overlay
 */
export function createConfirmDialog(options: ConfirmDialogOptions): ConfirmDialog {
  const {
    title = 'CONFIRM',
    message,
    confirmText = 'YES',
    cancelText = 'NO',
    type = 'warning',
  } = options;

  let selectedIndex = 1; // Default to NO for safety
  let resolvePromise: ((value: boolean) => void) | null = null;
  const unsubscribers: (() => void)[] = [];

  // Color based on type
  const typeColors = {
    warning: 'var(--color-warning, #FFFF55)',
    error: 'var(--color-error, #FF5555)',
    success: 'var(--color-success, #55FF55)',
    info: 'var(--color-light-cyan, #55FFFF)',
  };
  const typePrefix = {
    warning: '[!]',
    error: '[!]',
    success: '[\u2713]',
    info: '[i]',
  };

  // Create overlay backdrop
  const overlay = document.createElement('div');
  overlay.className = 'confirm-dialog-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'confirm-dialog-title');
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '200',
  });

  // Create dialog box
  const dialogWidth = 55;
  const dialog = document.createElement('div');
  dialog.className = 'confirm-dialog';
  Object.assign(dialog.style, {
    width: `${dialogWidth}ch`,
    backgroundColor: 'var(--color-bg-primary, #000)',
    color: 'var(--color-text-primary, #fff)',
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: 'var(--font-size-base, 16px)',
    lineHeight: '1.2',
    border: `1px solid var(--color-border, #AA5500)`,
  });

  // Title bar
  const titleBar = document.createElement('div');
  titleBar.id = 'confirm-dialog-title';
  const titleText = ` ${typePrefix[type]} ${title} `;
  const innerWidth = dialogWidth - 2;
  const leftPad = Math.floor((innerWidth - titleText.length) / 2);
  const rightPad = innerWidth - leftPad - titleText.length;
  titleBar.innerHTML = `${BoxChars.topLeft}${BoxChars.horizontal.repeat(leftPad)}<span style="color: ${typeColors[type]}">${titleText}</span>${BoxChars.horizontal.repeat(rightPad)}${BoxChars.topRight}`;
  titleBar.style.color = 'var(--color-border, #AA5500)';
  dialog.appendChild(titleBar);

  // Message area
  const messageArea = document.createElement('div');
  messageArea.className = 'dialog-message';
  Object.assign(messageArea.style, {
    padding: '1em 2ch',
    textAlign: 'center',
  });

  // Split message into lines
  const messageLines = message.split('\n');
  for (const line of messageLines) {
    const p = document.createElement('p');
    p.textContent = line;
    p.style.margin = '0.5em 0';
    messageArea.appendChild(p);
  }
  dialog.appendChild(messageArea);

  // Buttons area
  const buttonsArea = document.createElement('div');
  buttonsArea.className = 'dialog-buttons';
  buttonsArea.setAttribute('role', 'group');
  Object.assign(buttonsArea.style, {
    display: 'flex',
    justifyContent: 'center',
    gap: '4ch',
    padding: '1em 2ch',
  });

  const buttons = [
    { text: confirmText, value: true },
    { text: cancelText, value: false },
  ];

  const buttonElements: HTMLElement[] = [];

  function renderButtons(): void {
    buttonsArea.innerHTML = '';
    buttonElements.length = 0;

    for (let i = 0; i < buttons.length; i++) {
      const btn = document.createElement('button');
      btn.className = 'dialog-button';
      btn.setAttribute('role', 'button');
      btn.setAttribute('tabindex', i === selectedIndex ? '0' : '-1');
      Object.assign(btn.style, {
        background: 'none',
        border: 'none',
        font: 'inherit',
        cursor: 'pointer',
        padding: '0 1ch',
      });
      const buttonData = buttons[i];
      if (!buttonData) continue;

      updateButton(btn, buttonData.text, i === selectedIndex);
      buttonElements.push(btn);
      buttonsArea.appendChild(btn);

      const buttonValue = buttonData.value;
      btn.addEventListener('click', () => {
        if (resolvePromise) {
          resolvePromise(buttonValue);
          resolvePromise = null;
        }
      });
    }
  }

  function updateButton(el: HTMLElement, text: string, isSelected: boolean): void {
    const marker = isSelected ? '\u25BA' : ' '; // ►
    const color = isSelected ? 'var(--color-selection, #55FF55)' : 'var(--color-text-primary, #fff)';
    el.innerHTML = `<span style="color: ${color}">${marker} [${text}]</span>`;
  }

  function updateSelection(newIndex: number): void {
    for (let i = 0; i < buttonElements.length; i++) {
      const btn = buttonElements[i];
      const buttonData = buttons[i];
      if (btn && buttonData) {
        updateButton(btn, buttonData.text, i === newIndex);
        btn.setAttribute('tabindex', i === newIndex ? '0' : '-1');
      }
    }
    selectedIndex = newIndex;
    buttonElements[selectedIndex]?.focus();
  }

  renderButtons();
  dialog.appendChild(buttonsArea);

  // Bottom border
  const bottomBorder = document.createElement('div');
  bottomBorder.textContent = BoxChars.bottomLeft + BoxChars.horizontal.repeat(innerWidth) + BoxChars.bottomRight;
  bottomBorder.style.color = 'var(--color-border, #AA5500)';
  dialog.appendChild(bottomBorder);

  overlay.appendChild(dialog);

  // Keyboard navigation
  const keyboard = getKeyboardHandler();

  const navHandler: KeyHandler = (event) => {
    switch (event.action) {
      case 'left':
        if (selectedIndex > 0) {
          updateSelection(selectedIndex - 1);
        }
        break;
      case 'right':
        if (selectedIndex < buttons.length - 1) {
          updateSelection(selectedIndex + 1);
        }
        break;
      case 'confirm':
        if (resolvePromise) {
          const selectedButton = buttons[selectedIndex];
          if (selectedButton) {
            resolvePromise(selectedButton.value);
            resolvePromise = null;
          }
        }
        break;
      case 'cancel':
        if (resolvePromise) {
          resolvePromise(false);
          resolvePromise = null;
        }
        break;
    }
  };

  return {
    element: overlay,
    destroy: () => {
      for (const unsub of unsubscribers) {
        unsub();
      }
      overlay.remove();
    },
    show: () => {
      return new Promise<boolean>((resolve) => {
        resolvePromise = (value: boolean) => {
          for (const unsub of unsubscribers) {
            unsub();
          }
          overlay.remove();
          resolve(value);
        };

        document.body.appendChild(overlay);
        unsubscribers.push(keyboard.onAny(navHandler));
        const selectedBtn = buttonElements[selectedIndex];
        if (selectedBtn) {
          selectedBtn.focus();
        }
      });
    },
  };
}
