import { Container, Graphics } from 'pixi.js';
import { Fish } from './Fish';

type Theme = 'light' | 'dark';
type Kind = 'small' | 'medium' | 'boss';

interface Rig {
  root: Container;
  update: (dt: number, fish: Fish) => void;
}

const palettes = {
  light: { body: 0x0e7490, body2: 0x06b6d4, edge: 0x67e8f9, glow: 0xfbbf24, eye: 0xffffff, pupil: 0x0f172a },
  dark: { body: 0x111827, body2: 0x7f1d1d, edge: 0xf87171, glow: 0xd946ef, eye: 0xf8fafc, pupil: 0x000000 }
};

function poly(g: Graphics, pts: number[], color: number, alpha = 1): void {
  g.poly(pts); g.fill({ color, alpha });
}

function addGlow(g: Graphics, r: number, color: number): void {
  g.circle(0, 0, r); g.fill({ color, alpha: 0.10 });
}

function buildFish(fish: Fish): Rig {
  const theme = fish.theme as Theme;
  const p = palettes[theme];
  const root = new Container();
  root.zIndex = 20;
  const idNum = Number(fish.id.replace(/\D/g, '')) || 0;
  const variant = fish.typeId === 'small' ? idNum % 4 : 4 + (idNum % 4);
  const scale = fish.typeId === 'small' ? 1.25 : 1.45;

  const body = new Graphics();
  const tail = new Graphics();
  const fins = new Graphics();
  const detail = new Graphics();
  const eye = new Graphics();
  root.addChild(tail, fins, body, detail, eye);

  addGlow(body, fish.typeId === 'small' ? 38 : 68, p.glow);

  if (variant === 0) { // Razor tetra
    body.ellipse(0, 0, 34, 17); body.fill({ color: p.body, alpha: .95 }); body.stroke({ width: 2, color: p.edge });
    poly(tail, [24,0, 48,-22, 43,0, 48,22], p.body2, .9);
    poly(fins, [-4,-12, 8,-31, 15,-10, -4,13, 9,31, 15,10], p.edge, .55);
    detail.moveTo(-25,0); detail.lineTo(24,0); detail.stroke({ width: 4, color: p.glow, alpha: .7 });
  } else if (variant === 1) { // Manta dart
    poly(body, [-38,0,-8,-20,26,-14,40,0,26,14,-8,20], p.body, .96); body.stroke({ width: 2, color: p.edge });
    poly(tail, [28,0, 70,-8, 70,8], p.body2, .9);
    poly(fins, [-8,-9,-2,-39,13,-12, -8,9,-2,39,13,12], p.edge, .5);
    detail.moveTo(-28,0); detail.quadraticCurveTo(0,-9,28,0); detail.stroke({ width: 2, color: p.glow, alpha: .8 });
  } else if (variant === 2) { // Butterfly blade
    body.ellipse(0,0,31,22); body.fill({ color: p.body, alpha: .96 }); body.stroke({ width:2,color:p.edge });
    poly(tail,[23,0,48,-17,42,0,48,17],p.body2,.9);
    poly(fins,[-2,-14,8,-42,19,-14,-2,14,8,42,19,14],p.glow,.48);
    for(let x=-14;x<=14;x+=7){ detail.moveTo(x,-18); detail.lineTo(x+3,18); } detail.stroke({width:1,color:p.edge,alpha:.55});
  } else if (variant === 3) { // Needlefish
    body.roundRect(-42,-9,78,18,8); body.fill({color:p.body,alpha:.96}); body.stroke({width:2,color:p.edge});
    poly(tail,[32,0,58,-19,55,0,58,19],p.body2,.9);
    poly(fins,[0,-7,15,-29,19,-6,0,7,15,29,19,6],p.edge,.55);
    detail.moveTo(-42,0); detail.lineTo(44,0); detail.stroke({width:2,color:p.glow,alpha:.9});
  } else if (variant === 4) { // Armored manta
    poly(body,[-62,0,-28,-35,18,-30,60,0,18,30,-28,35],p.body,.98); body.stroke({width:3,color:p.edge});
    poly(tail,[48,0,98,-14,92,0,98,14],p.body2,.9);
    poly(fins,[-18,-25,-4,-72,17,-30,-18,25,-4,72,17,30],p.glow,.35);
    for(let x=-35;x<=35;x+=14){detail.moveTo(x,-25);detail.lineTo(x+5,25);} detail.stroke({width:2,color:p.edge,alpha:.55});
  } else if (variant === 5) { // Sawfish
    body.ellipse(0,0,54,25); body.fill({color:p.body,alpha:.98}); body.stroke({width:3,color:p.edge});
    poly(tail,[42,0,83,-26,76,0,83,26],p.body2,.95);
    poly(fins,[-2,-18,13,-55,27,-17,-2,18,13,55,27,17],p.edge,.48);
    detail.moveTo(-52,0); detail.lineTo(-86,-5); detail.lineTo(-52,5); detail.stroke({width:5,color:p.glow,alpha:.85});
    for(let x=-72;x<-50;x+=7){detail.moveTo(x,-3);detail.lineTo(x-3,3);} detail.stroke({width:2,color:p.edge});
  } else if (variant === 6) { // Lionfish
    body.ellipse(0,0,50,28); body.fill({color:p.body,alpha:.98}); body.stroke({width:3,color:p.edge});
    poly(tail,[40,0,75,-28,70,0,75,28],p.body2,.95);
    for(let i=-3;i<=3;i++){ const x=i*11; poly(fins,[x,-18,x+8,-60,x+14,-17],p.glow,.35); poly(fins,[x,18,x+8,60,x+14,17],p.edge,.35); }
    detail.moveTo(-36,0);detail.lineTo(35,0);detail.stroke({width:4,color:p.glow,alpha:.75});
  } else { // Deep pike
    body.roundRect(-58,-20,100,40,18); body.fill({color:p.body,alpha:.98}); body.stroke({width:3,color:p.edge});
    poly(tail,[38,0,86,-30,80,0,86,30],p.body2,.95);
    poly(fins,[-8,-17,14,-55,24,-15,-8,17,14,55,24,15],p.glow,.3);
    for(let x=-38;x<36;x+=12){detail.moveTo(x,-17);detail.lineTo(x+5,17);} detail.stroke({width:2,color:p.edge,alpha:.55});
  }

  eye.circle(-24, -5, 7); eye.fill({color:p.eye}); eye.circle(-24,-5,3); eye.fill({color:p.pupil});
  root.scale.set(scale);
  return {
    root,
    update: (dt, f) => {
      const t = performance.now() * 0.004 + idNum;
      const wiggle = Math.sin(t * (f.typeId === 'boss' ? .8 : 1.8)) * 0.12;
      tail.rotation = wiggle;
      fins.rotation = -wiggle * .55;
      root.rotation = Math.atan2(f.vy, Math.abs(f.vx)) * .22;
      root.scale.x = (f.vx < 0 ? -1 : 1) * scale;
      root.scale.y = scale * (1 + Math.sin(t * 1.4) * .018);
    }
  };
}

