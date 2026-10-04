import * as THREE from 'three';

/**
 * Light, colour and air (docs/plan-look-and-sound.md, sections 2 and 4).
 *
 * Reported directly: the game "looks dull and old". The light was a soft
 * ambient, a sun and a sky fill of about the same strength, drawn with no
 * tone mapping, so every face sat in the same middling grey-pastel; the sky
 * was one flat colour; the fog one plain colour fading to the horizon. This
 * is what replaces them, kept in one place so the pieces agree:
 *
 * - a colour grade: tone mapping, so a stronger sun can be used without
 *   burning the pale blocks out, and a small saturation lift on top;
 * - mist that lies low — thick in the valleys and over water at dawn, thin by
 *   day — patched into the world's materials;
 * - a sky dome: deeper blue overhead than at the horizon, warm round the sun;
 * - motes drifting in the air by day.
 *
 * DayCycle drives all of it from the time of day.
 */

/**
 * Neutral tone mapping, not ACES. ACES darkens the middle and pulls bright
 * colours towards white and yellow, which on a pastel palette is exactly the
 * wrong way — the blocks go muddy. Neutral leaves everything below the
 * highlights alone and only rolls the brightest off, so the light can be
 * pushed harder (a stronger sun, deeper shade) and the colours stay the
 * colours they were painted.
 */
export const TONE_MAPPING = THREE.NeutralToneMapping;
/** How much brighter the whole picture is drawn: what turns "pastel" into "fresh" rather than "grey". */
export const EXPOSURE = 1.32;
/** The saturation lift after tone mapping: 1 is none. Small — the palette is meant to stay soft. */
export const SATURATION = 1.14;

let graded = false;

/**
 * Sets the renderer's tone mapping and adds the saturation lift to every
 * material that is tone mapped. The lift goes into three's own tone mapping
 * chunk, once, before anything compiles, so the world, the people, the
 * animals and the clouds all get the same grade — and fog, which three
 * applies after that chunk, does not, so the horizon still meets the sky.
 */
export function gradeRenderer(renderer) {
  renderer.toneMapping = TONE_MAPPING;
  renderer.toneMappingExposure = EXPOSURE;
  if (graded) return;
  graded = true;
  THREE.ShaderChunk.tonemapping_fragment = `${THREE.ShaderChunk.tonemapping_fragment}
#if defined( TONE_MAPPING )
  {
    float lum = dot( gl_FragColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
    gl_FragColor.rgb = max( mix( vec3( lum ), gl_FragColor.rgb, ${SATURATION.toFixed(3)} ), 0.0 );
  }
#endif
`;
}

// ---- mist that lies low ---------------------------------------------------

/**
 * The height mist's settings, shared by reference with every material that
 * has it (see withHeightFog), so one write here moves them all.
 *
 *   mistColor    its colour, in the output colour space (three adds fog after
 *                converting to it, and this is added after that)
 *   mistDensity  how thick it is at the bottom, per block of sight-line
 *   mistBase     the height it's thickest at and below: the sea
 *   mistFalloff  how fast it thins going up, per block
 */
/** The sea, which the mist lies on (ChunkGen's SEA_LEVEL, plus a block). */
export const MIST_BASE = 101;
/** It thins by e every this many blocks up — valleys fill, hilltops stand clear. */
export const MIST_DEPTH = 9;
export const heightFog = {
  mistColor: { value: new THREE.Color(0xdde8f2) },
  mistDensity: { value: 0 },
  mistBase: { value: MIST_BASE },
  mistFalloff: { value: 1 / MIST_DEPTH },
};
/** The most of the picture mist ever covers: never a white-out. */
const MIST_MAX = 0.88;

/**
 * Adds the low mist to a world material. Fog in three is by distance alone;
 * this adds how much of the sight-line runs through the low air, which is
 * what makes a valley hazy while the hill behind it stands clear, and a
 * river at dawn lie under a sheet of white. Worked out exactly for mist that
 * thins exponentially with height (the integral along the ray, not a
 * stepped march), so it costs a handful of instructions a pixel.
 *
 * Chains any onBeforeCompile the material already has.
 */
