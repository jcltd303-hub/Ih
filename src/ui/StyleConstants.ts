/** Electric Rage shared UI tokens */
export const ER = {
  bg: '#0b1224',
  panel: '#0f172a',
  panel2: '#1e293b',
  border: '#334155',
  cyan: '#22d3ee',
  cyanBright: '#67e8f9',
  pink: '#ff007f',
  gold: '#fbbf24',
  green: '#34d399',
  text: '#e2e8f0',
  muted: '#94a3b8',
  font: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  bevelButton: (
    label: string,
    opts?: { id?: string; fullWidth?: boolean; danger?: boolean }
  ) => {
    const bg = opts?.danger
      ? 'linear-gradient(180deg,#9f1239,#be123c)'
      : 'linear-gradient(180deg,#155e75,#0e7490)';
    const border = opts?.danger ? '#fb7185' : '#22d3ee';
    return `<button type="button" ${opts?.id ? `id="${opts.id}"` : ''} style="
      ${opts?.fullWidth ? 'width:100%;' : ''}
      background:${bg}; color:#ecfeff; border:2px solid ${border};
      padding:12px 18px; border-radius:10px; font-weight:900; letter-spacing:1px;
      cursor:pointer; font-family:ui-monospace,monospace; font-size:13px;
      box-shadow:0 4px 0 #083344, 0 0 16px rgba(34,211,238,0.25);
    ">${label}</button>`;
  }
} as const;
