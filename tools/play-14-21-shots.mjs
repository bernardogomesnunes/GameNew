// Writes the PLAY-14 to 21 screenshots: node tools/play-14-21-shots.mjs [outDir]
// Serves tools/play-14-21-view.html through Vite, like tools/model-view.mjs, and shoots each set at device scale 1.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const out = process.argv[2] ?? 'docs/screens/play-14-21';
mkdirSync(out, { recursive: true });
const server = await createServer({ configFile: false, envDir: false, define: { 'import.meta.env.VITE_NEON_URL': JSON.stringify('') },
  server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), fileURLToPath(new URL('../../../../', import.meta.resolve('vite')))] } } });
await server.listen();
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const set of ['mushy-logs', 'wild-mushrooms', 'machines']) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 640 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log('ERR', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text()); });
  await page.goto(`${server.resolvedUrls.local[0]}tools/play-14-21-view.html?set=${set}`);
  await page.waitForFunction(() => window.__done, null, { timeout: 60000 });
  await page.screenshot({ path: `${out}/${set}.png`, fullPage: true });
  await page.close();
  console.log('wrote', `${out}/${set}.png`);
}
await browser.close(); await server.close();
