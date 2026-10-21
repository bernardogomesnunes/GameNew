import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { validateBrowserReport } from './validate.js';

const budgets = JSON.parse(readFileSync(new URL('./budgets.json', import.meta.url), 'utf8'));
const server = await createServer({ configFile: false, envDir: false,
  define: { 'import.meta.env.VITE_NEON_URL': JSON.stringify('') },
  server: { host: '127.0.0.1', port: 0, hmr: false },
});
let browser;
const errors = [], failures = [];
try {
  await server.listen();
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return url.hostname === '127.0.0.1' || url.protocol === 'blob:' || url.protocol === 'data:' ? route.continue() : route.abort();
  });
  await page.goto(new URL('tools/performance/browser.html', server.resolvedUrls.local[0]).href);
  await page.waitForFunction(() => window.performanceFinished, null, { timeout: 180_000 });
  const report = await page.evaluate(() => window.performanceReport);
  report.environment = 'Headless Chromium / SwiftShader; timings are diagnostic, not phone FPS';
  failures.push(...validateBrowserReport(report,budgets));
  failures.push(...errors);
  report.failures = failures;
  mkdirSync('artifacts/performance', { recursive: true });
  writeFileSync('artifacts/performance/browser.json', JSON.stringify(report, null, 2) + '\n');
  await page.screenshot({ path: 'artifacts/performance/browser.png' });
  assert.deepEqual(failures, []);
  console.log(`PASS browser performance: ${Object.keys(report.scenes).length} terrain scenes, GLB crowd, rebuilds, disposal, no context losses`);
} finally {
  await browser?.close();
  await server.close();
}
