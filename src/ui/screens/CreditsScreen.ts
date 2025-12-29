/**
 * Credits Screen
 *
 * Displays game attributions with scrollable content.
 * Accessible from Title Screen and Ending Screen per UI.md flow.
 *
 * Layout:
 * - Header with CREDITS title
 * - Scrollable content area showing audio credits, fonts, and special thanks
 * - Navigation back to Title with Esc or Enter
 */

import { BoxChars } from '../components/Screen';
import { getKeyboardHandler, type KeyHandler, type KeyEvent } from '../input/KeyboardHandler';

/**
 * Credits section for organized display
 */
interface CreditsSection {
  title: string;
  items: CreditsItem[];
}

interface CreditsItem {
  name: string;
  author: string;
  source?: string;
}

/**
 * Callbacks for credits screen navigation
 */
export interface CreditsScreenCallbacks {
  /** Called when player closes the credits screen */
  onClose: () => void;
}

/**
 * Credits screen instance
 */
export interface CreditsScreen {
  /** Root DOM element */
  element: HTMLElement;
  /** Clean up and remove the screen */
  destroy: () => void;
}

/**
 * Credits content parsed from CREDITS.md
 */
const CREDITS_CONTENT: CreditsSection[] = [
  {
    title: 'SOUND EFFECTS',
    items: [
      { name: 'UI Menu Sounds', author: 'phoenix1291', source: 'OpenGameArt' },
      { name: 'Menu Select', author: 'Fupi', source: 'OpenGameArt' },
      { name: 'Book/Inventory SFX', author: 'rubberduck', source: 'OpenGameArt' },
      { name: 'Victory/Game Over Jingles', author: 'Kenney', source: 'Kenney.nl' },
    ],
  },
  {
    title: 'MUSIC',
    items: [
      { name: 'Title, Exploration, Tension', author: 'Juhani Junkala', source: 'OpenGameArt' },
      { name: 'Victory', author: 'Wolfgang_', source: 'OpenGameArt' },
      { name: 'Defeat', author: 'Cleyton Kauffman', source: 'OpenGameArt' },
    ],
  },
  {
    title: 'SPECIAL THANKS',
    items: [
      { name: 'OpenGameArt.org', author: 'CC0 game assets community' },
      { name: 'Kenney.nl', author: 'Free game assets' },
      { name: 'Original gamebook source material', author: '' },
    ],
  },
];

/**
 * Creates a credits screen overlay
 */
