/**
 * Options Screen
 *
 * Settings menu for audio, display, and control preferences.
 * Accessible from Title Screen and Pause Menu per UI.md.
 *
 * Layout (per UI.md lines 392-417):
 * - AUDIO: Master/Music/SFX volume sliders, Mute toggle [M], Test Sound
 * - DISPLAY: Text Speed, Screen Shake toggle
 * - CONTROLS: Show Hotkeys toggle
 */

import { BoxChars } from '../components/Screen';
import { getKeyboardHandler, type KeyHandler, type KeyEvent } from '../input/KeyboardHandler';
import { getSettingsService, type TextSpeed } from '../../services/SettingsService';

export interface OptionsScreenCallbacks {
  onBack: () => void;
  onTestSound?: () => void;
}

export interface OptionsScreen {
  element: HTMLElement;
  destroy: () => void;
}

// Menu items configuration
type SettingType = 'slider' | 'toggle' | 'select' | 'action';

interface MenuItemBase {
  id: string;
  label: string;
  type: SettingType;
  section: 'audio' | 'display' | 'controls';
}

interface SliderItem extends MenuItemBase {
  type: 'slider';
  getValue: () => number;
  setValue: (value: number) => void;
  min: number;
  max: number;
  step: number;
}

interface ToggleItem extends MenuItemBase {
  type: 'toggle';
  getValue: () => boolean;
  setValue: (value: boolean) => void;
}

interface SelectItem extends MenuItemBase {
  type: 'select';
  options: { value: string; label: string }[];
  getValue: () => string;
  setValue: (value: string) => void;
}

interface ActionItem extends MenuItemBase {
  type: 'action';
  action: () => void;
}

type MenuItem = SliderItem | ToggleItem | SelectItem | ActionItem;

const TEXT_SPEED_OPTIONS: { value: TextSpeed; label: string }[] = [
  { value: 'instant', label: 'INSTANT' },
  { value: 'fast', label: 'FAST' },
  { value: 'normal', label: 'NORMAL' },
  { value: 'slow', label: 'SLOW' },
];

/**
 * Creates an options screen overlay
 */
