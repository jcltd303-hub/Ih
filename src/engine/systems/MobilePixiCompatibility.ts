import { Container, Graphics } from 'pixi.js';
import { SpriteSheetManager, FishAnimationRig, TurretAnimationRig, TurretSkinId } from './SpriteSheetManager';

/**
 * Mobile-safe Pixi path.
 * Some Android WebGL stacks are unhappy with the large number of procedural
 * canvas textures used by the desktop sprite pipeline. Keep gameplay entirely
 * in Pixi, but use native Graphics for fish/turret art on mobile instead of
 * canvas-backed AnimatedSprite textures.
 */
export function enableMobilePixiCompatibility(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || !!coarse;
  if (!mobile) return false;

  const manager = SpriteSheetManager.getInstance() as any;
  const proto = Object.getPrototypeOf(manager) as any;
  if (proto.__ffMobileSafe) return true;
  proto.__ffMobileSafe = true;

  proto.initialize = async function (): Promise<void> {
    this.isInitialized = true;
  };

  proto.createFishAnimationRig = function (
    type: 'small' | 'medium' | 'boss' | 'angler',
    theme: 'light' | 'dark' = 'light'
  ): FishAnimationRig {
    const container = new Container();
    const g = new Graphics();
    const isSmall = type === 'small';
    const isBoss = type === 'boss';
    const rx = isBoss ? 82 : isSmall ? 24 : 46;
    const ry = isBoss ? 48 : isSmall ? 14 : 28;
    const body = theme === 'dark' ? 0x7f1d1d : 0x075985;
    const edge = theme === 'dark' ? 0xf87171 : 0x22d3ee;
    const glow = theme === 'dark' ? 0xdc2626 : 0x67e8f9;

    g.ellipse(0, 0, rx, ry);
    g.fill({ color: body, alpha: 0.94 });
    g.stroke({ width: isBoss ? 4 : 2.5, color: edge, alpha: 0.98 });
    g.moveTo(rx * 0.72, 0);
    g.lineTo(rx + (isSmall ? 14 : 24), -ry * 0.78);
    g.lineTo(rx + (isSmall ? 14 : 24), ry * 0.78);
    g.closePath();
    g.fill({ color: body, alpha: 0.9 });
    g.stroke({ width: 2, color: edge, alpha: 0.9 });
    g.circle(-rx * 0.55, -ry * 0.18, isBoss ? 6 : 3.5);
    g.fill({ color: 0xffffff, alpha: 1 });
    g.circle(-rx * 0.55, -ry * 0.18, isBoss ? 3 : 1.7);
    g.fill({ color: theme === 'dark' ? 0xff0033 : 0x0f172a, alpha: 1 });
    g.circle(0, 0, Math.max(rx, ry) * 1.35);
    g.fill({ color: glow, alpha: 0.05 });
    container.addChild(g);
    container.scale.set(isBoss ? 1 : isSmall ? 0.95 : 1.0);

    const rig: FishAnimationRig = {
      container,
      sprite: null as any,
      currentState: 'swim_right',
      currentTheme: theme,
      species: type === 'small' ? 'small' : type === 'medium' ? 'medium' : 'angler',
      isTurning: false,
      playState: (state) => { rig.currentState = state; },
      setSpeed: () => {},
      setTheme: (next) => {
        rig.currentTheme = next;
        const nextBody = next === 'dark' ? 0x7f1d1d : 0x075985;
        const nextEdge = next === 'dark' ? 0xf87171 : 0x22d3ee;
        g.clear();
        g.ellipse(0, 0, rx, ry).fill({ color: nextBody, alpha: 0.94 }).stroke({ width: isBoss ? 4 : 2.5, color: nextEdge, alpha: 0.98 });
        g.moveTo(rx * 0.72, 0).lineTo(rx + (isSmall ? 14 : 24), -ry * 0.78).lineTo(rx + (isSmall ? 14 : 24), ry * 0.78).closePath().fill({ color: nextBody, alpha: 0.9 }).stroke({ width: 2, color: nextEdge, alpha: 0.9 });
        g.circle(-rx * 0.55, -ry * 0.18, isBoss ? 6 : 3.5).fill({ color: 0xffffff, alpha: 1 });
        g.circle(-rx * 0.55, -ry * 0.18, isBoss ? 3 : 1.7).fill({ color: next === 'dark' ? 0xff0033 : 0x0f172a, alpha: 1 });
      },
      tint: (color) => { g.tint = color; },
      resetTint: () => { g.tint = 0xffffff; }
    };
    return rig;
  };

  proto.createTurretRig = function (skinId: TurretSkinId = 'default'): TurretAnimationRig {
    const container = new Container();
    const base = new Graphics();
    const head = new Container();
    const gun = new Graphics();
    const draw = () => {
      base.clear();
      base.circle(0, 0, 38).fill({ color: 0x0b1220, alpha: 0.98 }).stroke({ width: 3, color: 0x22d3ee, alpha: 0.95 });
      base.circle(0, 0, 26).stroke({ width: 2, color: 0xe879f9, alpha: 0.7 });
      gun.clear();
      gun.rect(-14, -58, 9, 40).fill({ color: 0x334155, alpha: 1 }).stroke({ width: 2, color: 0x67e8f9, alpha: 0.95 });
      gun.rect(5, -58, 9, 40).fill({ color: 0x334155, alpha: 1 }).stroke({ width: 2, color: 0x67e8f9, alpha: 0.95 });
      gun.circle(0, 0, 17).fill({ color: 0x0284c7, alpha: 0.65 }).stroke({ width: 2, color: 0xffffff, alpha: 0.8 });
    };
    draw();
    head.addChild(gun);
    container.addChild(base);
    container.addChild(head);

    const rig: TurretAnimationRig = {
      container,
      baseSprite: base,
      headContainer: head,
      turretSprite: null as any,
      activeSkin: skinId,
      recoilOffset: 0,
      setSkin: (next) => { rig.activeSkin = next; draw(); },
      playFire: (onMuzzleFlash) => {
        gun.alpha = 1;
        onMuzzleFlash?.();
        window.setTimeout(() => { if (!gun.destroyed) gun.alpha = 1; }, 90);
      },
      update: () => {}
    };
    return rig;
  };

  console.info('[Fish Frenzy] mobile Pixi compatibility path enabled');
  return true;
}
