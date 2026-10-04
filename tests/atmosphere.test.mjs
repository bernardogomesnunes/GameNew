import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { TONE_MAPPING, EXPOSURE, SATURATION, gradeRenderer, mistAt, heightFog, withHeightFog, MIST_BASE } from '../src/render/atmosphere.js';
import { daylightAt } from '../src/render/DayCycle.js';
import { DEFAULTS as DEFAULT_GRAPHICS } from '../src/render/graphics.js';

/**
 * The look revamp, light and air (docs/plan-look-and-sound.md, sections 2
 * and 4) — asked for directly: "we need to improve the visuals, it's
 * imperative". Tone mapping and a saturation lift; a warmer sun and cooler
 * shade; a sky that's deeper blue overhead and gold round a setting sun; mist
 * that lies low at dawn; motes in the sunlight; cloud round the Sky Kingdom.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const mesher = readFileSync(new URL('../src/world/ChunkMesher.js', import.meta.url), 'utf8');

// The grade.
{
  const r = { toneMapping: 0, toneMappingExposure: 1 };
  gradeRenderer(r);
  ok('neutral tone mapping, not ACES (which muddies a pastel palette)', TONE_MAPPING === THREE.NeutralToneMapping && r.toneMapping === TONE_MAPPING);
  ok('drawn brighter, so the light can be pushed harder', r.toneMappingExposure === EXPOSURE && EXPOSURE > 1);
  ok('a small saturation lift, in every tone-mapped material', SATURATION > 1 && SATURATION < 1.3 && /float lum = dot\( gl_FragColor\.rgb/.test(THREE.ShaderChunk.tonemapping_fragment));
  ok('the game grades its renderer', /gradeRenderer\(this\.renderer\)/.test(game));
}

// Light with contrast.
{
  const noon = daylightAt(0.5), night = daylightAt(0);
  ok('more sun and less fill by day: a lit face and a shaded one differ', noon.sun > 1 && noon.ambient < 0.5);
  ok('and the night is still night', night.sun === 0 && night.ambient < 0.2);
}

// Mist that lies low.
{
  const dawn = mistAt(0.255, 0.3, 1), noon = mistAt(0.5, 1, 0);
  ok('thick at dawn, thin by day', dawn.density > noon.density * 2);
  ok('lying on the sea, thinning upward', MIST_BASE > 90 && heightFog.mistFalloff.value > 0);
  const mat = withHeightFog(new THREE.MeshLambertMaterial());
  ok('a material takes it on without losing its own shader key', /mist1/.test(mat.customProgramCacheKey()));
  ok('every world material has it', (mesher.match(/withHeightFog\(/g) ?? []).length >= 4);
}

// Behind a switch, for slow phones.
ok('"Mist and motes" can be turned off in the graphics settings', DEFAULT_GRAPHICS.atmosphere === true && /setAtmosphere\(on\) \{/.test(game));
ok('the air follows the time of day every frame', /this\.updateAir\(dt\);/.test(game));

process.exit(f ? 1 : 0);
