import assert from 'node:assert/strict';
import { preview } from 'vite';
import { chromium } from 'playwright';

// Run after `npm run build`: exercise the deployed chunk graph, including workers.
const server = await preview({ configFile: false, envDir: false, preview: { host: '127.0.0.1', port: 0 } });
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext();
  const requested = [], errors = [];
  context.on('request', request => requested.push(new URL(request.url()).pathname));
  await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => document.querySelector('#loading')?.classList.contains('ld-gone'), null, { timeout: 120000 });
  const startup = requested.slice();
  assert.equal(startup.some(path => /\/(?:skyKingdom|SkyRuntime|WarRuntime)-/.test(path)), false,
    'deployed page and startup workers must not request planned Sky or war chunks');
  await page.locator('[data-new]').click();
  await page.locator('[data-kind="creative"]').click();
  await page.locator('[data-next]').click();
  await page.locator('#home-world-name').fill('Deferred production world');
  await page.locator('[data-create]').click();
  await page.waitForFunction(() => document.querySelector('#loading')?.classList.contains('ld-gone'), null, { timeout: 120000 });
  assert.ok(requested.some(path => /\/SkyRuntime-/.test(path)), 'creating Creative loads Sky behavior');
  assert.ok(requested.some(path => /\/skyKingdom-/.test(path)), 'Sky planning loads when Creative makes it available');
  assert.equal(requested.some(path => /\/WarRuntime-/.test(path)), false, 'Creative does not load enemy war simulation');
  await page.locator('#btn-map').click({ force: true });
  await page.locator('[data-travel="sky"]').waitFor();
  await page.locator('[data-travel="sky"]').click();
  await page.waitForTimeout(1500);
  assert.deepEqual(errors, []);
  console.log('PASS deployed lazy chunks: startup and workers omit Sky/war; Creative loads Sky and travels there without loading war');
} finally {
  await browser?.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
