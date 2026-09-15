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
  overlay.className = 'ff-round-result-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Round over');

  const result = data.payout >= 0 ? 'ROUND COMPLETE' : 'ROUND OVER';
  const payoutLabel = data.payout >= 0 ? 'NET PAYOUT' : 'ROUND RESULT';
  const payoutText = `${data.payout >= 0 ? '+' : ''}${data.payout.toFixed(2)} SC`;

  overlay.innerHTML = `
    <div class="ff-round-result" tabindex="-1">
      <div class="ff-round-result-kicker">FISH FRENZY // COMBAT REPORT</div>
      <h2 class="ff-round-result-title">${result}</h2>
      <div class="ff-round-result-rule"></div>

      <div class="ff-round-result-stats">
        <div class="ff-result-stat">
          <span>SCORE</span>
          <strong>${data.score.toLocaleString()}</strong>
        </div>
        <div class="ff-result-stat">
          <span>KILLS</span>
          <strong>${data.kills}</strong>
        </div>
        <div class="ff-result-stat">
          <span>ACCURACY</span>
          <strong>${Math.round(data.accuracy * 100)}%</strong>
        </div>
        <div class="ff-result-stat">
          <span>MAX COMBO</span>
          <strong>${data.maxCombo}</strong>
        </div>
      </div>

      <div class="ff-round-payout">
        <span>${payoutLabel}</span>
        <strong>${payoutText}</strong>
      </div>

      <button id="ff-play-again" type="button" class="ff-arcade-btn ff-arcade-btn-primary ff-round-result-cta">
        REMATCH // PLAY AGAIN
      </button>
      <div class="ff-round-result-hint">ENTER / CLICK TO CONTINUE</div>
    </div>
  `;

  document.body.appendChild(overlay);

  const panel = overlay.querySelector<HTMLElement>('.ff-round-result');
  const playAgain = overlay.querySelector<HTMLButtonElement>('#ff-play-again');

  const closeAndPlay = () => {
    SoundManager.playUiSound('click');
    overlay.remove();
    window.removeEventListener('keydown', onKeyDown);
    data.onPlayAgain();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      closeAndPlay();
    }
  };

  playAgain?.addEventListener('click', closeAndPlay);
  window.addEventListener('keydown', onKeyDown);
  requestAnimationFrame(() => panel?.focus());
}
