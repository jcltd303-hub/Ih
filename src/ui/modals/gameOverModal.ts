
import { SoundManager } from '../../audio/SoundManager';

export function showGameOverModal(data: {
  score: number;
  kills: number;
  accuracy: number;
  maxCombo: number;
  payout: number;
  onPlayAgain: () => void;
}): void {
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '10000',
    background: 'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-display, "Impact", sans-serif)',
  });

  overlay.innerHTML = `
    <div style="background:#090e1a; padding:32px; border:3px solid #38bdf8; border-radius:2px; text-align:center; color:#f8fafc; min-width:300px;">
      <h2 style="font-size:40px; color:#fff; margin-bottom:20px; text-shadow:0 0 10px #38bdf8;">ROUND OVER</h2>
      
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; text-align:left; margin-bottom:30px;">
        <div>
          <div style="font-size:11px; color:#94a3b8; letter-spacing:2px;">SCORE</div>
          <div style="font-size:24px; color:#38bdf8;">${data.score.toLocaleString()}</div>
        </div>
        <div>
          <div style="font-size:11px; color:#94a3b8; letter-spacing:2px;">KILLS</div>
          <div style="font-size:24px; color:#fbbf24;">${data.kills}</div>
        </div>
        <div>
          <div style="font-size:11px; color:#94a3b8; letter-spacing:2px;">ACCURACY</div>
          <div style="font-size:24px; color:#fff;">${Math.round(data.accuracy * 100)}%</div>
        </div>
        <div>
          <div style="font-size:11px; color:#94a3b8; letter-spacing:2px;">MAX COMBO</div>
          <div style="font-size:24px; color:#f8fafc;">${data.maxCombo}</div>
        </div>
        <div style="grid-column: span 2;">
          <div style="font-size:11px; color:#94a3b8; letter-spacing:2px;">PAYOUT</div>
          <div style="font-size:32px; color:#22c55e;">+${data.payout.toFixed(2)} SC</div>
        </div>
      </div>

      <button id="ff-play-again" style="width:100%; padding:12px; background:#38bdf8; color:#020617; border:none; font-size:18px; font-weight:900; cursor:pointer; font-style:italic;">[ PLAY AGAIN ]</button>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#ff-play-again')?.addEventListener('click', () => {
    SoundManager.playUiSound('click');
    document.body.removeChild(overlay);
    data.onPlayAgain();
  });
}
