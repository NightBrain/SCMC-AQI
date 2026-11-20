# SCMC-AQI → Next.js + Docker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** แทนที่ static HTML 2 หน้า (`index.html`, `v2/index.html`) ด้วยแอป Next.js ที่มี `/api/air` เรียก CMU ฝั่ง server และรันด้วย Docker ที่ port 6500

**Architecture:** Next.js App Router แยก **route group สองตัวที่มี root layout ของตัวเอง** (`(signage)` และ `(dashboard)`) เพื่อไม่ให้ CSS ของสองหน้าปนกัน (ทั้งคู่ใช้ selector ระดับ `*`/`body`/`:root`) markup แปลงเป็น JSX แบบ static ส่วน logic เดิมที่แก้ DOM ตรงๆ ย้ายเป็นโมดูล TS ที่รันใน `useEffect` (ไม่เขียนใหม่เป็น React state) ตรรกะบริสุทธิ์ (สี/ระดับ AQI/เวลานัดเช็ค) แยกเป็นฟังก์ชันที่มี unit test

**Tech Stack:** Next.js 16 (App Router, `output: 'standalone'`), TypeScript, Vitest, `next/font/google` (Prompt), `@fortawesome/fontawesome-free`, Playwright + pixelmatch (ตรวจ visual parity), Docker (node alpine)

**Spec:** `docs/superpowers/specs/2026-11-20-nextjs-docker-design.md`

## Global Constraints
- port host **6500** → container 3000, ตั้งผ่าน `HOST_PORT` (`${HOST_PORT:-6500}:3000`)
- Upstream: `https://dashboard.acair.cmu.ac.th/api/data?reslution=` (สะกด `reslution` ตามต้นฉบับ)
- ห้ามมี `r.jina.ai` / `allorigins` เหลือในโค้ด; browser เรียกเฉพาะ `/api/air`
- หน้าตา/สี/เกณฑ์ AQI/ตารางเวลา (เช็ค hh:05, retry 60s, wait 20s, reload ทุกชม.) เหมือนเดิมทุกค่า
- โค้ดฝั่ง client คง ES5-style + `XMLHttpRequest` (รองรับ LINE in-app / Android WebView เก่า) และ query `?tz=`, `?debug`, `?t=`
- `/api/air` cache ในหน่วยความจำ TTL 5 นาที; เรียก CMU ไม่ได้ → ส่งค่า cache เก่าพร้อม header `X-Air-Stale: 1`; ไม่มี cache เลย → 502 `{"status":"error"}`
- ฟอนต์ Prompt ผ่าน `next/font` และ Font Awesome จาก package (ไม่มี CDN); container รันเป็น non-root, `TZ=Asia/Bangkok`
- **ทุก service ใน `docker-compose.yml` ต้องมีลิมิตทรัพยากร** (ค่าเริ่มต้นของ `app`, ตั้งทับผ่าน env ได้): `mem_limit: ${MEM_LIMIT:-192m}` + `memswap_limit` เท่ากัน (ห้ามใช้ swap), `mem_reservation: 96m`, `cpus: ${CPU_LIMIT:-0.25}`, `cpu_shares: 256`, `pids_limit: 100`, `NODE_OPTIONS=--max-old-space-size=96` (ให้ Node เก็บ GC ก่อนถูก OOM-kill) — งบรวมของ server คือ 2 core / 2 GB ต่อ ~40 container (เฉลี่ย ~51 MB / 0.05 core ต่อตัว) ลิมิตจึงเป็นเพดาน ไม่ใช่ค่าที่ใช้จริง, log `json-file` `max-size: 10m` `max-file: 3`, `security_opt: [no-new-privileges:true]`, `cap_drop: [ALL]`, `read_only: true` + `tmpfs: /tmp`
- ไม่ commit/ push โดยไม่ได้รับอนุญาตจากผู้ใช้ (ขั้น commit ในแผนนี้ให้ทำเฉพาะเมื่อผู้ใช้อนุญาต)