export function createOptionsScreen(callbacks: OptionsScreenCallbacks): OptionsScreen {
  const settings = getSettingsService();
  let selectedIndex = 0;
  const unsubscribers: (() => void)[] = [];

  // Build menu items from settings service
  const menuItems: MenuItem[] = [
    // Audio section
    {
      id: 'masterVolume',
      label: 'Master Volume',
      type: 'slider',
      section: 'audio',
      getValue: () => settings.get('masterVolume'),
      setValue: (v) => settings.set('masterVolume', v),
      min: 0,
      max: 100,
      step: 10,
    },
    {
      id: 'musicVolume',
      label: 'Music Volume',
      type: 'slider',
      section: 'audio',
      getValue: () => settings.get('musicVolume'),
      setValue: (v) => settings.set('musicVolume', v),
      min: 0,
      max: 100,
      step: 10,
    },
    {
      id: 'sfxVolume',
      label: 'SFX Volume',
      type: 'slider',
      section: 'audio',
      getValue: () => settings.get('sfxVolume'),
      setValue: (v) => settings.set('sfxVolume', v),
      min: 0,
      max: 100,
      step: 10,
    },
    {
      id: 'muted',
      label: 'Mute',
      type: 'toggle',
      section: 'audio',
      getValue: () => settings.get('muted'),
      setValue: (v) => settings.set('muted', v),
    },
    {
      id: 'testSound',
      label: 'Test Sound',
      type: 'action',
      section: 'audio',
      action: () => callbacks.onTestSound?.(),
    },
    // Display section
    {
      id: 'textSpeed',
      label: 'Text Speed',
      type: 'select',
      section: 'display',
      options: TEXT_SPEED_OPTIONS,
      getValue: () => settings.get('textSpeed'),
      setValue: (v) => settings.set('textSpeed', v as TextSpeed),
    },
    {
      id: 'screenShake',
      label: 'Screen Shake',
      type: 'toggle',
      section: 'display',
      getValue: () => settings.get('screenShake'),
      setValue: (v) => settings.set('screenShake', v),
    },
    // Controls section
    {
      id: 'showHotkeys',
      label: 'Show Hotkeys',
      type: 'toggle',
      section: 'controls',
      getValue: () => settings.get('showHotkeys'),
      setValue: (v) => settings.set('showHotkeys', v),
    },
  ];

  // Create overlay backdrop
  const overlay = document.createElement('div');
  overlay.className = 'options-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Options Menu');
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '100',
  });

  // Create options box (80 chars wide to match terminal)
  const menuWidth = 78;
  const menuBox = document.createElement('div');
  menuBox.className = 'options-menu';
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
  const title = ' OPTIONS ';
  const leftPad = Math.floor((innerWidth - title.length) / 2);
  const rightPad = innerWidth - leftPad - title.length;

  const titleBar = document.createElement('div');
  titleBar.innerHTML = `${BoxChars.dblTopLeft}${BoxChars.dblHorizontal.repeat(leftPad)}<span style="color: var(--color-header, #FFFF55)">${title}</span>${BoxChars.dblHorizontal.repeat(rightPad)}${BoxChars.dblTopRight}`;
  titleBar.style.color = 'var(--color-border, #AA5500)';
  menuBox.appendChild(titleBar);

  // Content area
  const contentArea = document.createElement('div');
  contentArea.className = 'options-content';
  Object.assign(contentArea.style, {
    padding: '0.5em 0',
  });

  const menuElements: HTMLElement[] = [];
  let currentSection = '';

  function renderMenu(): void {
    contentArea.innerHTML = '';
    menuElements.length = 0;
    currentSection = '';

    for (let i = 0; i < menuItems.length; i++) {
      const item = menuItems[i];
      if (!item) continue;

      // Add section header if new section
      if (item.section !== currentSection) {
        currentSection = item.section;
        const sectionHeader = document.createElement('div');
        sectionHeader.className = 'options-section-header';
        Object.assign(sectionHeader.style, {
          padding: '0.3em 2ch',
          color: 'var(--color-text-secondary, #AAAAAA)',
        });
        const sectionTitle = item.section.toUpperCase();
        sectionHeader.innerHTML = `<span style="color: var(--color-border, #AA5500)">${BoxChars.dblVertical}</span> <span style="color: var(--color-header, #FFFF55)">${sectionTitle}</span>`;
        contentArea.appendChild(sectionHeader);

        // Underline
        const underline = document.createElement('div');
        Object.assign(underline.style, {
          padding: '0 2ch',
          color: 'var(--color-border, #AA5500)',
        });
        underline.innerHTML = `<span>${BoxChars.dblVertical}</span> <span style="color: var(--color-text-secondary, #AAAAAA)">${'\u2500'.repeat(sectionTitle.length)}</span>`;
        contentArea.appendChild(underline);
      }

      // Create menu item
      const itemEl = document.createElement('div');
      itemEl.className = 'options-menu-item';
      itemEl.setAttribute('role', 'menuitem');
      itemEl.setAttribute('tabindex', i === selectedIndex ? '0' : '-1');
      itemEl.setAttribute('data-id', item.id);
      Object.assign(itemEl.style, {
        padding: '0.2em 2ch',
        cursor: 'pointer',
      });

      updateMenuItem(itemEl, item, i === selectedIndex);
      menuElements.push(itemEl);
      contentArea.appendChild(itemEl);

      // Mouse support
      const index = i;
      itemEl.addEventListener('mouseenter', () => updateSelection(index));
      itemEl.addEventListener('click', () => handleConfirm());
    }
  }

  function updateMenuItem(el: HTMLElement, item: MenuItem, isSelected: boolean): void {
    const marker = isSelected ? '\u25BA' : ' '; // ►
    const markerColor = isSelected ? 'var(--color-selection, #55FF55)' : 'var(--color-text-primary, #fff)';
    const labelColor = isSelected ? 'var(--color-selection, #55FF55)' : 'var(--color-text-primary, #fff)';

    let valueDisplay = '';

    switch (item.type) {
      case 'slider': {
        const value = item.getValue();
        const bars = Math.round(value / 10);
        const filled = '\u2588'.repeat(bars);       // █
        const empty = '\u2591'.repeat(10 - bars);   // ░
        const muteIndicator = item.id === 'masterVolume' && settings.get('muted') ? ' [M] Mute' : '';
        valueDisplay = `[${filled}${empty}] ${value}%${muteIndicator}`;
        break;
      }
      case 'toggle': {
        const value = item.getValue();
        valueDisplay = value ? '[ON] OFF' : 'ON [OFF]';
        break;
      }
      case 'select': {
        const value = item.getValue();
        const options = item.options.map(opt => {
          if (opt.value === value) {
            return `[${opt.label}]`;
          }
          return opt.label;
        }).join('  ');
        valueDisplay = options;
        break;
      }
      case 'action': {
        valueDisplay = `[${item.label.toUpperCase()}]`;
        break;
      }
    }

    // Format: ║ ► Label:          [value display]
    const labelPart = item.type === 'action' ? '' : `${item.label}:`;
    const spacing = ' '.repeat(Math.max(1, 18 - labelPart.length));

    el.innerHTML = `<span style="color: var(--color-border, #AA5500)">${BoxChars.dblVertical}</span> <span style="color: ${markerColor}">${marker}</span> <span style="color: ${labelColor}">${labelPart}${spacing}${valueDisplay}</span>`;
    el.style.backgroundColor = isSelected ? 'rgba(85, 255, 85, 0.1)' : 'transparent';
  }

  function updateSelection(newIndex: number): void {
    for (let i = 0; i < menuElements.length; i++) {
      const el = menuElements[i];
      const item = menuItems[i];
      if (el && item) {
        updateMenuItem(el, item, i === newIndex);
        el.setAttribute('tabindex', i === newIndex ? '0' : '-1');
      }
    }
    selectedIndex = newIndex;
  }

  function handleValueChange(direction: 'left' | 'right'): void {
    const item = menuItems[selectedIndex];
    if (!item) return;

    switch (item.type) {
      case 'slider': {
        const current = item.getValue();
        const delta = direction === 'right' ? item.step : -item.step;
        const newValue = Math.max(item.min, Math.min(item.max, current + delta));
        item.setValue(newValue);
        break;
      }
      case 'toggle': {
        item.setValue(!item.getValue());
        break;
      }
      case 'select': {
        const currentValue = item.getValue();
        const currentIdx = item.options.findIndex(opt => opt.value === currentValue);
        let newIdx = currentIdx;
        if (direction === 'right') {
          newIdx = (currentIdx + 1) % item.options.length;
        } else {
          newIdx = (currentIdx - 1 + item.options.length) % item.options.length;
        }
        const newOption = item.options[newIdx];
        if (newOption) {
          item.setValue(newOption.value);
        }
        break;
      }
      case 'action':
        // No value change for actions
        break;
    }

    // Re-render the current item
    const el = menuElements[selectedIndex];
    if (el && item) {
      updateMenuItem(el, item, true);
    }
  }

  function handleConfirm(): void {
    const item = menuItems[selectedIndex];
    if (!item) return;

    switch (item.type) {
      case 'toggle':
        item.setValue(!item.getValue());
        break;
      case 'action':
        item.action();
        break;
      case 'slider':
      case 'select':
        // For sliders and selects, Enter cycles forward (like right arrow)
        handleValueChange('right');
        break;
    }

    // Re-render the current item
    const el = menuElements[selectedIndex];
    if (el && item) {
      updateMenuItem(el, item, true);
    }
  }

  renderMenu();
  menuBox.appendChild(contentArea);

  // Bottom border
  const bottomBorder = document.createElement('div');
  bottomBorder.textContent = BoxChars.dblBottomLeft + BoxChars.dblHorizontal.repeat(innerWidth) + BoxChars.dblBottomRight;
  bottomBorder.style.color = 'var(--color-border, #AA5500)';
  menuBox.appendChild(bottomBorder);

  // Help text
  const helpText = document.createElement('div');
  helpText.className = 'options-help';
  helpText.setAttribute('role', 'note');
  Object.assign(helpText.style, {
    textAlign: 'center',
    marginTop: '0.5em',
    color: 'var(--color-text-secondary, #AAAAAA)',
    fontSize: '0.9em',
  });
  helpText.textContent = '\u2190\u2192 Adjust    Enter: Toggle    Esc: Back';
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
          updateSelection(menuItems.length - 1);
        }
        break;

      case 'down':
        if (selectedIndex < menuItems.length - 1) {
          updateSelection(selectedIndex + 1);
        } else {
          updateSelection(0);
        }
        break;

      case 'left':
        handleValueChange('left');
        break;

      case 'right':
        handleValueChange('right');
        break;

      case 'confirm':
        handleConfirm();
        break;

      case 'cancel':
        callbacks.onBack();
        break;

      case 'mute':
        // Global mute toggle
        settings.toggleMute();
        // Re-render all volume sliders to show mute state
        renderMenu();
        updateSelection(selectedIndex);
        break;

      case 'volumeUp':
        settings.adjustMasterVolume(10);
        // Re-render master volume if we're not on it
        renderMenu();
        updateSelection(selectedIndex);
        break;

      case 'volumeDown':
        settings.adjustMasterVolume(-10);
        renderMenu();
        updateSelection(selectedIndex);
        break;
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
