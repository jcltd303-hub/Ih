import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { TablePlayer } from '../../network/MultiplayerTableManager';

type RemoteShot = {
  userId: string;
  targetX: number;
  targetY: number;
  bet: number;
  timestamp: number;
};

/**
 * Renders other players at the trench and flashes remote shot tracers.
 */
export class MultiplayerPresenceLayer {
  public container: Container;
  private markers = new Map<string, Container>();
  private shotFx: Graphics;
  private localUserId: string = '';
  private labelStyle: TextStyle;

  constructor(parent: Container) {
    this.container = new Container();
    parent.addChild(this.container);
    this.shotFx = new Graphics();
    this.container.addChild(this.shotFx);
    this.labelStyle = new TextStyle({
      fontFamily: 'ui-monospace, monospace',
      fontSize: 11,
      fontWeight: '700',
      fill: 0xa5f3fc
    });
  }

  public setLocalUserId(uid: string): void {
    this.localUserId = uid;
  }

  public syncPlayers(players: Record<string, TablePlayer> | undefined): void {
    if (!players) return;
    const seen = new Set<string>();

    for (const [id, p] of Object.entries(players)) {
      if (!p || id === this.localUserId) continue;
      seen.add(id);
      let marker = this.markers.get(id);
      if (!marker) {
        marker = new Container();
        const g = new Graphics();
        g.circle(0, 0, 10);
        g.fill({ color: 0x22d3ee, alpha: 0.85 });
        g.stroke({ width: 2, color: 0xffffff, alpha: 0.9 });
        // turret-ish triangle
        g.poly([{ x: 0, y: -18 }, { x: 8, y: -4 }, { x: -8, y: -4 }]);
        g.fill({ color: 0x0ea5e9, alpha: 0.95 });
        marker.addChild(g);
        const label = new Text({
          text: (p.username || id).slice(0, 12),
          style: this.labelStyle
        });
        label.anchor.set(0.5, 1);
        label.y = -22;
        marker.addChild(label);
        this.container.addChild(marker);
        this.markers.set(id, marker);
      }
      marker.x = p.x || 0;
      marker.y = p.y || 0;
      const label = marker.children[1] as Text | undefined;
      if (label && p.username) label.text = p.username.slice(0, 12);
    }

    for (const id of [...this.markers.keys()]) {
      if (!seen.has(id)) {
        const m = this.markers.get(id)!;
        this.container.removeChild(m);
        m.destroy({ children: true });
        this.markers.delete(id);
      }
    }
  }

  public showRemoteShot(shot: RemoteShot): void {
    if (!shot || shot.userId === this.localUserId) return;
    const origin = this.markers.get(shot.userId);
    const ox = origin ? origin.x : shot.targetX;
    const oy = origin ? origin.y : shot.targetY + 80;

    this.shotFx.moveTo(ox, oy);
    this.shotFx.lineTo(shot.targetX, shot.targetY);
    this.shotFx.stroke({ width: 2, color: 0xf472b6, alpha: 0.75 });
    this.shotFx.circle(shot.targetX, shot.targetY, 6);
    this.shotFx.fill({ color: 0xf472b6, alpha: 0.5 });

    // fade markers via clearing on a short timer
    window.setTimeout(() => {
      this.shotFx.clear();
    }, 180);
  }

  public destroy(): void {
    this.container.destroy({ children: true });
    this.markers.clear();
  }
}