## Review Focus
1. CMU ตอบ HTML/ข้อความที่ไม่ใช่ JSON หรือ `status != "success"` → ไม่ cache ของเสีย, ใช้ค่าเก่า (test ใน Task 2)
2. CMU ช้า/ค้าง → timeout 8 วินาที แล้ว fallback (Task 2)
3. หลาย request พร้อมกันตอน cache หมด → เรียก CMU ครั้งเดียว (Task 2)
4. `history` มีค่า `"-"`/ขาดช่วง, และ `no2/so2/co/o3` เป็น `"-"` → ไม่ crash, แสดง `--` (Task 4)
5. เปิด `/v2/` (มี slash) และ `/?t=123` ต้องได้หน้าเดิม ไม่ 404 (Task 6)

---

### Task 1: Scaffold โปรเจกต์ + test runner

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.gitignore` (เพิ่ม `node_modules`, `.next`), `public/favicon.png`
- Test: `lib/smoke.test.ts` (ลบทิ้งเมื่อมี test จริง)

**Interfaces:**
- Produces: `npm run dev|build|start|test` ใช้ได้; `next.config.ts` ตั้ง `output: 'standalone'`; `public/favicon.png` (ถอดจาก data-URL ใน `index.html` บรรทัด 9)

- [ ] **Step 1:** ติดตั้ง `next react react-dom typescript @types/node @types/react @types/react-dom vitest @fortawesome/fontawesome-free` (ใช้เวอร์ชัน stable ล่าสุด)
- [ ] **Step 2:** เขียน `lib/smoke.test.ts` (`expect(1+1).toBe(2)`) แล้วรัน `npx vitest run` → PASS
- [ ] **Step 3:** ถอด base64 ของ favicon เป็น `public/favicon.png` (ตรวจด้วย `file public/favicon.png` ต้องเป็น PNG 128×128)
- [ ] **Step 4:** `npx next build` กับหน้าเปล่าชั่วคราว → สำเร็จ และมี `.next/standalone/server.js`
- [ ] **Step 5: Commit** (ถ้าผู้ใช้อนุญาต) `chore: scaffold next.js project`

### Task 2: `/api/air` (server cache + fallback)

**Files:**
- Create: `lib/air-server.ts`, `app/api/air/route.ts`
- Test: `lib/air-server.test.ts`

**Interfaces:**
- Produces:
  - `type AirPayload = { status: 'success'; data: { aqi: number|string; temp: number|string; timestamp: string; history?: unknown[]; [k: string]: unknown } }`
  - `createAirService(opts: { fetchFn?: typeof fetch; now?: () => number; ttlMs?: number; timeoutMs?: number; url?: string }): { get(): Promise<{ payload: AirPayload; stale: boolean } | null> }`
  - `route.ts`: `export const dynamic = 'force-dynamic'`; `GET` → 200 JSON (+ `Cache-Control: no-store`, `X-Air-Stale: 1` เมื่อ stale) หรือ 502 `{"status":"error"}`

- [ ] **Step 1: เขียน test ที่ fail** ใน `lib/air-server.test.ts` (mock `fetchFn`, `now`):
  - `returns fresh payload and caches within ttl` (เรียก 2 ครั้ง → `fetchFn` ถูกเรียก 1 ครั้ง)
  - `refetches after ttl expires`
  - `serves stale payload when upstream throws` → `{ stale: true }`
  - `serves stale when upstream returns HTML or status!=="success"` และไม่ทับ cache ดี
  - `returns null when upstream fails and no cache`
  - `dedupes concurrent calls while refreshing` (`Promise.all` 5 ครั้ง → `fetchFn` 1 ครั้ง)
  - `aborts after timeoutMs` (fetch ที่ไม่ resolve + fake timers)
- [ ] **Step 2:** รัน `npx vitest run lib/air-server.test.ts` → FAIL (ยังไม่มีโมดูล)
- [ ] **Step 3:** Implement `createAirService` (ใช้ `AbortSignal.timeout`, เก็บ in-flight promise, ตรวจ `status==='success' && data.aqi!==undefined`) และ `route.ts` ที่ใช้ service ตัวเดียวระดับโมดูล
- [ ] **Step 4:** รัน test → PASS; รัน `npm run dev` แล้ว `curl -i localhost:3000/api/air` ต้องได้ 200 + JSON ที่มี `data.aqi`
- [ ] **Step 5: Commit** (ถ้าอนุญาต) `feat: add /api/air with cache and stale fallback`

### Task 3: หน้า `/` (signage)

**Files:**
- Create: `app/(signage)/layout.tsx`, `app/(signage)/page.tsx`, `app/(signage)/signage.css`, `app/(signage)/SignageClient.tsx`, `lib/aqi-levels.ts`, `lib/air-client.ts`, `lib/legacy/signage.ts`
- Test: `lib/aqi-levels.test.ts`

**Interfaces:**
- Produces:
  - `lib/aqi-levels.ts`: `AQI_LEVELS` (ตารางสี/ข้อความ 6 ระดับ ค่าตรงกับ `index.html` บรรทัด ~673), `getAqiLevelIndex(aqi: number): number`, `getTempColor(t: number): string`, `tsToEpoch(ts: string): number`, `nextDelay(ts: string, now?: number): number` (ค่าคงที่เวลาตาม Global Constraints)
  - `lib/air-client.ts`: `fetchAir(done: (data: AirPayload['data'] | null) => void): void` — XHR ไป `/api/air` timeout 10 วินาที, `status !== 'success'` → `null` (ใช้ซ้ำใน Task 4)
  - `lib/legacy/signage.ts`: `startSignage(): () => void` (คืนฟังก์ชัน cleanup ล้าง timer/interval)
- Consumes: `AirPayload` จาก Task 2

- [ ] **Step 1: test ที่ fail** `lib/aqi-levels.test.ts`: `getAqiLevelIndex(50)→0`, `(51)→1`, `(500)→5`, `(9999)→5`; `getTempColor(NaN)→'#95a5a6'`, `(19.9)→'#2D8CFF'`, `(28)→'#F29900'`, `(38)→'#E00000'`; `tsToEpoch('20/11/2026 11:00:00') === Date.UTC(2026,10,20,4,0,0)` (ไม่ขึ้นกับ timezone เครื่อง); `nextDelay` ตอนต้นชั่วโมงที่ข้อมูลยังเป็นชั่วโมงก่อน → รอถึง hh:05 / ตอนอื่น ≤ 10 นาที
- [ ] **Step 2:** รัน → FAIL
- [ ] **Step 3:** ย้ายฟังก์ชันบริสุทธิ์จาก `index.html` (สคริปต์บรรทัด 545–776) เป็น `lib/aqi-levels.ts` ให้ได้ test ผ่าน; `fetchAir` ใน `lib/air-client.ts`
- [ ] **Step 4:** แปลง CSS (`index.html` บรรทัด 11–506) เป็น `signage.css` ตามเดิมทุกตัวอักษร; แปลง markup (บรรทัด 510–544) เป็น JSX (`class→className`, style string→object, ลิงก์ `v2/` → `/v2` ด้วย `<a>` ธรรมดา ไม่ใช้ `next/link`); `layout.tsx` มี `<html lang="th">` + `next/font` Prompt (400, 700) + icon `/favicon.png`
- [ ] **Step 5:** ย้ายสคริปต์ที่เหลือ (ชดเชย text-zoom `--tz`, `buildAqiScale`, `renderUI`, `refresh` ฯลฯ) เป็น `startSignage()` โดยเปลี่ยน `DATA_SOURCES` เป็น `fetchAir`; `SignageClient` เรียกใน `useEffect` แล้ว return cleanup
- [ ] **Step 6:** `npm run dev` เปิด `/` → เห็น AQI + อุณหภูมิจริง, console ไม่มี error, `rg "jina|allorigins" app lib` ว่าง
- [ ] **Step 7: Commit** (ถ้าอนุญาต) `feat: port signage page`

### Task 4: หน้า `/v2` (dashboard)

**Files:**
- Create: `app/(dashboard)/layout.tsx`, `app/(dashboard)/v2/page.tsx`, `app/(dashboard)/v2/v2.css`, `app/(dashboard)/v2/DashboardClient.tsx`, `lib/tiers.ts`, `lib/legacy/dashboard.ts`
- Test: `lib/tiers.test.ts`

**Interfaces:**
- Produces:
  - `lib/tiers.ts`: `TIERS` (ค่าจาก `v2/index.html` บรรทัด ~1347), `getTier(val: number|null): Tier`, `getPollutantStatus(type: 'pm25'|'o3'|'co'|'no2'|'so2', val: unknown): { text: string; color: string; pct: number }`, `getCompass(deg: unknown): { name: string; deg: number }`
  - `lib/legacy/dashboard.ts`: `startDashboard(): () => void`; ฟังก์ชันที่ markup เดิมเรียกผ่าน `onclick` (`toggleTheme`, `manualRefresh`, `switchMetric`) ให้ผูกด้วย `addEventListener` ใน `startDashboard` แทน (ไม่ใช้ global)
- Consumes: `fetchAir` (Task 3)

- [ ] **Step 1: test ที่ fail** `lib/tiers.test.ts`: `getTier(25).text==='คุณภาพดีมาก'`, `(26)→'คุณภาพดี'`, `(NaN)→TIERS[0]`, `(9999)→TIERS[5]`; `getPollutantStatus('pm25', 15)→{text:'ดีมาก'}`, `('pm25','-')→{text:'-', pct:0}`, `('co', 4.5)→'ปกติ'`; `getCompass(180).name==='ทิศใต้ (S)'`, `getCompass('-').name==='นิ่ง'`
- [ ] **Step 2:** รัน → FAIL
- [ ] **Step 3:** ย้ายตรรกะบริสุทธิ์เป็น `lib/tiers.ts` ให้ผ่าน
- [ ] **Step 4:** แปลง CSS (`v2/index.html` บรรทัด 21–1041) เป็น `v2.css`; markup (บรรทัด 1044–1294) เป็น JSX (ไอคอน `fa-*` ใช้ CSS ของ package; `window.__tz`/`--tz` ตามเดิม); สคริปต์ตั้งธีมก่อนวาดหน้า (บรรทัด 16–21) เป็น `<script dangerouslySetInnerHTML>` ตัวแรกใน `<body>` ของ layout นี้ และใส่ `suppressHydrationWarning` ที่ `<html>`; ลิงก์กลับหน้าแรกเป็น `<a href="/">`
- [ ] **Step 5:** ย้ายสคริปต์ (บรรทัด 1296–1771: `render`, `renderChart`, `attachTooltips`, `fitWeatherValues`, cache `aqi-v2-cache`, รีเฟรชทุก 5 นาที, reload ทุกชม., ResizeObserver) เป็น `startDashboard()` ใช้ `fetchAir`
- [ ] **Step 6:** เปิด `/v2` ตรวจมือ: สลับธีมแล้วรีโหลดค่ายังอยู่, สลับแท็บกราฟ, tooltip, ปุ่มรีเฟรช, ไม่มี error ใน console; ทดสอบ `no2` เป็น `"-"` ให้ขึ้น `--` (ใช้ Playwright route คืน JSON ที่แก้ค่า)
- [ ] **Step 7: Commit** (ถ้าอนุญาต) `feat: port v2 dashboard`

### Task 5: ตรวจ visual parity กับของเดิม

**Files:**
- Create: `scripts/visual-parity.mjs`, `scripts/fixtures/air.json` (สำเนา response จริงของ CMU ที่ fix ค่าไว้)

**Interfaces:**
- Consumes: เซิร์ฟเวอร์ Next (`npm run start`) + เซิร์ฟเวอร์ static ของไฟล์เดิม (`python3 -m http.server`)
- Produces: `node scripts/visual-parity.mjs` พิมพ์ผล diff เป็นเปอร์เซ็นต์ต่อหน้า×ขนาด และ exit code 1 ถ้าเกินเกณฑ์

- [ ] **Step 1:** สคริปต์ Playwright เปิดหน้าเดิมและหน้าใหม่ที่ viewport 1920×1080, 1080×1920, 390×844 ทั้ง `/` และ `/v2`; ดัก request ข้อมูล (ทั้ง jina/allorigins/CMU ของหน้าเดิม และ `/api/air` ของหน้าใหม่) ให้คืน `air.json`; ตั้ง `Date` คงที่ (`page.clock`) และ `reducedMotion`; ถ่ายภาพ; เทียบด้วย `pixelmatch`
- [ ] **Step 2:** รันสคริปต์ → คาดหวัง diff < 0.5% ทุกกรณี; ถ้าเกิน ให้เปิดภาพ diff แก้ CSS/markup จนผ่าน (ห้ามขยับเกณฑ์เพื่อให้ผ่าน)
- [ ] **Step 3: Commit** (ถ้าอนุญาต) `test: add visual parity script`

### Task 6: Docker, เอกสาร, เลิกใช้ไฟล์เดิม

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `README.md`
- Delete: `index.html`, `v2/index.html` (หลัง Task 5 ผ่านเท่านั้น)
- Modify: `docs/superpowers/specs/2026-11-20-nextjs-docker-design.md` (healthcheck ดูด้านล่าง)

**Interfaces:**
- Produces: `docker compose up -d` → `http://localhost:6500/`, `/v2`, `/v2/` ใช้ได้

