const fs = require('fs');
const path = './src/engine/systems/WeaponController.ts';
let code = fs.readFileSync(path, 'utf8');

const target = `          this.particleFX.emitCoinExplosion(hitResult.x, hitResult.y, killGamble.isJackpot ? 32 : 16);
          this.particleFX.spawnExplosion(hitResult.x, hitResult.y, 0xffd700, killGamble.isJackpot ? 40 : 25);
          const killText = \`\${killGamble.bonusLabel} +\${winAmount.toFixed(2)} \${proj.currencyType}\`;

          if (killGamble.isJackpot || fishType === 'boss' || winAmount >= proj.betAmount * 12) {
            SoundManager.playCoinDrop('jackpot', winAmount);
            this.particleFX.spawnFloatingText(hitResult.x, hitResult.y - 25, killText, 0xffd700, true);
          } else if (winAmount >= proj.betAmount * 3.5 || fishType === 'medium') {
            SoundManager.playCoinDrop('medium', winAmount);
            this.particleFX.spawnFloatingText(hitResult.x, hitResult.y - 15, \`+\${winAmount.toFixed(2)} \${proj.currencyType}\`, 0x34d399, false);
          } else {
            SoundManager.playCoinDrop('small', winAmount);
            this.particleFX.spawnFloatingText(hitResult.x, hitResult.y - 15, \`+\${winAmount.toFixed(2)} \${proj.currencyType}\`, 0x34d399, false);
          }

          if (this.onWinCallback) this.onWinCallback(winAmount, proj.currencyType);
        }
        this.stage.removeChild(proj.container);`;

const replacement = `          this.particleFX.emitCoinExplosion(hitResult.x, hitResult.y, killGamble.isJackpot ? 32 : 16);
          this.particleFX.spawnExplosion(hitResult.x, hitResult.y, 0xffd700, killGamble.isJackpot ? 40 : 25);
          const killText = \`\${killGamble.bonusLabel} +\${winAmount.toFixed(2)} \${proj.currencyType}\`;

          if (fishType !== 'boss') {
            if (killGamble.isJackpot || winAmount >= proj.betAmount * 12) {
              SoundManager.playCoinDrop('jackpot', winAmount);
              this.particleFX.spawnFloatingText(hitResult.x, hitResult.y - 25, killText, 0xffd700, true);
            } else if (winAmount >= proj.betAmount * 3.5 || fishType === 'medium') {
              SoundManager.playCoinDrop('medium', winAmount);
              this.particleFX.spawnFloatingText(hitResult.x, hitResult.y - 15, \`+\${winAmount.toFixed(2)} \${proj.currencyType}\`, 0x34d399, false);
            } else {
              SoundManager.playCoinDrop('small', winAmount);
              this.particleFX.spawnFloatingText(hitResult.x, hitResult.y - 15, \`+\${winAmount.toFixed(2)} \${proj.currencyType}\`, 0x34d399, false);
            }
            if (this.onWinCallback) this.onWinCallback(winAmount, proj.currencyType);
          }
        }
        this.stage.removeChild(proj.container);`;

code = code.replace(target, replacement);
fs.writeFileSync(path, code);
