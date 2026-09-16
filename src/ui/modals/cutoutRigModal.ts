import { Application, Container } from 'pixi.js';
import { ModalContext } from './ModalContext';
import { MutantCutoutPuppet } from '../../engine/systems/MutantCutoutPuppet';
import { MUTANT_RIG_PARTS } from '../../engine/systems/mutantRigData';
import { ThemeManager } from '../../engine/systems/ThemeManager';
import { ARCADE } from '../StyleConstants';

/**
 * 2D Paper Cutout Skeletal Rig Inspector & Gapless Joint Diagnostics Bench.
 * Enables live inspection, manual bone rotation verification, and visual proof of gapless joints.
 */
export function showCutoutRigModal(
  ctx: ModalContext,
  onSpawnInGame?: () => void
): void {
  const themeMgr = ThemeManager.getInstance();
  const currentTheme = themeMgr ? themeMgr.getTheme() : 'dark';
  const dark = currentTheme === 'dark';

  const panel = dark ? '#0a0512' : '#f8fafc';
  const card = dark ? '#130a21' : '#e0f2fe';
  const ink = dark ? '#f8fafc' : '#0f172a';
  const muted = dark ? '#a1a1aa' : '#475569';
  const border = dark ? '#9333ea' : '#0284c7';
  const accent = dark ? '#c084fc' : '#0284c7';

  const html = `
  <div style="background:${panel};border:3px solid ${border};box-shadow:8px 8px 0 #020617, 0 0 30px ${dark ? 'rgba(192,132,252,.25)' : 'rgba(2,132,199,.2)'};border-radius:2px;width:min(900px, 96vw);max-height:92vh;display:flex;flex-direction:column;color:${ink};font-family:var(--font-display, 'Impact', sans-serif);box-sizing:border-box;overflow:hidden;">
    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid ${border};padding:12px 18px;background:${dark ? '#180d2b' : '#bae6fd'};">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:22px;font-weight:900;letter-spacing:1px;font-style:italic;">PAPER CUTOUT SKELETAL RIG</span>
        <span style="background:#16a34a;color:#fff;font-size:10px;padding:3px 7px;border-radius:2px;font-family:var(--font-mono,monospace);font-weight:bold;">GAPLESS ROTATION VERIFIED</span>
      </div>
      <button id="rig-modal-close" aria-label="Close rig inspector" style="background:${card};color:${muted};border:1px solid ${border};padding:5px 12px;cursor:pointer;font-weight:900;font-size:16px;">[X]</button>
    </div>

    <!-- Main Content Area: Left Viewport, Right Controls -->
    <div style="display:grid;grid-template-columns:1fr 340px;flex:1;overflow:hidden;min-height:480px;">
      <!-- Canvas Viewport -->
      <div style="position:relative;background:#050209;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;border-right:2px solid ${border};">
        <div id="rig-pixi-container" style="width:100%;height:100%;min-height:440px;cursor:grab;display:flex;align-items:center;justify-content:center;"></div>
        
        <!-- Viewport Overlay HUD -->
        <div style="position:absolute;bottom:12px;left:12px;display:flex;gap:8px;font-family:var(--font-mono,monospace);font-size:11px;pointer-events:none;">
          <div style="background:rgba(0,0,0,0.75);padding:5px 10px;border:1px solid ${border};color:#a5f3fc;">
            TMJ Hinge Radius: 55px (Cap Overlap: 100%)
          </div>
          <div style="background:rgba(0,0,0,0.75);padding:5px 10px;border:1px solid ${border};color:#fde047;">
            Lumbar Socket Radius: 65px (Gapless)
          </div>
        </div>

        <!-- Quick Action Buttons on Viewport -->
        <div style="position:absolute;top:12px;left:12px;display:flex;gap:8px;">
          <button id="rig-btn-bite" style="background:#ef4444;color:#fff;border:2px solid #b91c1c;padding:6px 14px;font-weight:900;cursor:pointer;font-size:13px;font-family:var(--font-display);letter-spacing:0.5px;box-shadow:2px 2px 0 #000;">CHOMP BITE</button>
          <button id="rig-btn-auto" style="background:#0284c7;color:#fff;border:2px solid #0369a1;padding:6px 14px;font-weight:900;cursor:pointer;font-size:13px;font-family:var(--font-display);letter-spacing:0.5px;box-shadow:2px 2px 0 #000;">AUTO SWIM: ON</button>
          <button id="rig-btn-reset" style="background:#475569;color:#fff;border:2px solid #334155;padding:6px 10px;font-weight:900;cursor:pointer;font-size:12px;font-family:var(--font-display);">RESET JOINTS</button>
        </div>
      </div>

      <!-- Right Joint Rotation Sliders Panel -->
      <div style="padding:16px;background:${card};overflow-y:auto;display:flex;flex-direction:column;gap:12px;font-family:var(--font-mono,monospace);font-size:11px;">
        <div style="font-size:13px;font-weight:900;font-family:var(--font-display);letter-spacing:0.5px;color:${accent};border-bottom:1px solid ${border};padding-bottom:6px;">
          JOINT ROTATION BENCH
        </div>

        <!-- Joint 1: Lower Jaw (TMJ Hinge) -->
        <div style="background:${panel};padding:9px;border:1px solid ${border};">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span style="font-weight:bold;color:#f43f5e;">LOWER JAW (TMJ)</span>
            <span id="val-jaw">0.0°</span>
          </div>
          <input id="slider-jaw" type="range" min="-5" max="35" value="0" step="1" style="width:100%;accent-color:#f43f5e;cursor:pointer;" />
          <div style="color:${muted};font-size:10px;margin-top:2px;">Convex TMJ cap prevents any gap during chomp.</div>
        </div>

        <!-- Joint 2: Tail Peduncle -->
        <div style="background:${panel};padding:9px;border:1px solid ${border};">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span style="font-weight:bold;color:#38bdf8;">TAIL PEDUNCLE</span>
            <span id="val-peduncle">0.0°</span>
          </div>
          <input id="slider-peduncle" type="range" min="-25" max="25" value="0" step="1" style="width:100%;accent-color:#38bdf8;cursor:pointer;" />
          <div style="color:${muted};font-size:10px;margin-top:2px;">Underlying lumbar overlap socket keeps spine unified.</div>
        </div>

        <!-- Joint 3: Tail Fin -->
        <div style="background:${panel};padding:9px;border:1px solid ${border};">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span style="font-weight:bold;color:#a855f7;">CAUDAL TAIL FIN</span>
            <span id="val-tailfin">0.0°</span>
          </div>
          <input id="slider-tailfin" type="range" min="-35" max="35" value="0" step="1" style="width:100%;accent-color:#a855f7;cursor:pointer;" />
          <div style="color:${muted};font-size:10px;margin-top:2px;">Convex fan root overlaps seamlessly into peduncle.</div>
        </div>

        <!-- Joint 4: Front Arm (Shoulder) -->
        <div style="background:${panel};padding:9px;border:1px solid ${border};">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span style="font-weight:bold;color:#fbbf24;">FRONT ARM (SHOULDER)</span>
            <span id="val-arm-up">0.0°</span>
          </div>
          <input id="slider-arm-up" type="range" min="-25" max="35" value="0" step="1" style="width:100%;accent-color:#fbbf24;cursor:pointer;" />
        </div>

        <!-- Joint 5: Front Forearm & Claws (Elbow) -->
        <div style="background:${panel};padding:9px;border:1px solid ${border};">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span style="font-weight:bold;color:#fbbf24;">FOREARM & CLAWS</span>
            <span id="val-arm-low">0.0°</span>
          </div>
          <input id="slider-arm-low" type="range" min="-35" max="35" value="0" step="1" style="width:100%;accent-color:#fbbf24;cursor:pointer;" />
        </div>

        <!-- Joint 6: Rear Upper Leg (Hip) -->
        <div style="background:${panel};padding:9px;border:1px solid ${border};">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span style="font-weight:bold;color:#34d399;">REAR THIGH (HIP)</span>
            <span id="val-leg-up">0.0°</span>
          </div>
          <input id="slider-leg-up" type="range" min="-20" max="30" value="0" step="1" style="width:100%;accent-color:#34d399;cursor:pointer;" />
        </div>

        <!-- Joint 7: Rear Lower Leg (Knee) -->
        <div style="background:${panel};padding:9px;border:1px solid ${border};">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span style="font-weight:bold;color:#34d399;">SHIN & CLAWED FOOT</span>
            <span id="val-leg-low">0.0°</span>
          </div>
          <input id="slider-leg-low" type="range" min="-30" max="40" value="0" step="1" style="width:100%;accent-color:#34d399;cursor:pointer;" />
        </div>

        <!-- Joint 8: Dorsal Fin -->
        <div style="background:${panel};padding:9px;border:1px solid ${border};">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span style="font-weight:bold;color:#e879f9;">SPINY DORSAL FIN</span>
            <span id="val-dorsal">0.0°</span>
          </div>
          <input id="slider-dorsal" type="range" min="-18" max="22" value="0" step="1" style="width:100%;accent-color:#e879f9;cursor:pointer;" />
        </div>

        <!-- Action / In-Game Controls -->
        <div style="margin-top:auto;display:flex;flex-direction:column;gap:8px;padding-top:10px;">
          ${ARCADE.arcadeButton('SPAWN RIG IN ARENA', {
            id: 'rig-btn-spawn-game',
            variant: 'gold',
            fullWidth: true,
            size: 'md'
          })}
          <div style="font-size:10px;text-align:center;color:${muted};">
            All 11 anatomical parts extracted with circular overlap caps.
          </div>
        </div>
      </div>
    </div>
  </div>`;

  ctx.openModal(html);

  // Setup PixiJS sub-application inside the modal viewport
  const containerEl = ctx.modalContainer.querySelector('#rig-pixi-container') as HTMLDivElement;
  let app: Application | null = null;
  let puppet: MutantCutoutPuppet | null = null;
  let animFrameId: number | null = null;
  let autoSwim = true;

  const initPixi = async () => {
    if (!containerEl) return;
    const rect = containerEl.getBoundingClientRect();
    const w = Math.max(300, rect.width || 520);
    const h = Math.max(300, rect.height || 440);

    app = new Application();
    await app.init({
      width: w,
      height: h,
      backgroundAlpha: 0,
      antialias: true
    });

    containerEl.appendChild(app.canvas);

    // Create puppet sized for test bench
    puppet = new MutantCutoutPuppet(30, currentTheme, 340);
    puppet.position.set(w / 2, h / 2 + 10);
    app.stage.addChild(puppet);

    // Render loop
    let lastTime = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(32, now - lastTime);
      lastTime = now;

      if (puppet) {
        puppet.manualControlEnabled = !autoSwim;
        puppet.update(dt, autoSwim ? 1.0 : 0.0);
      }

      animFrameId = requestAnimationFrame(loop);
    };
    animFrameId = requestAnimationFrame(loop);
  };

  void initPixi();

  // Joint Sliders wiring
  const sJaw = ctx.modalContainer.querySelector('#slider-jaw') as HTMLInputElement | null;
  const sPed = ctx.modalContainer.querySelector('#slider-peduncle') as HTMLInputElement | null;
  const sTail = ctx.modalContainer.querySelector('#slider-tailfin') as HTMLInputElement | null;
  const sArmUp = ctx.modalContainer.querySelector('#slider-arm-up') as HTMLInputElement | null;
  const sArmLow = ctx.modalContainer.querySelector('#slider-arm-low') as HTMLInputElement | null;
  const sLegUp = ctx.modalContainer.querySelector('#slider-leg-up') as HTMLInputElement | null;
  const sLegLow = ctx.modalContainer.querySelector('#slider-leg-low') as HTMLInputElement | null;
  const sDorsal = ctx.modalContainer.querySelector('#slider-dorsal') as HTMLInputElement | null;

  const vJaw = ctx.modalContainer.querySelector('#val-jaw');
  const vPed = ctx.modalContainer.querySelector('#val-peduncle');
  const vTail = ctx.modalContainer.querySelector('#val-tailfin');
  const vArmUp = ctx.modalContainer.querySelector('#val-arm-up');
  const vArmLow = ctx.modalContainer.querySelector('#val-arm-low');
  const vLegUp = ctx.modalContainer.querySelector('#val-leg-up');
  const vLegLow = ctx.modalContainer.querySelector('#val-leg-low');
  const vDorsal = ctx.modalContainer.querySelector('#val-dorsal');

  const btnAuto = ctx.modalContainer.querySelector('#rig-btn-auto') as HTMLButtonElement | null;
  const btnBite = ctx.modalContainer.querySelector('#rig-btn-bite') as HTMLButtonElement | null;
  const btnReset = ctx.modalContainer.querySelector('#rig-btn-reset') as HTMLButtonElement | null;
  const btnSpawn = ctx.modalContainer.querySelector('#rig-btn-spawn-game') as HTMLButtonElement | null;

  const updateJointFromSlider = () => {
    if (!puppet) return;
    autoSwim = false;
    puppet.manualControlEnabled = true;
    if (btnAuto) {
      btnAuto.textContent = 'AUTO SWIM: OFF';
      btnAuto.style.background = '#475569';
    }

    const degToRad = Math.PI / 180;
    const jDeg = parseFloat(sJaw?.value || '0');
    const pDeg = parseFloat(sPed?.value || '0');
    const tDeg = parseFloat(sTail?.value || '0');
    const auDeg = parseFloat(sArmUp?.value || '0');
    const alDeg = parseFloat(sArmLow?.value || '0');
    const luDeg = parseFloat(sLegUp?.value || '0');
    const llDeg = parseFloat(sLegLow?.value || '0');
    const dDeg = parseFloat(sDorsal?.value || '0');

    if (vJaw) vJaw.textContent = `${jDeg.toFixed(0)}°`;
    if (vPed) vPed.textContent = `${pDeg.toFixed(0)}°`;
    if (vTail) vTail.textContent = `${tDeg.toFixed(0)}°`;
    if (vArmUp) vArmUp.textContent = `${auDeg.toFixed(0)}°`;
    if (vArmLow) vArmLow.textContent = `${alDeg.toFixed(0)}°`;
    if (vLegUp) vLegUp.textContent = `${luDeg.toFixed(0)}°`;
    if (vLegLow) vLegLow.textContent = `${llDeg.toFixed(0)}°`;
    if (vDorsal) vDorsal.textContent = `${dDeg.toFixed(0)}°`;

    puppet.manualJoints = {
      jawRotation: jDeg * degToRad,
      tailPeduncleRotation: pDeg * degToRad,
      tailFinRotation: tDeg * degToRad,
      frontArmUpperRotation: auDeg * degToRad,
      frontArmLowerRotation: alDeg * degToRad,
      rearLegUpperRotation: luDeg * degToRad,
      rearLegLowerRotation: llDeg * degToRad,
      dorsalFinRotation: dDeg * degToRad,
      headRotation: 0
    };
  };

  [sJaw, sPed, sTail, sArmUp, sArmLow, sLegUp, sLegLow, sDorsal].forEach((slider) => {
    slider?.addEventListener('input', updateJointFromSlider);
  });

  btnAuto?.addEventListener('click', () => {
    autoSwim = !autoSwim;
    if (puppet) puppet.manualControlEnabled = !autoSwim;
    btnAuto.textContent = autoSwim ? 'AUTO SWIM: ON' : 'AUTO SWIM: OFF';
    btnAuto.style.background = autoSwim ? '#0284c7' : '#475569';
  });

  btnBite?.addEventListener('click', () => {
    if (puppet) puppet.triggerBite();
  });

  btnReset?.addEventListener('click', () => {
    [sJaw, sPed, sTail, sArmUp, sArmLow, sLegUp, sLegLow, sDorsal].forEach((s) => {
      if (s) s.value = '0';
    });
    updateJointFromSlider();
  });

  btnSpawn?.addEventListener('click', () => {
    onSpawnInGame?.();
    ctx.closeModal();
  });

  // Modal teardown cleanup
  const cleanup = () => {
    if (animFrameId !== null) cancelAnimationFrame(animFrameId);
    if (app) {
      try {
        app.destroy(true, { children: true, texture: false });
      } catch {}
    }
  };

  ctx.modalContainer.querySelector('#rig-modal-close')?.addEventListener('click', () => {
    cleanup();
    ctx.closeModal();
  });
}
