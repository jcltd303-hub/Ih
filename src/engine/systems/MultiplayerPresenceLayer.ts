import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { TablePlayer } from '../../network/MultiplayerTableManager';

/**
 * Minimal multiplayer presence: medal icon + live player count only.
 */
export class MultiplayerPresenceLayer {
  public container: Container;
  private badge: Container;
  private countText: Text;
  private localUserId = '';
  private count = 0;

  constructor(parent: Container) {
    this.container = new Container();
    parent.addChild(this.container);

    this.badge = new Container();
    this.badge.x = 16;
    this.badge.y = 56;

    const medal = new Graphics();
    medal.circle(0, 0, 12);
    medal.fill({ color: 0xfbbf24, alpha: 0.95 });
    medal.circle(0, 0, 7);
    medal.fill({ color: 0xf59e0b, alpha: 1 });
    this.badge.addChild(medal);

    this.countText = new Text({
      text: '1',
      style: new TextStyle({
        fontFamily: 'ui-monospace, monospace',
        fontSize: 13,
        fontWeight: '800',
        fill: 0xe2e8f0
      })
    });
    this.countText.x = 18;
    this.countText.y = -8;
    this.badge.addChild(this.countText);
    this.container.addChild(this.badge);
  }

  public setLocalUserId(uid: string): void {
    this.localUserId = uid;
  }

  public syncPlayers(players: Record<string, TablePlayer> | undefined): void {
    if (!players) {
      this.count = 1;
      this.countText.text = '1';
      return;
    }
    this.count = Object.keys(players).length || 1;
    this.countText.text = String(this.count);
  }

  public showRemoteShot(_shot: unknown): void {
    /* presence only — no shot tracers */
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}