export function withHeightFog(mat) {
  const before = mat.onBeforeCompile;
  const key = mat.customProgramCacheKey;
  mat.onBeforeCompile = (shader, renderer) => {
    before?.call(mat, shader, renderer);
    Object.assign(shader.uniforms, heightFog);
    shader.vertexShader = shader.vertexShader
      .replace('#include <fog_pars_vertex>', '#include <fog_pars_vertex>\nvarying vec3 vMistWorld;')
      .replace('#include <fog_vertex>', `#include <fog_vertex>
      {
        vec4 mistAt = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          mistAt = instanceMatrix * mistAt;
        #endif
        vMistWorld = ( modelMatrix * mistAt ).xyz;
      }`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <fog_pars_fragment>', `#include <fog_pars_fragment>
      varying vec3 vMistWorld;
      uniform vec3 mistColor;
      uniform float mistDensity;
      uniform float mistBase;
      uniform float mistFalloff;`)
      .replace('#include <fog_fragment>', `#include <fog_fragment>
      if ( mistDensity > 0.0 ) {
        float dist = length( vMistWorld - cameraPosition );
        float h0 = max( cameraPosition.y - mistBase, 0.0 ), h1 = max( vMistWorld.y - mistBase, 0.0 );
        float dh = h1 - h0, e0 = exp( -mistFalloff * h0 );
        // The average thickness along the sight-line.
        float through = abs( dh ) > 0.05 ? ( e0 - exp( -mistFalloff * h1 ) ) / ( mistFalloff * dh ) : e0;
        float mist = 1.0 - exp( -mistDensity * dist * through );
        gl_FragColor.rgb = mix( gl_FragColor.rgb, mistColor, min( mist, ${MIST_MAX.toFixed(2)} ) );
      }`);
  };
  mat.customProgramCacheKey = function () { return `${key.call(this)}|mist1`; };
  mat.needsUpdate = true;
  return mat;
}

const MIST_DAY = new THREE.Color(0xe4edf5);
const MIST_DAWN = new THREE.Color(0xf6e3d6);
const MIST_NIGHT = new THREE.Color(0x27324f);

const bump = (x, at, width) => Math.max(0, 1 - Math.abs(x - at) / width);

/**
 * How thick the low mist is, and its colour, at a time of day (0..1, as
 * DayCycle's clock). Thickest round sunrise — morning mist on the rivers —
 * burnt off by mid-morning, a little back at dusk, and a thin cold haze all
 * night. Plain numbers so it can be tested on its own.
 *
 * @param day   0 night .. 1 day (daylightAt's `day`)
 * @param dusk  0..1 how much it's sunset or sunrise (daylightAt's `dusk`)
 */
export function mistAt(time, day, dusk) {
  const dawn = bump(time, 0.255, 0.085);
  const evening = bump(time, 0.75, 0.06);
  const density = 0.003 * day + 0.007 * (1 - day) + 0.022 * dawn + 0.004 * evening;
  const color = new THREE.Color().copy(MIST_NIGHT).lerp(MIST_DAY, day).lerp(MIST_DAWN, Math.min(1, dusk * 0.8 + dawn * 0.3));
  return { density, color, dawn };
}

// ---- the sky -------------------------------------------------------------

/**
 * The sky as a dome round the camera: deeper blue straight up than at the
 * horizon, and a warm glow round the sun, wide and orange as it sets. The
 * horizon colour is the fog's own, so land fading into the distance meets
 * the sky without a seam.
 *
 * Not tone mapped, like the fog and the clear colour it replaces, which is
 * what keeps the three the same colour on screen.
 */
export class SkyDome {
  constructor(scene) {
    this.uniforms = {
      zenith: { value: new THREE.Color(0x5d9de0) },
      horizon: { value: new THREE.Color(0xadd7f5) },
      glow: { value: new THREE.Color(0x000000) },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      glowWidth: { value: 6 },
    };
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }`,
      fragmentShader: `
        uniform vec3 zenith, horizon, glow, sunDir;
        uniform float glowWidth;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize( vDir );
          // A broad band of horizon colour low down, quickly deepening.
          float up = pow( clamp( d.y, 0.0, 1.0 ), 0.5 );
          vec3 col = mix( horizon, zenith, up );
          float s = max( dot( d, sunDir ), 0.0 );
          // A wide warm wash and a tighter bright halo, both strongest low.
          col += glow * ( pow( s, glowWidth ) * 0.75 + pow( s, 48.0 ) * 0.5 ) * ( 1.0 - 0.6 * up );
          gl_FragColor = linearToOutputTexel( vec4( col, 1.0 ) );
        }`,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    material.toneMapped = false;
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), material);
    // After everything solid, depth-tested, so it is only worked out for the
    // pixels that are actually sky — drawn first, it would be a whole extra
    // screenful of pixels every frame, which on a phone is not nothing. The
    // see-through things (stars, sun, moon, water) come after it anyway.
    this.mesh.renderOrder = 10;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  /**
   * Round the camera, just inside its far plane — so beyond everything else
   * drawn, the furthest hills included, since it's drawn after them.
   */
  follow(eye, radius) {
    this.mesh.position.copy(eye);
    this.mesh.scale.setScalar(radius);
  }
}

