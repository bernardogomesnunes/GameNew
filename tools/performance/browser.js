import * as THREE from 'three';
import { SCENARIOS, createScenario, meshMetrics } from './scenarios.js';
import { Crowd, loadModels, modelKit } from '../../src/render/Models.js';

// Harness only. The game never imports this module or gathers these records.
const report = { scenes: {}, resources: [], contextLosses: 0 };
window.performanceReport = report;
window.performanceFinished = false;
const renderer = new THREE.WebGLRenderer({ antialias: false });
// renderer.info counts shared geometries/textures, but not instance buffers.
// Track actual allocations in this isolated context to catch Crowd leaks too.
const gl = renderer.getContext(), buffers = new Set();
const createBuffer = gl.createBuffer.bind(gl), deleteBuffer = gl.deleteBuffer.bind(gl);
gl.createBuffer = () => {
  const buffer = createBuffer();
  if (buffer) buffers.add(buffer);
  return buffer;
};
gl.deleteBuffer = (buffer) => { buffers.delete(buffer); deleteBuffer(buffer); };
renderer.setPixelRatio(1);
renderer.setSize(640, 480);
document.body.append(renderer.domElement);
renderer.domElement.addEventListener('webglcontextlost', () => report.contextLosses++);

function renderSample(scene, camera) {
  renderer.render(scene, camera);
  return { drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
    geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures };
}

async function run() {
  for (const spec of SCENARIOS) {
    const fixture = createScenario(spec);
    const camera = new THREE.PerspectiveCamera(60, 640 / 480, 0.1, 1000);
    fixture.scene.add(new THREE.HemisphereLight(0xffffff, 0x555555, 2));
    camera.position.set(fixture.x + 60, fixture.y + 65, fixture.z + 60);
    camera.lookAt(fixture.x, fixture.y - 8, fixture.z);
    const entry = report.scenes[spec.id] = { ...meshMetrics(fixture), cycles: [] };
    // Both surface and underground views are needed: hiding every deep mesh
    // can make a cheap surface look healthy while a cave still overloads.
    for (const mesh of fixture.mesher.activeMeshes) mesh.visible = !mesh.userData.deep;
    renderSample(fixture.scene, camera); // compile/upload before timing
    const frames = [];
    for (let frame = 0; frame < 20; frame++) {
      const before = performance.now();
      entry.surface = renderSample(fixture.scene, camera);
      frames.push(performance.now() - before);
      await new Promise(requestAnimationFrame);
    }
    frames.sort((a, b) => a - b);
    entry.renderSubmitP95Ms = frames[Math.ceil(frames.length * 0.95) - 1];
    for (const mesh of fixture.mesher.activeMeshes) mesh.visible = true;
    camera.position.set(fixture.x, 20, fixture.z);
    camera.lookAt(fixture.x + 24, 20, fixture.z);
    entry.underground = renderSample(fixture.scene, camera);
    // Upload -> rebuild -> upload -> dispose, repeatedly. Counts must return
    // to the same baseline; shared shader/material caches may remain alive.
    for (let cycle = 0; cycle < 3; cycle++) {
      meshMetrics(fixture);
      renderSample(fixture.scene, camera);
      fixture.mesher.clearAll();
      renderSample(fixture.scene, camera);
      entry.cycles.push({ ...renderer.info.memory, buffers: buffers.size });
      if (fixture.mesher.activeMeshes.size) throw new Error('Terrain meshes survived clearAll');
    }
    report.resources.push({ ...renderer.info.memory });
  }

  await loadModels('/models/');
  const kit = modelKit('cow');
  if (!kit) throw new Error('Crowd benchmark requires the actual cow GLB');
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x555555, 2));
  const camera = new THREE.PerspectiveCamera(60, 640 / 480, 0.1, 100);
  camera.position.set(16, 20, 30); camera.lookAt(8, 0, 8);
  const crowdCycles = [];
  for (let cycle = 0; cycle < 4; cycle++) {
    const crowd = new Crowd(scene, kit, 24);
    crowd.begin();
    for (let i = 0; i < 24; i++) crowd.add(new THREE.Matrix4().makeTranslation(i % 6 * 3, 0, Math.floor(i / 6) * 3));
    crowd.end();
    report.crowd = renderSample(scene, camera);
    crowd.dispose();
    renderSample(scene, camera);
    crowdCycles.push({ ...renderer.info.memory, buffers: buffers.size });
  }
  report.crowd.cycles = crowdCycles;
}

run().catch((error) => { report.error = error.stack || error.message; }).finally(() => {
  renderer.dispose();
  window.performanceFinished = true;
});
