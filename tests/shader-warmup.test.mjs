import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ShaderWarmup } from '../src/render/ShaderWarmup.js';
import { FlameView } from '../src/render/FlameView.js';

function fixture(compile) {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshLambertMaterial()));
  let time = 1000;
  const jobs = [], events = new EventTarget();
  const renderer = { domElement: events, extensions: { has: () => true }, compileAsync(s, c) {
    assert.equal(s, scene); assert.equal(c, camera);
    compile?.(s);
    return new Promise((resolve, reject) => jobs.push({ resolve, reject }));
  } };
  const warmup = new ShaderWarmup(renderer, { now: () => time });
  return { scene, camera, jobs, events, warmup, at: value => { time = value; }, ready: () => warmup.ready(scene, camera) };
}
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };

{
  const f = fixture();
  assert.equal(f.ready(), false);
  assert.equal(f.ready(), false);
  assert.equal(f.jobs.length, 1, 'only one initial compilation may be pending');
  f.jobs[0].resolve(); await settle();
  assert.equal(f.ready(), true);
  const extra = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshLambertMaterial());
  f.scene.add(extra, new THREE.PointLight());
  extra.material.map = new THREE.Texture(); extra.material.needsUpdate = true;
  assert.equal(f.ready(), true, 'new shader variants use the ordinary renderer after initial warmup');
  extra.visible = false;
  assert.equal(f.ready(), true, 'an already warmed subset cannot close the render path');
  extra.material.dispose();
  assert.equal(f.ready(), true, 'disposing streamed materials cannot close the render path');
  assert.equal(f.jobs.length, 1);
  console.log('PASS shader warmup opens once; material, light, map, visibility and disposal changes cannot suspend rendering');
}

{
  // Match Three WebGLRenderer.prepareMaterial and renderObject: transparent
  // DoubleSide materials increment version for each back/front pass. These
  // renderer-owned writes must not become new shader work forever.
  const passes = material => {
    if (!material.transparent || material.side !== THREE.DoubleSide || material.forceSinglePass) return;
    material.side = THREE.BackSide; material.needsUpdate = true;
    material.side = THREE.FrontSide; material.needsUpdate = true;
    material.side = THREE.DoubleSide;
  };
  const f = fixture(scene => scene.traverse(object => { if (object.isMesh) passes(object.material); }));
  const flames = new FlameView(f.scene);
  flames.fires[0].group.visible = true;
  const visibleBefore = flames.fires.map(fire => fire.group.visible);
  assert.equal(f.ready(), false);
  assert.equal(flames.material.version, 72, 'compile visits all 36 flame meshes, including hidden groups');
  f.jobs[0].resolve(); await settle();
  for (let frame = 0; frame < 20; frame++) {
    assert.equal(f.ready(), true);
    f.scene.traverseVisible(object => { if (object.isMesh) passes(object.material); });
  }
  assert.equal(f.jobs.length, 1, 'Three-owned version increments cannot cause repeated compilation');
  assert.deepEqual(flames.fires.map(fire => fire.group.visible), visibleBefore);
  assert.equal(flames.material.side, THREE.DoubleSide);
  assert.equal(flames.material.forceSinglePass, false, 'two-sided visual behavior is preserved');
  console.log('PASS real FlameView keeps rendering through Three transparent DoubleSide version changes');
}

{
  const f = fixture();
  assert.equal(f.ready(), false);
  f.at(1499); f.scene.add(new THREE.PointLight());
  assert.equal(f.ready(), false);
  f.at(1500);
  assert.equal(f.ready(), true, 'a pending initial compile has an absolute 500 ms deadline');
  for (let frame = 0; frame < 100; frame++) {
    f.scene.children[0].material.needsUpdate = true;
    assert.equal(f.ready(), true);
  }
  assert.equal(f.jobs.length, 1, 'scene churn cannot restart the deadline or schedule another gate');
  f.jobs[0].resolve(); await settle(); assert.equal(f.ready(), true);
  console.log('PASS a stalled shader promise cannot gate drawing beyond 500 ms or restart under scene churn');
}

{
  const f = fixture();
  assert.equal(f.ready(), false);
  const oldJob = f.jobs[0];
  f.events.dispatchEvent(new Event('webglcontextrestored'));
  assert.equal(f.ready(), false);
  const currentJob = f.jobs[1];
  oldJob.resolve(); await settle();
  assert.equal(f.ready(), false, 'completion from an older context cannot open its replacement');
  currentJob.resolve(); await settle(); assert.equal(f.ready(), true);
  f.events.dispatchEvent(new Event('webglcontextrestored'));
  f.at(2000); assert.equal(f.ready(), false);
  f.at(2500); assert.equal(f.ready(), true);
  assert.equal(f.jobs.length, 3);
  console.log('PASS context restoration gets a fresh bounded warmup and ignores stale completions');
}

{
  const f = fixture();
  assert.equal(f.ready(), false);
  f.jobs[0].reject(new Error('context unavailable')); await settle();
  assert.equal(f.ready(), true, 'failed warmup must retain ordinary rendering and its diagnostics');
  let calls = 0;
  const thrown = new ShaderWarmup({ extensions: { has: () => true }, compileAsync() { calls++; throw new Error('unavailable'); } });
  assert.equal(thrown.ready(f.scene, f.camera), true);
  assert.equal(thrown.ready(f.scene, f.camera), true); assert.equal(calls, 1);
  const unsupported = new ShaderWarmup({ extensions: { has: () => false }, compileAsync() { throw new Error('must not compile'); } });
  assert.equal(unsupported.ready(f.scene, f.camera), true);
  console.log('PASS unsupported, thrown and rejected preparation retain the original renderer path');
}

{
  let time = 0;
  const warmup = new ShaderWarmup({ extensions: { has: () => true }, compileAsync() {
    time = 501; return new Promise(() => {});
  } }, { now: () => time });
  assert.equal(warmup.ready(new THREE.Scene(), new THREE.PerspectiveCamera()), true,
    'the synchronous part of compileAsync also counts against the initial wait');
  console.log('PASS synchronous compilation setup cannot add a fresh 500 ms wait afterward');
}
