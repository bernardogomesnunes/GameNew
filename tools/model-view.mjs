// Renders models alone on a plain background, to check them: node tools/model-view.mjs ids poseJSON out.png [yawDeg] [pitchDeg]
// A pose of {"state": {...}} is a person's state (src/render/personPose.js makeState), posed the way SettlerView poses them.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
const server = await createServer({ configFile: false, envDir: false, define: { 'import.meta.env.VITE_NEON_URL': JSON.stringify('') },
  server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), fileURLToPath(new URL('../../../../', import.meta.resolve('vite')))] } } });
await server.listen();
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ids = process.argv[2].split(',');
const page = await browser.newPage({ viewport: { width: 520 * ids.length, height: 460 } });
page.on('pageerror', (e) => console.log('ERR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text()); });
await page.route('**/*', (r) => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
await page.goto(server.resolvedUrls.local[0] + 'index.html');
await page.waitForFunction(() => window.__game && !window.__game.booting, null, { timeout: 120000 });
await page.evaluate(async ([ids, pose, yaw, pitch]) => {
  const g = window.__game; await g.modelsLoaded;
  const THREE = await import('/node_modules/three/build/three.module.js');
  const { Crowd, modelKit } = await import('/src/render/Models.js');
  const { makePose, makeState, posePerson, traitsOf } = await import('/src/render/personPose.js');
  document.body.innerHTML = '';
  document.body.style.margin = 0;
  for (const id of ids) {
    const kit = modelKit(id);
    const r = new THREE.WebGLRenderer({ antialias: true }); r.setSize(520, 460); r.setClearColor(0xe8f0ee);
    document.body.appendChild(r.domElement); r.domElement.style.display = 'inline-block';
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8a7a, 1.6)); const d = new THREE.DirectionalLight(0xffffff, 1.8); d.position.set(3, 6, 4); scene.add(d);
    const c = new Crowd(scene, kit, 1); c.begin(); const given = JSON.parse(pose);
    const posed = given.state ? posePerson(makePose(), { ...makeState(), ...given.state }, traitsOf(id)) : given;
    c.add(new THREE.Matrix4().makeTranslation(0, -(posed.drop ?? 0), 0), posed); c.end();
    const box = new THREE.Box3();
    for (const m of c.meshes) if (m) { m.computeBoundingBox?.(); m.updateMatrixWorld(); const b = new THREE.Box3().setFromObject(m); box.union(b); }
    const s = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
    const R = Math.max(s.x, s.y, s.z);
    const cam = new THREE.PerspectiveCamera(35, 520 / 460, 0.05, 500);
    const yw = yaw * Math.PI / 180, pt = pitch * Math.PI / 180;
    cam.position.set(ctr.x + Math.sin(yw) * Math.cos(pt) * R * 1.9, ctr.y + Math.sin(pt) * R * 1.9, ctr.z + Math.cos(yw) * Math.cos(pt) * R * 1.9);
    cam.lookAt(ctr);
    r.render(scene, cam);
    const lab = document.createElement('div'); lab.textContent = `${id} ${s.x.toFixed(1)}w ${s.y.toFixed(1)}h ${s.z.toFixed(1)}l`;
    lab.style.cssText = 'position:absolute;font:14px sans-serif;margin:-450px 0 0 10px'; document.body.appendChild(lab);
  }
}, [ids, process.argv[3] ?? '{}', Number(process.argv[5] ?? -140), Number(process.argv[6] ?? 22)]);
await page.waitForTimeout(500);
await page.screenshot({ path: process.argv[4] });
await browser.close(); await server.close();
