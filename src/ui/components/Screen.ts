/**
 * Screen Component
 *
 * Base wrapper for all game screens with 80x24 terminal constraints
 * and DOS-style border styling.
 */

/** Box drawing characters for borders */
export const BoxChars = {
  // Single line
  horizontal: '\u2500',      // ─
  vertical: '\u2502',        // │
  topLeft: '\u250C',         // ┌
  topRight: '\u2510',        // ┐
  bottomLeft: '\u2514',      // └
  bottomRight: '\u2518',     // ┘
  leftT: '\u251C',           // ├
  rightT: '\u2524',          // ┤
  topT: '\u252C',            // ┬
  bottomT: '\u2534',         // ┴
  cross: '\u253C',           // ┼
  // Double line
  dblHorizontal: '\u2550',   // ═
  dblVertical: '\u2551',     // ║
  dblTopLeft: '\u2554',      // ╔
  dblTopRight: '\u2557',     // ╗
  dblBottomLeft: '\u255A',   // ╚
  dblBottomRight: '\u255D',  // ╝
  dblLeftT: '\u2560',        // ╠
  dblRightT: '\u2563',       // ╣
  dblTopT: '\u2566',         // ╦
  dblBottomT: '\u2569',      // ╩
  dblCross: '\u256C',        // ╬
  // Mixed (double to single transitions)
  mixedTopLeft: '\u2554',    // ╔
  mixedDivider: '\u2560',    // ╠ (double vertical, single horizontal junction)
} as const;

export interface ScreenOptions {
  title?: string;
  showBorder?: boolean;
  borderStyle?: 'single' | 'double';
  ariaLabel?: string;
}

export interface ScreenSection {
  id: string;
  content: string;
  ariaLabel?: string;
}

/**
 * Creates a Screen container element with DOS-style constraints
 */
export function createScreen(options: ScreenOptions = {}): HTMLElement {
  const {
    title,
    showBorder = true,
    borderStyle = 'double',
    ariaLabel
  } = options;

  const screen = document.createElement('div');
  screen.className = 'dos-screen';
  screen.setAttribute('role', 'main');
  if (ariaLabel) {
    screen.setAttribute('aria-label', ariaLabel);
  }
  screen.tabIndex = 0;

  // Apply inline styles for terminal constraints
  Object.assign(screen.style, {
    width: '80ch',
    maxWidth: '100%',
    height: 'calc(24 * 1.2em)',
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: 'var(--font-size-base, 16px)',
    lineHeight: '1.2',
    backgroundColor: 'var(--color-bg-primary, #000)',
    color: 'var(--color-text-primary, #fff)',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
    // Add padding to prevent content overlapping with border ornaments
    paddingTop: showBorder ? '1.2em' : '0',
    paddingBottom: showBorder ? '1.2em' : '0',
    boxSizing: 'border-box',
  });

  if (showBorder) {
    const chars = borderStyle === 'double' ? {
      h: BoxChars.dblHorizontal,
      v: BoxChars.dblVertical,
      tl: BoxChars.dblTopLeft,
      tr: BoxChars.dblTopRight,
      bl: BoxChars.dblBottomLeft,
      br: BoxChars.dblBottomRight,
    } : {
      h: BoxChars.horizontal,
      v: BoxChars.vertical,
      tl: BoxChars.topLeft,
      tr: BoxChars.topRight,
      bl: BoxChars.bottomLeft,
      br: BoxChars.bottomRight,
    };

    // Create border using pseudo-elements via a wrapper
    const borderWrapper = document.createElement('div');
    borderWrapper.className = 'screen-border';
    Object.assign(borderWrapper.style, {
      position: 'absolute',
      inset: '0',
      pointerEvents: 'none',
      color: 'var(--color-border, #AA5500)',
    });

    // Top border with optional title
    const topBorder = document.createElement('div');
    topBorder.className = 'border-top';
    const innerWidth = 78; // 80 - 2 for corners
    if (title) {
      const paddedTitle = ` ${title} `;
      const leftPad = Math.floor((innerWidth - paddedTitle.length) / 2);
      const rightPad = innerWidth - leftPad - paddedTitle.length;
      topBorder.textContent = chars.tl +
        chars.h.repeat(leftPad) +
        paddedTitle +
        chars.h.repeat(rightPad) +
        chars.tr;
      // Style the title portion differently
      topBorder.innerHTML = `${chars.tl}${chars.h.repeat(leftPad)}<span style="color: var(--color-header, #FFFF55)">${paddedTitle}</span>${chars.h.repeat(rightPad)}${chars.tr}`;
    } else {
      topBorder.textContent = chars.tl + chars.h.repeat(innerWidth) + chars.tr;
    }
    borderWrapper.appendChild(topBorder);

    // Side borders are handled by content padding

    // Bottom border
    const bottomBorder = document.createElement('div');
    bottomBorder.className = 'border-bottom';
    bottomBorder.style.position = 'absolute';
    bottomBorder.style.bottom = '0';
    bottomBorder.style.left = '0';
    bottomBorder.style.right = '0';
    bottomBorder.textContent = chars.bl + chars.h.repeat(innerWidth) + chars.br;
    borderWrapper.appendChild(bottomBorder);

    screen.appendChild(borderWrapper);
  }

  return screen;
}

/**
 * Creates a content area within a screen
 */
export function createContentArea(id: string, ariaLabel?: string): HTMLElement {
  const content = document.createElement('div');
  content.id = id;
  content.className = 'screen-content';
  if (ariaLabel) {
    content.setAttribute('aria-label', ariaLabel);
  }
  Object.assign(content.style, {
    flex: '1',
    padding: '0 1ch',
    overflow: 'hidden',
    position: 'relative',
  });
  return content;
}

/**
 * Creates a horizontal divider line
 */
export function createDivider(style: 'single' | 'double' = 'single'): HTMLElement {
  const divider = document.createElement('div');
  divider.className = 'screen-divider';
  divider.setAttribute('role', 'separator');
  const char = style === 'double' ? BoxChars.dblHorizontal : BoxChars.horizontal;
  divider.textContent = char.repeat(78);
  Object.assign(divider.style, {
    color: 'var(--color-border, #AA5500)',
    padding: '0 1ch',
  });
  return divider;
}

/**
 * Creates a status bar at the bottom of the screen
 */
export function createStatusBar(): HTMLElement {
  const statusBar = document.createElement('div');
  statusBar.className = 'status-bar';
  statusBar.setAttribute('role', 'status');
  statusBar.setAttribute('aria-live', 'polite');
  Object.assign(statusBar.style, {
    height: '1.2em',
    padding: '0 1ch',
    backgroundColor: 'var(--color-bg-secondary, #0000AA)',
    color: 'var(--color-text-secondary, #AAAAAA)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'nowrap',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    gap: '2ch',
  });
  return statusBar;
}

/**
 * Creates an input/choices area at the bottom
 */
export function createInputArea(): HTMLElement {
  const inputArea = document.createElement('div');
  inputArea.className = 'input-area';
  inputArea.setAttribute('role', 'navigation');
  inputArea.setAttribute('aria-label', 'Choices');
  Object.assign(inputArea.style, {
    minHeight: 'calc(3 * 1.2em)',
    padding: '0 1ch',
  });
  return inputArea;
}