// ---- motes ---------------------------------------------------------------

/** How many motes, in the box round you they fill. */
const MOTES = 140;
const MOTE_BOX = new THREE.Vector3(36, 14, 36);

/**
 * Pollen drifting in the sunlight. One set of points, moved entirely on the
 * GPU: each mote's place is its own fixed offset plus a slow drift, wrapped
 * into a box that travels with the camera, so there is nothing to update
 * per frame but the clock — and however far you walk there are always motes
 * round you and never more than MOTES of them. Out by night, when the
 * fireflies (world/Fireflies.js) have the air.
 */
export class Motes {
  constructor(scene) {
    const seed = new Float32Array(MOTES * 3);
    let s = 11;
    const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < MOTES * 3; i++) seed[i] = rand();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(seed, 3));
    this.uniforms = {
      time: { value: 0 },
      box: { value: MOTE_BOX.clone() },
      eye: { value: new THREE.Vector3() },
      color: { value: new THREE.Color(0xfff2c0) },
      opacity: { value: 0 },
      scale: { value: 300 },
    };
    this.points = new THREE.Points(geo, new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `
        uniform float time, scale;
        uniform vec3 box, eye;
        varying float vFade;
        void main() {
          vec3 seed = position;
          // Drifting with the breeze, bobbing a little on its own.
          vec3 drift = vec3( 0.55, 0.0, 0.25 ) * time + vec3( 0.0, sin( time * 0.7 + seed.x * 40.0 ) * 0.6, 0.0 )
                     + vec3( sin( time * 0.3 + seed.z * 30.0 ), 0.0, cos( time * 0.27 + seed.y * 25.0 ) ) * 1.2;
          vec3 p = mod( seed * box + drift - eye + box * 0.5, box ) - box * 0.5;
          // Fade out towards the edges of the box, so none pops in or out.
          vFade = 1.0 - smoothstep( 0.55, 1.0, length( p / ( box * 0.5 ) ) );
          vec4 mv = modelViewMatrix * vec4( eye + p, 1.0 );
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp( scale * ( 0.06 + 0.04 * seed.y ) / -mv.z, 1.0, 6.0 );
        }`,
      fragmentShader: `
        uniform vec3 color;
        uniform float opacity;
        varying float vFade;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float a = smoothstep( 0.5, 0.1, length( c ) ) * vFade * opacity;
          if ( a < 0.01 ) discard;
          gl_FragColor = vec4( color, a );
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    }));
    this.points.frustumCulled = false;
    this.points.visible = false;
    this.enabled = true;
    scene.add(this.points);
  }

  /**
   * @param eye        the camera position
   * @param day        0 night .. 1 day
   * @param dusk       0..1 sunset — the motes turn gold in it
   * @param pixelScale the drawing buffer's height, so a mote is the same size on any screen
   */
  update(dt, eye, day, dusk, pixelScale = 780) {
    const on = this.enabled && day > 0.05;
    this.points.visible = on;
    if (!on) return;
    const u = this.uniforms;
    u.time.value = (u.time.value + dt) % 10000;
    u.eye.value.copy(eye);
    u.opacity.value = 0.55 * day;
    u.color.value.setRGB(1, 0.93 - 0.2 * dusk, 0.7 - 0.35 * dusk);
    u.scale.value = pixelScale * 0.5;
  }
}
