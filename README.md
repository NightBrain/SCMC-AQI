# SCMC-AQI

หน้าแสดงคุณภาพอากาศ (AQI) และอุณหภูมิของสถานี ACAIR CMU สร้างด้วย Next.js และรันด้วย Docker

| URL | หน้า |
|---|---|
| `/` | จอ signage แสดง AQI + อุณหภูมิ |
| `/v2` | dashboard รายละเอียด (มลพิษ, สภาพอากาศ, กราฟ 24 ชม., สลับธีมสว่าง/มืด) |
| `/api/air` | ข้อมูลจาก CMU (server เรียก CMU ให้ แล้ว cache ไว้ 5 นาที) |

เบราว์เซอร์เรียกเฉพาะ server ของเราเอง ไม่ใช้ตัวกลางภายนอก (เดิมใช้ `r.jina.ai` / `allorigins`)
ถ้า CMU ล่ม `/api/air` จะส่งค่าล่าสุดที่มีให้ (header `X-Air-Stale: 1`) และตอบ 502 เมื่อไม่เคยได้ข้อมูลเลย

## รันด้วย Docker

```bash
docker compose up -d --build
```

เปิด `http://<server>:6500/` (หมายเหตุ: Docker เปิด port ผ่าน iptables โดยตรง กฎของ `ufw` อาจไม่มีผล
ถ้าไม่อยากเปิดออกอินเทอร์เน็ต ให้ผูกกับ `127.0.0.1` แล้วให้ reverse proxy รับหน้าด่านแทน)

| ตัวแปร | ค่าเริ่มต้น | ความหมาย |
|---|---|---|
| `HOST_PORT` | `6500` | port ฝั่ง host (ใน container ใช้ 3000) |
| `MEM_LIMIT` | `192m` | RAM สูงสุด (ไม่ใช้ swap) |
| `CPU_LIMIT` | `0.25` | CPU สูงสุด (core) |

ตัวอย่าง: `HOST_PORT=8080 docker compose up -d` — อย่าใช้ port ที่เบราว์เซอร์บล็อก (เช่น 101, 6000, 6665–6669) และ
ตัวแปรให้ตั้งทุกครั้งที่รัน หรือใส่ในไฟล์ `.env` ข้างๆ `docker-compose.yml`

ลิมิตออกแบบไว้สำหรับ server 2 core / 2 GB ที่รันราว 40 container (ดู `docker-compose.yml`)
วัดจริง: ใช้ RAM ราว 48 MiB ตอนว่าง และราว 55 MiB หลังยิงโหลด 450 request

HTTPS / โดเมน: ไม่ได้รวมมาให้ ใช้ reverse proxy ของ server (เช่น Caddy, nginx) ชี้มาที่ port ข้างต้น

> เว็บนี้เคยอยู่บน GitHub Pages ซึ่งรัน Next.js ไม่ได้ จอ signage ที่ชี้ URL เดิมต้องเปลี่ยนไปชี้ URL ของ server ใหม่

## โครงสร้างหน้าเว็บ (ทำไมไม่ใช้ React ในหน้า)

หน้า `/` และ `/v2` เสิร์ฟ markup เป็น HTML ดิบ และตรรกะของหน้า (ดึงข้อมูล, เวลา, กราฟ) เป็นสคริปต์ ES5 แยก
`public/js/signage.js` / `public/js/dashboard.js` ที่โหลดด้วย `<script src>` ปกติ **ไม่ขึ้นกับ bundle ของ React/Next**
เพื่อให้จอ signage และเบราว์เซอร์ในแอปรุ่นเก่า (LINE / Android WebView) ยังแสดงข้อมูลได้ แม้ bundle ของ Next จะโหลดหรือรันไม่ได้
(มีตัวกันเหนียว: ถ้า script ไม่เริ่มทำงานใน 30 วินาที หน้าจะรีโหลดเอง)

- ต้นฉบับ TypeScript อยู่ที่ `lib/legacy/` — `npm run build:legacy` รวมเป็น ES5 ไว้ที่ `public/js/` (สร้างอัตโนมัติก่อน `dev`/`build`, ไม่ commit)
- HTML ของหน้าไม่ถูก cache ยาว (`force-dynamic`) หลัง redeploy จึงไม่ค้างของเก่า

## พัฒนา

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # unit test (vitest)
npm run build
npm run e2e      # ทดสอบในเบราว์เซอร์จริง (ต้อง build ก่อน): hydration ไม่ล้างข้อมูล, ใช้งานได้แม้ไม่มี bundle ของ Next, ตัวชดเชยฟอนต์นิ่ง, cache header
```

ตั้งค่า `HOST_PORT` / `MEM_LIMIT` / `CPU_LIMIT` ในไฟล์ `.env` ได้ (ไฟล์นี้ไม่ถูกคัดลอกเข้า image)

## ตรวจหน้าตาเทียบกับหน้า HTML เดิม

`scripts/visual-parity.mjs` ถ่ายภาพหน้าเดิมกับหน้าใหม่ 3 ขนาดจอ แล้วเทียบพิกเซล (ต้องต่างกัน < 0.5%)
ไฟล์ HTML เดิมถูกลบแล้ว ดึงกลับมาจาก git ได้:

```bash
mkdir /tmp/legacy && git archive 15045c9 index.html v2 | tar -x -C /tmp/legacy
npx playwright install chromium
npm run build
node scripts/visual-parity.mjs --legacy-dir /tmp/legacy        # เทียบกับ next start
NEXT_URL=http://localhost:6500 node scripts/visual-parity.mjs --legacy-dir /tmp/legacy   # เทียบกับ Docker
```
