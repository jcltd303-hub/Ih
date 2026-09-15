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
        uniform float uDim;
        uniform float uTime;
        uniform vec2 uResolution;

        void main(void) {
            // Chromatic Aberration
            vec4 red = texture(uTexture, vTextureCoord + vec2(uOffset, 0.0));
            vec4 green = texture(uTexture, vTextureCoord);
            vec4 blue = texture(uTexture, vTextureCoord - vec2(uOffset, 0.0));
            vec4 color = vec4(red.r, green.g, blue.b, green.a);

            // CRT Scanlines
            float scanline = sin(vTextureCoord.y * uResolution.y * 1.5) * 0.04;
            color.rgb -= scanline;

            // Vignette
            vec2 uv = vTextureCoord - 0.5;
            float vignette = 1.0 - dot(uv, uv) * 1.5;
            color.rgb *= clamp(vignette, 0.5, 1.0);

            // Global Dimming (for Boss Intro)
            color.rgb *= (1.0 - uDim);

            finalColor = color;
        }
      `;

      this.chromaticFilter = Filter.from({
        gl: {
          vertex: vertexShader,
          fragment: fragmentShader
        },
        resources: {
          abyssalUniforms: {
            uOffset: { value: 0.001, type: 'f32' },
            uDim: { value: 0.0, type: 'f32' },
            uTime: { value: 0.0, type: 'f32' },
            uResolution: { value: [window.innerWidth, window.innerHeight], type: 'vec2<f32>' }
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

  public update(time: number): void {
    if (!this.chromaticFilter) return;
    const resources = this.chromaticFilter.resources as any;
    if (resources?.abyssalUniforms?.uniforms) {
      resources.abyssalUniforms.uniforms.uTime = time;
    }
  }

  public setDim(dim: number): void {
    if (!this.chromaticFilter) return;
    const resources = this.chromaticFilter.resources as any;
    if (resources?.abyssalUniforms?.uniforms) {
      resources.abyssalUniforms.uniforms.uDim = Math.max(0, Math.min(0.8, dim));
    }
  }

  public resize(width: number, height: number): void {
    if (!this.chromaticFilter) return;
    const resources = this.chromaticFilter.resources as any;
    if (resources?.abyssalUniforms?.uniforms) {
      resources.abyssalUniforms.uniforms.uResolution = [width, height];
    }
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
