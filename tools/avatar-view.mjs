// Renders the player's avatar alone, once per state, to check its shape and poses:
//   node tools/avatar-view.mjs out.png '[{"velocity":{"x":0,"y":0,"z":-4.3}}, {"swing":0.6}, {"draw":1}]' [yawDeg] [pitchDeg]
// Each state is laid over a standing player; `swing` (1..0 through a blow), `block`, `draw`, `worn`, `held` and `frames` are the view's own.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
const server = await createServer({ configFile: false, envDir: false, define: { 'import.meta.env.VITE_NEON_URL': JSON.stringify('') },
  server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), fileURLToPath(new URL('../../../../', import.meta.resolve('vite')))] } } });
await server.listen();
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const states = JSON.parse(process.argv[3] ?? '[{}]');
const page = await browser.newPage({ viewport: { width: 380 * states.length, height: 460 } });
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.route('**/*', (r) => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
await page.goto(server.resolvedUrls.local[0] + 'index.html');
await page.waitForFunction(() => window.__game && !window.__game.booting, null, { timeout: 120000 });
await page.evaluate(async ([states, yaw, pitch]) => {
  const THREE = await import('/node_modules/three/build/three.module.js');
  const { AvatarView } = await import('/src/render/AvatarView.js');
  document.body.innerHTML = '';
  document.body.style.margin = 0;
  for (const s of states) {
    const r = new THREE.WebGLRenderer({ antialias: true }); r.setSize(380, 460); r.setClearColor(0xe8f0ee);
    document.body.appendChild(r.domElement); r.domElement.style.display = 'inline-block';
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8a7a, 1.6)); const d = new THREE.DirectionalLight(0xffffff, 1.8); d.position.set(3, 6, 4); scene.add(d);
    const view = new AvatarView(scene);
    const player = { position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, velocity: { x: 0, y: 0, z: 0 }, grounded: true, flying: false, ...s };
    const opts = { look: s.look ?? {}, worn: s.worn ?? {}, held: s.held ?? {}, visible: true, draw: s.draw ?? 0 };
    for (let i = 0; i < (s.frames ?? 30); i++) view.update(1 / 60, player, opts);
    if (s.swing != null) { view.swing = s.swing; view.update(0, player, opts); }
    if (s.block) { view.blocked = s.block; view.update(0, player, opts); }
    const cam = new THREE.PerspectiveCamera(35, 380 / 460, 0.05, 500);
    const yw = yaw * Math.PI / 180, pt = pitch * Math.PI / 180;
    cam.position.set(Math.sin(yw) * Math.cos(pt) * 4.2, 0.95 + Math.sin(pt) * 4.2, Math.cos(yw) * Math.cos(pt) * 4.2);
    cam.lookAt(0, 0.95, 0);
    r.render(scene, cam);
  }
}, [states, Number(process.argv[4] ?? -150), Number(process.argv[5] ?? 12)]);
await page.waitForTimeout(300);
await page.screenshot({ path: process.argv[2] });
await browser.close(); await server.close();
