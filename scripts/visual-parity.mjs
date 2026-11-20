// เทียบหน้าตาของหน้าเดิม (static HTML) กับหน้า Next.js ด้วยภาพถ่ายหน้าจอ
//
// ใช้: node scripts/visual-parity.mjs [--legacy-dir <dir>] [--threshold 0.5]
//   NEXT_URL=http://localhost:6500  -> เทียบกับ server ที่รันอยู่แล้ว (เช่น Docker)
//   ไม่ตั้ง NEXT_URL -> สคริปต์สั่ง `next start` ให้เอง (ต้อง `npm run build` ก่อน)
// หน้าเดิม: เสิร์ฟ index.html / v2/index.html ด้วย python3 -m http.server (ต้องมีไฟล์เดิมอยู่)
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import pngjs from 'pngjs';

const { PNG } = pngjs;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argVal = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const legacyDir = path.resolve(argVal('--legacy-dir', root));
const THRESHOLD_PCT = Number(argVal('--threshold', '0.5'));
const outDir = '/tmp/visual-parity';
mkdirSync(outDir, { recursive: true });

const fixture = readFileSync(path.join(root, 'scripts/fixtures/air.json'), 'utf8');
const FIXED_NOW = new Date('2026-11-20T04:02:00Z'); // 11:02 เวลาไทย

const VIEWPORTS = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1080x1920', width: 1080, height: 1920 },
  { name: '390x844', width: 390, height: 844 },
];
const CASES = [
  { name: 'signage', legacy: '/', next: '/', ready: '#aqi-value', theme: null },
  { name: 'v2-dark', legacy: '/v2/', next: '/v2', ready: '#val-aqi', theme: 'dark' },
  { name: 'v2-light', legacy: '/v2/', next: '/v2', ready: '#val-aqi', theme: 'light' },
];

const children = [];
function start(cmd, cmdArgs, opts) {
  const c = spawn(cmd, cmdArgs, { stdio: 'ignore', ...opts });
  children.push(c);
  return c;
}
async function waitFor(url, ms = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('server did not start: ' + url);
}
function cleanup() {
  for (const c of children) c.kill();
}
process.on('exit', cleanup);

if (!existsSync(path.join(legacyDir, 'index.html'))) {
  console.error('ไม่พบ index.html เดิมใน ' + legacyDir + ' (ใช้ --legacy-dir ชี้ไปยังโฟลเดอร์ที่มีไฟล์เดิม)');
  process.exit(2);
}

const LEGACY = 'http://127.0.0.1:3200';
start('python3', ['-m', 'http.server', '3200', '--bind', '127.0.0.1'], { cwd: legacyDir });
let NEXT = process.env.NEXT_URL;
if (!NEXT) {
  NEXT = 'http://127.0.0.1:3201';
  start('npx', ['next', 'start', '-p', '3201', '-H', '127.0.0.1'], { cwd: root });
}
await waitFor(LEGACY + '/');
await waitFor(NEXT + '/');

const cors = { 'Access-Control-Allow-Origin': '*' };
async function stubData(page) {
  // หน้าเดิม: ตัวกลางทุกตัว + CMU ตรง ได้ข้อมูลชุดเดียวกัน
  await page.route(/r\.jina\.ai|allorigins\.win|dashboard\.acair\.cmu\.ac\.th/, (route) => {
    const url = route.request().url();
    if (url.includes('r.jina.ai')) {
      return route.fulfill({ status: 200, headers: cors, contentType: 'text/plain', body: 'Title: x\n\nMarkdown Content:\n' + fixture });
    }
    if (url.includes('allorigins.win/get')) {
      return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ contents: fixture }) });
    }
    return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: fixture });
  });
  // หน้าใหม่
  await page.route('**/api/air', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: fixture }),
  );
}

async function shoot(browser, url, c, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  if (c.theme) await ctx.addInitScript((t) => localStorage.setItem('scmc-theme', t), c.theme);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(FIXED_NOW);
  await stubData(page);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction((sel) => {
    const el = document.querySelector(sel);
    return el && el.innerText.trim() !== '--';
  }, c.ready);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);
  const buf = await page.screenshot({ animations: 'disabled', caret: 'hide' });
  await ctx.close();
  return PNG.sync.read(buf);
}

const browser = await chromium.launch();
let failed = false;
console.log('case'.padEnd(10), 'viewport'.padEnd(10), 'diff%'.padStart(8), ' result');
for (const c of CASES) {
  for (const vp of VIEWPORTS) {
    const a = await shoot(browser, LEGACY + c.legacy, c, vp);
    const b = await shoot(browser, NEXT + c.next, c, vp);
    const label = `${c.name}-${vp.name}`;
    if (a.width !== b.width || a.height !== b.height) {
      console.log(c.name.padEnd(10), vp.name.padEnd(10), '   size mismatch', `${a.width}x${a.height} vs ${b.width}x${b.height}`);
      failed = true;
      continue;
    }
    const diff = new PNG({ width: a.width, height: a.height });
    const n = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
    const pct = (n / (a.width * a.height)) * 100;
    const ok = pct < THRESHOLD_PCT;
    if (!ok) failed = true;
    mkdirSync(outDir, { recursive: true });
    const fs = await import('node:fs');
    fs.writeFileSync(path.join(outDir, label + '-legacy.png'), PNG.sync.write(a));
    fs.writeFileSync(path.join(outDir, label + '-next.png'), PNG.sync.write(b));
    fs.writeFileSync(path.join(outDir, label + '-diff.png'), PNG.sync.write(diff));
    console.log(c.name.padEnd(10), vp.name.padEnd(10), pct.toFixed(3).padStart(8), ok ? ' OK' : ' FAIL');
  }
}
await browser.close();
cleanup();
console.log(failed ? `FAILED (threshold ${THRESHOLD_PCT}%) — ภาพอยู่ใน ${outDir}` : `PASSED (threshold ${THRESHOLD_PCT}%) — ภาพอยู่ใน ${outDir}`);
process.exit(failed ? 1 : 0);
