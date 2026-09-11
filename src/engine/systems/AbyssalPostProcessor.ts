import { Filter } from 'pixi.js';

export class AbyssalPostProcessor {
  private chromaticFilter: Filter | null = null;
  private isGlitching: boolean = false;

  constructor() {
    try {
      // Custom fragment shader for chromatic aberration and RGB split in PixiJS v8
      const vertexShader = `
        in vec2 aPosition;
        out vec2 vTextureCoord;
        uniform vec4 uInputSize;
        uniform vec4 uOutputFrame;
        uniform vec4 uOutputTexture;

        vec4 filterVertexPosition(void) {
            vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
            position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
            position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
            return vec4(position, 0.0, 1.0);
        }

        vec2 filterTextureCoord(void) {
            return aPosition * (uOutputFrame.zw * uInputSize.zw);
        }

        void main(void) {
            gl_Position = filterVertexPosition();
            vTextureCoord = filterTextureCoord();
        }
      `;

      const fragmentShader = `
        precision mediump float;
        in vec2 vTextureCoord;
        out vec4 finalColor;
        uniform sampler2D uTexture;
        uniform float uOffset;

        void main(void) {
            vec4 red = texture(uTexture, vTextureCoord + vec2(uOffset, 0.0));
            vec4 green = texture(uTexture, vTextureCoord);
            vec4 blue = texture(uTexture, vTextureCoord - vec2(uOffset, 0.0));
            finalColor = vec4(red.r, green.g, blue.b, green.a);
        }
      `;

      this.chromaticFilter = Filter.from({
        gl: {
          vertex: vertexShader,
          fragment: fragmentShader
        },
        resources: {
          abyssalUniforms: {
            uOffset: { value: 0.001, type: 'f32' }
          }
        }
      });
    } catch (e) {
      console.warn('[AbyssalPostProcessor] WebGL custom shader fallback mode:', e);
    }
  }

  public getFilter(): Filter | null {
    return this.chromaticFilter;
  }

  public triggerImpactGlitch(intensity: number = 0.012): void {
    if (this.isGlitching || !this.chromaticFilter) return;
    this.isGlitching = true;
    
    const resources = this.chromaticFilter.resources as any;
    if (resources?.abyssalUniforms?.uniforms) {
      resources.abyssalUniforms.uniforms.uOffset = intensity;
    }

    setTimeout(() => {
      if (resources?.abyssalUniforms?.uniforms) {
        resources.abyssalUniforms.uniforms.uOffset = 0.001;
      }
      this.isGlitching = false;
    }, 150);
  }
}