export function createCreditsScreen(callbacks: CreditsScreenCallbacks): CreditsScreen {
  const unsubscribers: (() => void)[] = [];

  // Scroll state
  let scrollOffset = 0;
  const visibleLines = 14; // Lines visible in content area

  // Create overlay backdrop
  const overlay = document.createElement('div');
  overlay.className = 'credits-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Credits');
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '100',
  });

  // Create credits box (80 chars wide to match terminal)
  const menuWidth = 78;
  const innerWidth = menuWidth - 2;
  const menuBox = document.createElement('div');
  menuBox.className = 'credits-screen';
  Object.assign(menuBox.style, {
    width: `${menuWidth}ch`,
    backgroundColor: 'var(--color-bg-primary, #000)',
    color: 'var(--color-text-primary, #fff)',
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: 'var(--font-size-base, 16px)',
    lineHeight: '1.4',
  });

  // Build all content lines
  const allLines = buildContentLines(innerWidth);
  const maxScroll = Math.max(0, allLines.length - visibleLines);

  // Title bar (double border)
  const title = ' CREDITS ';
  const leftPad = Math.floor((innerWidth - title.length) / 2);
  const rightPad = innerWidth - leftPad - title.length;

  const titleBar = document.createElement('div');
  titleBar.innerHTML = `${BoxChars.dblTopLeft}${BoxChars.dblHorizontal.repeat(leftPad)}<span style="color: var(--color-header, #FFFF55)">${title}</span>${BoxChars.dblHorizontal.repeat(rightPad)}${BoxChars.dblTopRight}`;
  titleBar.style.color = 'var(--color-border, #AA5500)';
  menuBox.appendChild(titleBar);

  // Spacer line
  const spacer1 = document.createElement('div');
  spacer1.innerHTML = `<span style="color: var(--color-border, #AA5500)">${BoxChars.dblVertical}</span>${' '.repeat(innerWidth)}<span style="color: var(--color-border, #AA5500)">${BoxChars.dblVertical}</span>`;
  menuBox.appendChild(spacer1);

  // Content area
  const contentArea = document.createElement('div');
  contentArea.className = 'credits-content';
  contentArea.setAttribute('role', 'region');
  contentArea.setAttribute('aria-label', 'Credits content');
  Object.assign(contentArea.style, {
    overflow: 'hidden',
  });

  function renderContent(): void {
    contentArea.innerHTML = '';

    const visibleContent = allLines.slice(scrollOffset, scrollOffset + visibleLines);

    for (let i = 0; i < visibleLines; i++) {
      const line = visibleContent[i] || { text: '', style: 'normal' as const };
      const lineEl = document.createElement('div');

      // Pad line to fit width
      const paddedText = line.text + ' '.repeat(Math.max(0, innerWidth - line.text.length));
      let textColor = 'var(--color-text-primary, #fff)';

      if (line.style === 'header') {
        textColor = 'var(--color-header, #FFFF55)';
      } else if (line.style === 'secondary') {
        textColor = 'var(--color-text-secondary, #AAAAAA)';
      } else if (line.style === 'link') {
        textColor = 'var(--color-light-cyan, #55FFFF)';
      }

      lineEl.innerHTML = `<span style="color: var(--color-border, #AA5500)">${BoxChars.dblVertical}</span><span style="color: ${textColor}">${paddedText}</span><span style="color: var(--color-border, #AA5500)">${BoxChars.dblVertical}</span>`;
      contentArea.appendChild(lineEl);
    }
  }

  renderContent();
  menuBox.appendChild(contentArea);

  // Scroll indicators area
  const scrollArea = document.createElement('div');
  scrollArea.className = 'credits-scroll';

  function updateScrollIndicators(): void {
    scrollArea.innerHTML = '';

    const hasMoreAbove = scrollOffset > 0;
    const hasMoreBelow = scrollOffset < maxScroll;

    const upIndicator = hasMoreAbove ? '\u25B2' : ' '; // ▲
    const downIndicator = hasMoreBelow ? '\u25BC' : ' '; // ▼

    const scrollInfo = maxScroll > 0 ? ` ${scrollOffset + 1}-${Math.min(scrollOffset + visibleLines, allLines.length)}/${allLines.length} ` : '';
    const scrollInfoPad = Math.floor((innerWidth - scrollInfo.length - 2) / 2);

    const indicatorEl = document.createElement('div');
    indicatorEl.innerHTML = `<span style="color: var(--color-border, #AA5500)">${BoxChars.dblVertical}</span><span style="color: var(--color-text-secondary, #AAAAAA)"> ${upIndicator}${' '.repeat(scrollInfoPad)}${scrollInfo}${' '.repeat(innerWidth - scrollInfoPad - scrollInfo.length - 3)}${downIndicator} </span><span style="color: var(--color-border, #AA5500)">${BoxChars.dblVertical}</span>`;
    scrollArea.appendChild(indicatorEl);
  }

  updateScrollIndicators();
  menuBox.appendChild(scrollArea);

  // Divider
  const divider = document.createElement('div');
  divider.innerHTML = `<span style="color: var(--color-border, #AA5500)">${BoxChars.dblLeftT}${BoxChars.horizontal.repeat(innerWidth)}${BoxChars.dblRightT}</span>`;
  menuBox.appendChild(divider);

  // License notice
  const licenseEl = document.createElement('div');
  const licenseText = 'All audio licensed under CC0 (Creative Commons Zero)';
  const licensePad = Math.floor((innerWidth - licenseText.length) / 2);
  licenseEl.innerHTML = `<span style="color: var(--color-border, #AA5500)">${BoxChars.dblVertical}</span>${' '.repeat(licensePad)}<span style="color: var(--color-light-green, #55FF55)">${licenseText}</span>${' '.repeat(innerWidth - licensePad - licenseText.length)}<span style="color: var(--color-border, #AA5500)">${BoxChars.dblVertical}</span>`;
  menuBox.appendChild(licenseEl);

  // Spacer
  const spacer2 = document.createElement('div');
  spacer2.innerHTML = `<span style="color: var(--color-border, #AA5500)">${BoxChars.dblVertical}</span>${' '.repeat(innerWidth)}<span style="color: var(--color-border, #AA5500)">${BoxChars.dblVertical}</span>`;
  menuBox.appendChild(spacer2);

  // Bottom border
  const bottomBorder = document.createElement('div');
  bottomBorder.textContent = BoxChars.dblBottomLeft + BoxChars.dblHorizontal.repeat(innerWidth) + BoxChars.dblBottomRight;
  bottomBorder.style.color = 'var(--color-border, #AA5500)';
  menuBox.appendChild(bottomBorder);

  // Help text
  const helpText = document.createElement('div');
  helpText.className = 'credits-help';
  helpText.setAttribute('role', 'note');
  Object.assign(helpText.style, {
    textAlign: 'center',
    marginTop: '0.5em',
    color: 'var(--color-text-secondary, #AAAAAA)',
    fontSize: '0.9em',
  });
  helpText.textContent = '\u2191\u2193 Scroll    Esc/Enter: Back';
  menuBox.appendChild(helpText);

  overlay.appendChild(menuBox);

  // Keyboard navigation
  const keyboard = getKeyboardHandler();

  const keyHandler: KeyHandler = (event: KeyEvent) => {
    const { action } = event;

    switch (action) {
      case 'up':
        if (scrollOffset > 0) {
          scrollOffset--;
          renderContent();
          updateScrollIndicators();
        }
        break;

      case 'down':
        if (scrollOffset < maxScroll) {
          scrollOffset++;
          renderContent();
          updateScrollIndicators();
        }
        break;

      case 'scrollUp':
        scrollOffset = Math.max(0, scrollOffset - visibleLines);
        renderContent();
        updateScrollIndicators();
        break;

      case 'scrollDown':
        scrollOffset = Math.min(maxScroll, scrollOffset + visibleLines);
        renderContent();
        updateScrollIndicators();
        break;

      case 'scrollTop':
        scrollOffset = 0;
        renderContent();
        updateScrollIndicators();
        break;

      case 'scrollBottom':
        scrollOffset = maxScroll;
        renderContent();
        updateScrollIndicators();
        break;

      case 'confirm':
      case 'cancel':
        callbacks.onClose();
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

/**
 * Build content lines for scrollable display
 */
interface ContentLine {
  text: string;
  style: 'normal' | 'header' | 'secondary' | 'link';
}

function buildContentLines(_width: number): ContentLine[] {
  const lines: ContentLine[] = [];

  for (const section of CREDITS_CONTENT) {
    // Section header
    lines.push({ text: `  ${section.title}`, style: 'header' });
    lines.push({ text: `  ${'─'.repeat(section.title.length)}`, style: 'secondary' });
    lines.push({ text: '', style: 'normal' });

    // Items in section
    for (const item of section.items) {
      if (item.author) {
        const itemLine = `    ${item.name}`;
        lines.push({ text: itemLine, style: 'normal' });

        if (item.source) {
          const authorLine = `      by ${item.author} (${item.source})`;
          lines.push({ text: authorLine, style: 'secondary' });
        } else {
          const authorLine = `      ${item.author}`;
          lines.push({ text: authorLine, style: 'secondary' });
        }
      } else {
        // No author - just name (like "Original gamebook source material")
        lines.push({ text: `    ${item.name}`, style: 'normal' });
      }
    }

    lines.push({ text: '', style: 'normal' });
  }

  return lines;
}