- [ ] **Step 1:** `Dockerfile` multi-stage (deps → build → runner บน `node:*-alpine`), คัดลอก `.next/standalone`, `.next/static`, `public`; `USER node`; `ENV PORT=3000 HOSTNAME=0.0.0.0 TZ=Asia/Bangkok`; `docker-compose.yml`: `restart: unless-stopped`, `ports: ["${HOST_PORT:-6500}:3000"]`, healthcheck ด้วย `wget -qO- http://127.0.0.1:3000/ >/dev/null` (ดูหมายเหตุ) และลิมิตทั้งหมดตาม Global Constraints (ใส่ค่าใน compose ตรงๆ พร้อม `${VAR:-default}` สำหรับ `MEM_LIMIT`/`CPU_LIMIT`)
- [ ] **Step 2:** `docker compose build` สำเร็จ; `docker compose up -d`; รอจน `docker compose ps` แสดง `healthy`
- [ ] **Step 3:** ตรวจ: `curl -s -o /dev/null -w "%{http_code}" localhost:6500/` / `/v2` / `/v2/` / `/?t=123` ได้ 200 (หรือ 308→200 สำหรับ `/v2/`); `curl localhost:6500/api/air` ได้ JSON; `docker compose exec app id` ไม่ใช่ root; `HOST_PORT=6501 docker compose up -d` เปลี่ยน port ได้; ตรวจลิมิตด้วย `docker inspect <container> --format '{{.HostConfig.Memory}} {{.HostConfig.MemorySwap}} {{.HostConfig.NanoCpus}} {{.HostConfig.PidsLimit}} {{.HostConfig.ReadonlyRootfs}}'` ต้องได้ `201326592 201326592 250000000 100 true`; `docker stats --no-stream` ต้องแสดง MEM LIMIT 192MiB และ **MEM ใช้จริงหลังยิงโหลดด้านล่าง < 150MiB** (ถ้าเกิน ให้รายงานผู้ใช้พร้อมตัวเลข ห้ามเพิ่มลิมิตเองเงียบๆ) และแอปยังทำงานปกติ (ยิง `/`, `/v2`, `/api/air` ซ้ำ 50 ครั้งแล้วยัง 200 และไม่ถูก restart: `docker inspect --format '{{.RestartCount}}'` เป็น 0)
- [ ] **Step 4:** รัน `node scripts/visual-parity.mjs` กับ container อีกรอบ → ผ่าน; ลบ `index.html` และ `v2/index.html`; `README.md` สรุปวิธีรัน/เปลี่ยน port/แจ้งว่าต้องเปลี่ยน URL บนจอ signage และเลิกใช้ GitHub Pages
- [ ] **Step 5: Commit** (ถ้าอนุญาต) `feat: dockerize app and retire static pages`

**หมายเหตุ (call ของผู้เขียนแผน):** spec เดิมให้ healthcheck ยิง `/api/air` แต่ถ้า CMU ล่มจะได้ 502 ทำให้ container ถูกมองว่า unhealthy ทั้งที่แอปปกติ จึงเปลี่ยนไปยิงหน้า `/` แทน
