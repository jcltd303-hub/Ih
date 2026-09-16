import { Container, Sprite, Texture } from 'pixi.js';

export interface DetailedBossTextures {
    torsoMain: Texture;
    headJaw: Texture;
    eyeballLarge: Texture;
    eyeballSmall: Texture;
    brainOrgans: Texture;
    visceraSpine: Texture;
    pectoralFin: Texture;
    dorsalFin: Texture;
    tailFin: Texture;
}

export class AbyssalHorrorBoss extends Container {
    // Structural Hierarchy Containers (Joint Hierarchy)
    private bodyRoot: Container = new Container();
    private torsoMain: Container = new Container();
    private headGroup: Container = new Container();
    private jaw: Container = new Container();
    private organCavity: Container = new Container();
    private tailAssembly: Container = new Container();
    private pectoralFinLeft: Container = new Container();

    // Visual Sprites
    private sTorsoMain!: Sprite;
    private sHeadJaw!: Sprite;
    private sEyeballLarge!: Sprite;
    private sEyeballSmall!: Sprite;
    private sBrainOrgans!: Sprite;
    private sVisceraSpine!: Sprite;
    private sPectoralFin!: Sprite;
    private sDorsalFin!: Sprite;
    private sTailFin!: Sprite;

    constructor(textures: DetailedBossTextures) {
        super();
        this.buildRig(textures);
    }

    private buildRig(tex: DetailedBossTextures): void {
        // 1. Initialize Sprites and configure local pivots to articulation points
        this.sTorsoMain = new Sprite(tex.torsoMain);
        this.sTorsoMain.anchor.set(0.5, 0.5);

        this.sHeadJaw = new Sprite(tex.headJaw);
        this.sHeadJaw.anchor.set(0.8, 0.4); // Jaw hinge pivot

        this.sEyeballLarge = new Sprite(tex.eyeballLarge);
        this.sEyeballLarge.anchor.set(0.5, 0.5);

        this.sEyeballSmall = new Sprite(tex.eyeballSmall);
        this.sEyeballSmall.anchor.set(0.5, 0.5);

        this.sBrainOrgans = new Sprite(tex.brainOrgans);
        this.sBrainOrgans.anchor.set(0.5, 0.5); // Exposed internal brain asset

        this.sVisceraSpine = new Sprite(tex.visceraSpine);
        this.sVisceraSpine.anchor.set(0.1, 0.5); // Spine & guts extension

        this.sPectoralFin = new Sprite(tex.pectoralFin);
        this.sPectoralFin.anchor.set(0.2, 0.2);

        this.sDorsalFin = new Sprite(tex.dorsalFin);
        this.sDorsalFin.anchor.set(0.5, 1.0);

        this.sTailFin = new Sprite(tex.tailFin);
        this.sTailFin.anchor.set(0.1, 0.5);

        // 2. Build Scene Graph Hierarchy
        this.addChild(this.bodyRoot);

        // Main Torso Chassis
        this.bodyRoot.addChild(this.torsoMain);
        this.torsoMain.addChild(this.sTorsoMain);

        // Dorsal Spine Spikes Fin
        this.torsoMain.addChild(this.sDorsalFin);

        // Head and Jaw Assembly
        this.torsoMain.addChild(this.headGroup);
        this.headGroup.addChild(this.sHeadJaw);
        
        // Eyeballs nested inside head structure
        this.headGroup.addChild(this.sEyeballLarge);
        this.headGroup.addChild(this.sEyeballSmall);

        // Internal Organ Cavity (Exposable/Damageable layer)
        this.torsoMain.addChild(this.organCavity);
        this.organCavity.addChild(this.sBrainOrgans);

        // Pectoral Fin
        this.torsoMain.addChild(this.pectoralFinLeft);
        this.pectoralFinLeft.addChild(this.sPectoralFin);

        // Viscera / Spine Tail Extension
        this.torsoMain.addChild(this.sVisceraSpine);

        // Rear Propulsion Tail
        this.torsoMain.addChild(this.tailAssembly);
        this.tailAssembly.addChild(this.sTailFin);

        // 3. Setup Default Relative Transforms & Offsets
        this.bodyRoot.position.set(512, 384);
        this.headGroup.position.set(-180, -40);
        this.sEyeballLarge.position.set(-65, -35);
        this.sEyeballSmall.position.set(25, -20);
        this.organCavity.position.set(20, -10); // Matches the chest hollow zone
        this.sDorsalFin.position.set(-50, -140);
        this.pectoralFinLeft.position.set(10, 50);
        this.sVisceraSpine.position.set(140, 20);
        this.tailAssembly.position.set(220, -10);
    }

    /**
     * Procedural idle loop driving organic breathing, eye twitch, and fin sway.
     */
    public updateIdle(time: number): void {
        const breath = Math.sin(time * 3.5) * 0.015;
        this.torsoMain.scale.set(1 + breath, 1 + breath);

        // Subtle jaw snapping / pulsing
        this.sHeadJaw.rotation = Math.sin(time * 2) * 0.04;

        // Tail fin oscillation
        this.tailAssembly.rotation = Math.sin(time * 3) * 0.07;

        // Pectoral fin stabilization flap
        this.pectoralFinLeft.rotation = 0.2 + Math.sin(time * 4) * 0.1;

        // Internal brain/organ pulsing inside the cavity
        this.sBrainOrgans.scale.set(1 + Math.sin(time * 5) * 0.03);
    }

    /**
     * Combat reaction state: Reveal organs / take heavy impact damage.
     */
    public setDamageState(isCavityOpen: boolean): void {
        this.sBrainOrgans.visible = isCavityOpen;
        this.organCavity.alpha = isCavityOpen ? 1.0 : 0.4;
    }
}