function buildBoss(fish: Fish): Rig {
  const theme = fish.theme as Theme;
  const p = palettes[theme];
  const root = new Container(); root.zIndex = 50;
  const aura = new Graphics(); const body = new Graphics(); const fins = new Graphics(); const jaw = new Graphics(); const eyes = new Graphics(); const core = new Graphics();
  root.addChild(aura, fins, body, jaw, eyes, core);
  addGlow(aura, 190, p.glow);
  aura.circle(0,0,150); aura.stroke({width:4,color:p.edge,alpha:.18});

  const variant = (Number(fish.id.replace(/\D/g,'')) || 0) % 2;
  if (variant === 0) { // Crown Leviathan
    body.ellipse(0,0,150,92); body.fill({color:p.body,alpha:.98}); body.stroke({width:6,color:p.edge});
    poly(fins,[-85,-20,-155,-105,-112,-30,-45,-48,-18,-138,8,-44,55,-40,98,-128,91,-15],p.glow,.42);
    poly(fins,[80,20,155,105,112,30,45,48,18,138,-8,44,-55,40,-98,128,-91,15],p.body2,.35);
    for(let x=-70;x<=70;x+=28){poly(fins,[x,-55,x+12,-120,x+24,-50],p.edge,.32);}
    core.circle(0,0,24); core.fill({color:p.glow,alpha:.9}); core.circle(0,0,10); core.fill({color:0xffffff});
  } else { // Trench Colossus
    poly(body,[-145,0,-105,-78,-30,-102,60,-84,145,0,60,84,-30,102,-105,78],p.body,.98); body.stroke({width:6,color:p.edge});
    for(let i=-3;i<=3;i++){const x=i*30; poly(fins,[x,-65,x+18,-155,x+34,-60],p.edge,.3); poly(fins,[x,65,x+18,155,x+34,60],p.glow,.28);}
    poly(jaw,[-85,22,-20,52,82,18,38,72,-34,78],p.body2,.9); jaw.stroke({width:4,color:p.edge});
    core.circle(0,-5,30); core.fill({color:p.glow,alpha:.85}); core.circle(0,-5,12); core.fill({color:0xffffff});
  }
  for(const x of [-42,42]){ eyes.ellipse(x,-20,15,11); eyes.fill({color:p.eye}); eyes.circle(x,-20,5); eyes.fill({color:p.pupil}); }
  for(let i=-4;i<=4;i++){ const x=i*18; poly(jaw,[x,35,x+7,55,x+14,35],p.eye,.95); }
  root.scale.set(1.18);
  return {root,update:(dt,f)=>{const t=performance.now()*.001; root.rotation=Math.sin(t*.7)*.035; root.scale.x=(f.vx<0?-1:1)*1.18; root.scale.y=1.18+Math.sin(t*1.1)*.025; aura.scale.set(1+Math.sin(t*1.7)*.05); core.alpha=.72+Math.sin(t*3)*.22;}};
}

const rigs = new WeakMap<Fish, Rig>();

export function attachVectorCreatureRig(fish: Fish): void {
  if (rigs.has(fish)) return;
  const rig = fish.typeId === 'boss' ? buildBoss(fish) : buildFish(fish);
  fish.container.addChild(rig.root);
  rigs.set(fish, rig);
  console.info(`[VectorRigs] ${fish.theme}/${fish.typeId} rig=${fish.id}`);
}

export function updateVectorCreatureRig(fish: Fish, dt: number): void {
  const rig = rigs.get(fish);
  if (rig && fish.isAlive) rig.update(dt, fish);
}

export function setVectorCreatureTheme(fish: Fish): void {
  const rig = rigs.get(fish);
  if (!rig) return;
  rig.root.destroy({children:true});
  rigs.delete(fish);
  attachVectorCreatureRig(fish);
}
