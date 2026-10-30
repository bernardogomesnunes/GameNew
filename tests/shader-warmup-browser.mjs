import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';

// Standalone real renderer: no game, storage, network accounts or workload caps.
const server = await createServer({ configFile: false, envDir: false,
  server: { host: '127.0.0.1', port: 0, hmr: false } });
server.middlewares.use((request, response, next) => {
  if (request.url !== '/shader-fixture') return next();
  response.setHeader('Content-Type', 'text/html');
  response.end('<!doctype html><html><body></body></html>');
});
let browser, watchdog;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: process.env.RENDER_HARDWARE ? [] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(new URL('/shader-fixture', server.resolvedUrls.local[0]).href);
  const result = await Promise.race([page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { ShaderWarmup } = await import('/src/render/ShaderWarmup.js');
    const { FlameView } = await import('/src/render/FlameView.js');
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(640, 480); document.body.appendChild(renderer.domElement);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(55, 640 / 480, 0.1, 100);
    camera.position.set(0, 1, 5); camera.lookAt(0, 0.5, 0);
    const flames = new FlameView(scene);
    flames.fires[0].group.visible = true;
    const before = flames.fires.map(fire => fire.group.visible);
    const compileAsync = renderer.compileAsync.bind(renderer);
    let compiles = 0;
    renderer.compileAsync = (...args) => { compiles++; return compileAsync(...args); };
    const warmup = new ShaderWarmup(renderer);
    let opened = false, drawn = 0, loops = 0, drawsAfterOpen = 0;
    let initialWaitMs = 0, maxRenderMs = 0;
    const start = performance.now();
    while (drawn < 30) {
      await new Promise(requestAnimationFrame);
      const ready = warmup.ready(scene, camera); loops++;
      if (opened) {
        if (!ready) throw new Error('A shader/material change closed presentation after initial warmup');
        drawsAfterOpen++;
      }
      if (ready) {
        if (!opened) initialWaitMs = performance.now() - start;
        opened = true;
        const renderStart = performance.now();
        renderer.render(scene, camera); drawn++;
        maxRenderMs = Math.max(maxRenderMs, performance.now() - renderStart);
        if (drawn === 10) {
          const material = new THREE.MeshLambertMaterial();
          material.map = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
          material.map.needsUpdate = true;
          scene.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), material), new THREE.PointLight());
        }
      }
      // This is a rendering-correctness check, including software WebGL in
      // CI. Readiness must open and stay open; driver speed is reported, not
      // mistaken for a functional failure. Hardware timing has its own gate.
      if (loops > 120) throw new Error(`Shader fixture failed to present 30 frames (${drawn} draws, ${compiles} preparations)`);
    }
    const summary = { drawn, loops, drawsAfterOpen, compiles,
      parallel: renderer.extensions.has('KHR_parallel_shader_compile'), version: flames.material.version,
      visibilityPreserved: JSON.stringify(before) === JSON.stringify(flames.fires.map(fire => fire.group.visible)),
      doubleSided: flames.material.side === THREE.DoubleSide, forceSinglePass: flames.material.forceSinglePass,
      contextLost: renderer.getContext().isContextLost(), initialWaitMs, maxRenderMs,
      elapsedMs: performance.now() - start };
    scene.traverse(object => {
      object.geometry?.dispose();
      for (const material of [object.material].flat().filter(Boolean)) { material.map?.dispose(); material.dispose(); }
    });
    renderer.dispose();
    return summary;
  }), new Promise((_,reject) => { watchdog = setTimeout(() => reject(new Error('Shader browser check hung for 120 seconds')),120000); })]);
  clearTimeout(watchdog);
  assert.equal(result.drawn, 30);
  assert.equal(result.drawsAfterOpen, 29);
  assert.equal(result.compiles, result.parallel ? 1 : 0);
  assert.ok(result.version > 0, 'real Three rendering must exercise transparent material version writes');
  assert.equal(result.visibilityPreserved, true);
  assert.equal(result.doubleSided, true);
  assert.equal(result.forceSinglePass, false);
  assert.equal(result.contextLost, false);
  assert.deepEqual(errors, []);
  console.log('PASS real shader warmup keeps 30 presented frames continuous after initial preparation: ' + JSON.stringify(result));
} finally { clearTimeout(watchdog); await browser?.close(); await server.close(); }
