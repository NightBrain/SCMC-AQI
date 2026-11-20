// ทดสอบความทนทานของหน้าเว็บในเบราว์เซอร์จริง (Playwright/Chromium)
//   1) ข้อมูลที่ script ใส่ลงหน้า ต้องไม่ถูก React hydration ล้างทิ้ง
//   2) ถ้าโหลด bundle ของ Next/React ไม่ได้ (เบราว์เซอร์เก่า / เครือข่ายสะดุด) หน้าต้องยังแสดงข้อมูลได้
//   3) HTML ของหน้าต้องไม่ถูกสั่งให้ cache ยาว (reverse proxy จะเสิร์ฟ HTML เก่าหลัง redeploy)
//
// ใช้: node scripts/e2e-resilience.mjs        (สั่ง `next start` ให้เอง ต้อง npm run build ก่อน)
//      NEXT_URL=http://localhost:6500 node scripts/e2e-resilience.mjs
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = readFileSync(path.join(root, 'scripts/fixtures/air.json'), 'utf8');

let child;
let base = process.env.NEXT_URL;
if (!base) {
  base = 'http://127.0.0.1:3202';
  child = spawn('npx', ['next', 'start', '-p', '3202', '-H', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
}
process.on('exit', () => child && child.kill());
for (let i = 0; i < 100; i++) {
  try {
    if ((await fetch(base + '/')).status < 500) break;
  } catch {
    /* not up */
  }
  await new Promise((r) => setTimeout(r, 300));
}

const PAGES = [
  { name: 'signage', url: '/', probe: '#aqi-value', expect: '22' },
  { name: 'v2', url: '/v2', probe: '#val-aqi', expect: '22' },
];
const browser = await chromium.launch();
let failures = 0;
const check = (ok, msg) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + msg);
  if (!ok) failures++;
};

async function open(url, { blockBundle }) {
  const page = await (await browser.newContext()).newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.route('**/api/air', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: fixture }));
  if (blockBundle) await page.route('**/_next/static/**/*.js', (r) => r.abort());
  await page.goto(base + url, { waitUntil: 'load' });
  return { page, errors };
}
const text = (page, sel) => page.evaluate((s) => document.querySelector(s)?.innerText?.trim(), sel);

for (const p of PAGES) {
  // 1) hydration must not wipe script-written data (wait well past hydration)
  {
    const { page, errors } = await open(p.url, { blockBundle: false });
    await page.waitForTimeout(4000);
    check((await text(page, p.probe)) === p.expect, `${p.name}: data still shown after hydration`);
    check(errors.length === 0, `${p.name}: no console/page errors (${errors.join(' | ').slice(0, 200)})`);
    await page.context().close();
  }
  // 2) works without the Next/React bundle
  {
    const { page } = await open(p.url, { blockBundle: true });
    await page.waitForTimeout(4000);
    check((await text(page, p.probe)) === p.expect, `${p.name}: shows data even when the Next bundle cannot load`);
    await page.context().close();
  }
  // 3) ตัวตรวจ text-zoom ต้องไม่ถูกฟอนต์ของหน้าหลอก: สไตล์ชีตของหน้า (เช่น rule `* { font-family: Prompt }`) ห้ามมีผลกับ probe
//    จึงบังคับ font-size/letter-spacing ทุก element ให้กว้างขึ้น ถ้า probe รับสไตล์จากหน้าจะวัดได้ > 1 แล้วย่อทั้งหน้าผิดๆ
//    (เคยเกิดเป็นครั้งคราว 2/25 โหลด เมื่อฟอนต์ Prompt โหลดเสร็จก่อน script ทำงาน)
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.route(base + p.url, async (route) => {
      const res = await route.fetch();
      const html = (await res.text()).replace('<head>', '<head><style id="inj">* { font-size: 30px !important; letter-spacing: 2px !important; }</style>');
      await route.fulfill({ response: res, body: html });
    });
    await page.route('**/api/air', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: fixture }));
    await page.goto(base + p.url, { waitUntil: 'load' });
    await page.waitForTimeout(500);
    const injected = await page.evaluate(() => !!document.getElementById('inj'));
    const tz = await page.evaluate(() => document.documentElement.style.getPropertyValue('--tz'));
    check(injected, `${p.name}: (test setup) page-CSS override was injected`);
    check(tz === '1', `${p.name}: text-zoom probe is not fooled by the page font (--tz=${tz})`);
    await ctx.close();
  }
  // 4) cache headers of the HTML document
  {
    const res = await fetch(base + p.url);
    const cc = res.headers.get('cache-control') || '';
    check(!/s-maxage=\d{5,}/.test(cc) && /no-store|no-cache|max-age=0/.test(cc), `${p.name}: HTML cache-control is not long-lived (got "${cc}")`);
  }
}
await browser.close();
console.log(failures ? `FAILED (${failures})` : 'ALL PASSED');
process.exit(failures ? 1 : 0);
