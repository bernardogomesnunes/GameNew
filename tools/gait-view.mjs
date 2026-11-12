// Four frames of an animal's gait, side on, to check render/mobGaits.js:
//   node tools/gait-view.mjs <id> <walk|run|graze|idle> out.png [yawDeg]
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
const server = await createServer({ configFile: false, envDir: false, define: { 'import.meta.env.VITE_NEON_URL': JSON.stringify('') },
  server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), fileURLToPath(new URL('../../../../', import.meta.resolve('vite')))] } } });
await server.listen();
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const [id, mode = 'walk', out = 'gait.png', yaw = '90'] = process.argv.slice(2);
const W = 380, Hh = 340, N = 4;
const page = await browser.newPage({ viewport: { width: W * N, height: Hh } });
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.route('**/*', (r) => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
await page.goto(server.resolvedUrls.local[0] + 'index.html');
await page.waitForFunction(() => window.__game && !window.__game.booting, null, { timeout: 120000 });
await page.evaluate(async ([id, mode, yaw, W, Hh, N]) => {
  const g = window.__game; await g.modelsLoaded;
  const THREE = await import('/node_modules/three/build/three.module.js');
  const { Crowd, modelKit } = await import('/src/render/Models.js');
  const { MOBS_BY_ID } = await import('/src/config/mobs.js');
  const { GAITS, gaitPose, beastPose, dinoPose, makePose, strideLength } = await import('/src/render/mobGaits.js');
  document.body.innerHTML = ''; document.body.style.margin = 0; document.body.style.whiteSpace = 'nowrap';
  const kit = modelKit(id);
  const type = id === 'moon_cow' ? 'cow' : id;
  const spec = MOBS_BY_ID.get(type);
  const gait = GAITS[type];
  let box = null;
  for (let f = 0; f < N; f++) {
    const pose = makePose();
    const running = mode === 'run', moving = mode === 'walk' || running;
    const t = 3 + f * (mode === 'graze' || mode === 'idle' ? 0.9 : 0.1);
    if (spec && !gait) {
      const speed = moving ? (running ? spec.run : spec.walk) : 0;
      const len = strideLength(type === 'raptor' ? 'strut' : running ? 'trot' : 'walk', spec.leg, speed);
      dinoPose(pose, { type, speed, stride: (f / N) * len, grazing: mode === 'graze', chasing: running }, t, 0, 0, 0, 0, spec);
    } else if (spec) {
      const speed = moving ? (running ? spec.run : spec.walk) : 0;
      const len = strideLength(running ? gait.run : gait.walk, spec.leg, speed);
      beastPose(pose, { type, speed, stride: (f / N) * len, grazing: mode === 'graze' }, spec, t, 0, 0, 0);
    } else {
      gaitPose(pose, gait, { p: f / N, moving, running, size: 2.4, t, grazing: mode === 'graze', chasing: false, look: 0, nod: 0 });
    }
    const r = new THREE.WebGLRenderer({ antialias: true }); r.setSize(W, Hh); r.setClearColor(0xe8f0ee);
    document.body.appendChild(r.domElement); r.domElement.style.display = 'inline-block';
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8a7a, 1.6)); const d = new THREE.DirectionalLight(0xffffff, 1.8); d.position.set(3, 6, 4); scene.add(d);
    const c = new Crowd(scene, kit, 1); c.begin(); c.add(new THREE.Matrix4().makeTranslation(0, pose.lift, 0), f === 0 && !box ? null : pose); c.end();
    if (!box) {
      box = new THREE.Box3();
      for (const m of c.meshes) if (m) { m.updateMatrixWorld(); box.union(new THREE.Box3().setFromObject(m)); }
      c.begin(); c.add(new THREE.Matrix4().makeTranslation(0, pose.lift, 0), pose); c.end();
    }
    const s = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
    const R = Math.max(s.x, s.y, s.z);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(R * 6, R * 6), new THREE.MeshLambertMaterial({ color: 0xb8cfc4 }));
    ground.rotation.x = -Math.PI / 2; scene.add(ground);
    const cam = new THREE.PerspectiveCamera(35, W / Hh, 0.05, 500);
    const yw = yaw * Math.PI / 180, pt = 8 * Math.PI / 180;
    cam.position.set(ctr.x + Math.sin(yw) * Math.cos(pt) * R * 2.1, ctr.y + Math.sin(pt) * R * 2.1, ctr.z + Math.cos(yw) * Math.cos(pt) * R * 2.1);
    cam.lookAt(ctr);
    r.render(scene, cam);
  }
}, [id, mode, Number(yaw), W, Hh, N]);
await page.waitForTimeout(400);
await page.screenshot({ path: out });
await browser.close(); await server.close();
