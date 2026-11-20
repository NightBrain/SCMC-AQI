// รวม lib/legacy/entry-*.ts เป็นสคริปต์ ES5 ธรรมดา (IIFE) ไว้ที่ public/js/
// หน้าเว็บโหลดด้วย <script src> ปกติ จึงไม่ขึ้นกับ bundle ของ React/Next (รองรับ LINE / Android WebView รุ่นเก่า)
import { build } from 'esbuild';

const entries = [
  ['lib/legacy/entry-signage.ts', 'public/js/signage.js'],
  ['lib/legacy/entry-dashboard.ts', 'public/js/dashboard.js'],
];
for (const [entry, outfile] of entries) {
  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    minify: true,
    target: 'es5',
    format: 'iife',
    legalComments: 'none',
    logLevel: 'warning',
  });
  console.log('built', outfile);
}
