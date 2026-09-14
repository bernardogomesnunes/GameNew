import { chromium } from 'playwright';
import { BLOCKS } from './src/config/blocks.js';
import { ITEMS } from './src/config/items.js';
import { glyphSvg } from './src/config/glyphs.js';

const cell = (name, color, glyph, size) => `
  <div class="cell">
    <div class="sw" style="background:#${color.toString(16).padStart(6,'0')};width:${size}px;height:${size}px">
      ${glyphSvg(glyph, { size: Math.round(size * 0.7), color })}
    </div>
    <span>${name}</span>
  </div>`;

const rows = (size) => `
  <h3>at ${size}px</h3>
  <div class="grid">
    ${BLOCKS.filter(b => !b.system).map(b => cell(b.name, b.color, b.glyph, size)).join('')}
    ${ITEMS.map(i => cell(i.name, i.color, i.glyph, size)).join('')}
  </div>`;

const html = `<style>
  body { background:#11161c; color:#dfe6ee; font:13px system-ui; padding:18px; }
  h3 { font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:#8fa0b2; margin:18px 0 8px; }
  .grid { display:flex; flex-wrap:wrap; gap:14px; }
  .cell { display:flex; flex-direction:column; align-items:center; gap:4px; width:82px; }
  .sw { border-radius:6px; display:flex; align-items:center; justify-content:center;
        box-shadow: inset 0 -6px 10px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.22); }
  .cell span { font-size:10px; color:#9fb0c0; text-align:center; }
</style>${rows(26)}${rows(44)}`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 980, height: 900 }, deviceScaleFactor: 2 });
await page.setContent(html);
await page.screenshot({ path: '/tmp/claude-0/probe/glyphs.png', fullPage: true });
await browser.close();
console.log('rendered');
