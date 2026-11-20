# ย้าย SCMC-AQI เป็น Next.js + Docker (design แบบสั้น)

สถานะ: **รออนุมัติ** (ยังไม่ได้เขียนโค้ดผลิตภัณฑ์)

## เจตนาและเหตุผล
ปัจจุบันเป็น static HTML 2 หน้าบน GitHub (`/` = จอ signage แสดง AQI+อุณหภูมิ, `/v2/` = dashboard มีประวัติ+ธีม)
ดึงข้อมูลจาก `dashboard.acair.cmu.ac.th` ผ่านตัวกลางสาธารณะ (`r.jina.ai`, `api.allorigins.win`)
เพราะ API ของ CMU ไม่เปิด CORS ตัวกลางเหล่านี้ไม่รับประกันความเสถียร (allorigins ล่มบ่อย)
เป้าหมาย: ให้ server ของเราเรียก CMU เอง เลิกพึ่งตัวกลาง และรันเป็น Docker บน server ส่วนตัว

ตรวจแล้ว: `curl` จากเครื่องไป API ของ CMU ได้ HTTP 200 + JSON ครบ (`status`, `data.aqi`, `data.temp`,
`data.timestamp`, `data.history[]`, `data.isStale`, `data.lastUpdated`)

## เป้าหมาย
- 2 หน้าเดิมทำงานและหน้าตาเหมือนเดิม (พอร์ตตรงตัว ไม่ redesign)
- เบราว์เซอร์เรียกเฉพาะ origin ของเรา (`/api/air`) ไม่เรียกตัวกลางภายนอกอีก
- `docker compose up -d` แล้วใช้งานได้ที่ port **6500** (ผู้ใช้เลือก; ตั้งผ่านตัวแปร `HOST_PORT` เปลี่ยนได้)
  - ไม่ใช้ port 101: อยู่ในรายการ unsafe port ที่ Chrome/Firefox/Safari บล็อก (ERR_UNSAFE_PORT)
  - 6500 ไม่อยู่ในรายการบล็อก และเป็น port เกิน 1024 ไม่ต้องใช้สิทธิ์ root

## Non-goals / anti-goals
- ไม่ออกแบบ UI ใหม่ ไม่เปลี่ยนสี/เกณฑ์ AQI/ตารางเวลาเช็คข้อมูล
- ไม่ทำ reverse proxy / HTTPS / โดเมนให้ (ผู้ใช้มีของตัวเองบน server)
- ไม่ตั้ง CI/CD build image (เพิ่มทีหลังได้)
- Anti-goal: ถ้า CMU ล่ม หน้าต้องไม่ว่างเปล่า (แสดงค่าล่าสุดที่มี)

## ข้อจำกัด
- CMU API ยังเป็นแหล่งข้อมูลเดียว ถ้าล่มจะได้แค่ค่า cache เก่า
- Server ต้องออกอินเทอร์เน็ตไปที่ `dashboard.acair.cmu.ac.th` ได้
- GitHub Pages รัน Next.js server ไม่ได้ จึงเลิกใช้ Pages ที่ปัจจุบัน host อยู่ (จอ signage ต้องเปลี่ยน URL)
- เบราว์เซอร์เก่า (LINE in-app / Android WebView) ที่โค้ดเดิมรองรับอยู่ ต้องคงพฤติกรรมไว้

## Approaches ที่พิจารณา
1. **พอร์ตเป็น Next.js (App Router) + route handler `/api/air` + `output: 'standalone'`** ← เลือกข้อนี้
   - ได้ server ที่เรียก CMU ตรง cache ได้ ใช้ฟอนต์/ไอคอนจาก server เราเอง image เล็ก
   - เสีย: ต้องแปลง `<script>` ก้อนใหญ่เป็น client component
2. nginx เสิร์ฟ static เดิม + proxy `/api/air` ไป CMU — เปลี่ยนน้อยสุด แต่ไม่ใช่ Next.js ตามที่ขอ
3. Next.js แบบ static export + proxy แยก — ซับซ้อนกว่า ไม่ได้ประโยชน์เพิ่ม

## Design (call ของผม — แก้ได้)
- Next.js + TypeScript, App Router: `app/page.tsx` (`/`), `app/v2/page.tsx` (`/v2`), `app/api/air/route.ts`
- `/api/air`: server เรียก CMU, cache ในหน่วยความจำ ~5 นาที, ถ้าเรียกไม่สำเร็จคืนค่า cache เก่า (ติดธง stale),
  ถ้าไม่มีเลยคืน 502 ส่ง JSON โครงเดิมของ CMU เพื่อให้ logic ฝั่ง client ใช้ต่อได้
- ฝั่ง client: คง logic เดิม (localStorage cache, เช็คที่ hh:05, retry, reload ทุกชั่วโมง, ธีม) แต่ `DATA_SOURCES` เหลือแหล่งเดียวคือ `/api/air`
- ฟอนต์ Prompt ใช้ `next/font` (self-host), Font Awesome ติดตั้งเป็น package ไม่ใช้ CDN
- `Dockerfile` multi-stage (node alpine, standalone, รันด้วย user ไม่ใช่ root), `docker-compose.yml`
  (`restart: unless-stopped`, map `${HOST_PORT:-6500}:3000` โดยแอปข้างใน container รันที่ 3000, healthcheck ที่หน้า `/` (ไม่ใช้ `/api/air` เพราะ CMU ล่มแล้วจะ unhealthy ทั้งที่แอปปกติ), timezone `Asia/Bangkok`)
- ไฟล์ HTML เดิมเก็บไว้ใน git history; ย้ายไปเป็นโค้ด Next.js ในรีโปเดียวกัน

## ลิมิตทรัพยากรของ container (ผู้ใช้ขอ — ทุก service ต้องมี)
งบของ server: CPU 2 core, RAM 2 GB, ~40 container รวมกัน (เฉลี่ย ~51 MB และ ~0.05 core ต่อตัว ก่อนหักส่วนของ OS)
ค่าเริ่มต้นที่ผมเสนอ (ปรับได้ผ่าน env): RAM สูงสุด 192 MB ไม่ใช้ swap (จอง 96 MB), CPU สูงสุด 0.25 core + `cpu_shares` 256
(ถ้า CPU ตึง แอปนี้ยอมให้ตัวอื่นก่อน), Node heap 96 MB, จำกัดจำนวน process 100,
หมุน log (10 MB × 3 ไฟล์), ห้ามยกสิทธิ์ (`no-new-privileges`, `cap_drop: ALL`), filesystem อ่านอย่างเดียว + `/tmp` เป็น tmpfs
เหตุผลของตัวเลข: แอปนี้โหลดต่ำมาก (cache 5 นาที, จอ signage ดึงทุก ~10 นาที) แต่ Next.js/Node มี RAM พื้นฐานราว 70–120 MB
จึงเกินค่าเฉลี่ย 51 MB ได้ ต้องยืมจาก container เล็กๆ (nginx ฯลฯ) ที่ใช้น้อยกว่าเฉลี่ย — ต้องวัดจริงตอนทำ Task 6
ถ้าวัดแล้วเกิน 150 MB ทางเลือกสำรองคือ nginx เสิร์ฟ static + proxy `/api/air` (ใช้ ~10 MB) ซึ่งจะต้องกลับมาคุยกับผู้ใช้

## เหลือให้ผู้สร้างตัดสินใจเอง
ชื่อ component/โครงโฟลเดอร์ย่อย, เวอร์ชัน Next.js/Node (ใช้ LTS ล่าสุดที่เสถียร), รายละเอียด cache TTL
