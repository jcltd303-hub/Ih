/**
 * Arcade Combat UI Tokens (Street Fighter II / 90s Arcade Aesthetic)
 * Sharp 2px corners, technical thin borders, metallic/slate panels,
 * high-contrast fighting-game typography and restrained accents.
 */

export const ARCADE = {
  bg: '#05070f',
  panel: '#090d18',
  panelHeader: '#0e1424',
  panelSurface: '#121a2f',
  border: '#334155',
  borderLight: '#64748b',
  borderAccent: '#38bdf8',
  borderGold: '#f59e0b',
  borderCrimson: '#ef4444',

  // Arcade Palette
  yellow: '#facc15',
  gold: '#fbbf24',
  cyan: '#22d3ee',
  cyanBright: '#67e8f9',
  crimson: '#ef4444',
  crimsonDark: '#991b1b',
  green: '#10b981',
  slateDark: '#0f172a',
  slateMuted: '#94a3b8',
  text: '#f8fafc',
  textMuted: '#94a3b8',

  // Typography
  fontDisplay: `'Impact', 'Arial Black', -apple-system, system-ui, sans-serif`,
  fontMono: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`,

  // Standardized Arcade Panel Generator
  arcadePanel: (
    content: string,
    opts?: {
      id?: string;
      padding?: string;
      variant?: 'default' | 'surface' | 'header';
    }
  ) => {
    const variant = opts?.variant || 'default';
    let bg = ARCADE.panel;
    let border = ARCADE.border;

    if (variant === 'surface') {
      bg = ARCADE.panelSurface;
      border = ARCADE.borderLight;
    } else if (variant === 'header') {
      bg = ARCADE.panelHeader;
      border = ARCADE.borderAccent;
    }

    return `
      <div ${opts?.id ? `id="${opts.id}"` : ''} style="
        background:${bg};
        border:2px solid ${border};
        border-radius:2px;
        padding:${opts?.padding || '12px'};
        box-shadow:4px 4px 0 #020617;
      ">
        ${content}
      </div>
    `;
  },

  // Standard Arcade Button Generator
  arcadeButton: (
    label: string,
    opts?: {
      id?: string;
      variant?: 'primary' | 'cyan' | 'crimson' | 'slate' | 'gold';
      fullWidth?: boolean;
      size?: 'sm' | 'md' | 'lg';
      icon?: string;
    }
  ) => {
    const variant = opts?.variant || 'primary';
    const size = opts?.size || 'md';

    let bg = '#1e293b';
    let text = '#f8fafc';
    let border = '#64748b';
    let shadow = '#020617';

    if (variant === 'primary' || variant === 'gold') {
      bg = '#d97706';
      text = '#ffffff';
      border = '#fbbf24';
      shadow = '#78350f';
    } else if (variant === 'cyan') {
      bg = '#0284c7';
      text = '#ffffff';
      border = '#38bdf8';
      shadow = '#0c4a6e';
    } else if (variant === 'crimson') {
      bg = '#b91c1c';
      text = '#ffffff';
      border = '#f87171';
      shadow = '#450a0a';
    } else if (variant === 'slate') {
      bg = '#1e293b';
      text = '#e2e8f0';
      border = '#475569';
      shadow = '#020617';
    }

    const padding =
      size === 'sm' ? '6px 12px' : size === 'lg' ? '14px 24px' : '10px 18px';
    const fontSize = size === 'sm' ? '12px' : size === 'lg' ? '16px' : '13px';

    return `
      <button type="button" ${opts?.id ? `id="${opts.id}"` : ''} class="ff-arcade-btn" style="
        ${opts?.fullWidth ? 'width:100%;' : ''}
        background:${bg};
        color:${text};
        border:2px solid ${border};
        border-radius:2px;
        padding:${padding};
        font-size:${fontSize};
        font-family:${ARCADE.fontDisplay};
        font-style:italic;
        letter-spacing:1px;
        text-transform:uppercase;
        font-weight:900;
        cursor:pointer;
        box-shadow:2px 2px 0 ${shadow};
        transition:transform 0.06s ease, filter 0.08s ease;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:6px;
      ">
        ${opts?.icon ? `<span>${opts.icon}</span>` : ''}
        <span>${label}</span>
      </button>
    `;
  }
}

// Backward-compatible alias for existing imports
export const ER = {
  ...ARCADE,
  bevelButton: (label: string, opts?: { id?: string; fullWidth?: boolean; danger?: boolean }) => {
    return ARCADE.arcadeButton(label, {
      id: opts?.id,
      variant: opts?.danger ? 'crimson' : 'cyan',
      fullWidth: opts?.fullWidth
    });
  }
};
