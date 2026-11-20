import { createAirService, type AirData } from './air-server';

// service ตัวเดียวทั้ง process (route handler กับหน้าเว็บใช้ cache เดียวกัน)
// ผูกกับ globalThis เพราะ Next อาจโหลดโมดูลนี้ซ้ำแยกกันระหว่าง route กับ page
const g = globalThis as unknown as { __airService?: ReturnType<typeof createAirService> };

export function getAirService() {
  if (!g.__airService) g.__airService = createAirService();
  return g.__airService;
}

// ข้อมูลล่าสุดสำหรับ metadata: รอไม่เกิน waitMs เพื่อไม่ให้หน้าโหลดช้าตอน CMU ล่ม (เกินเวลาให้ใช้ข้อความคงที่)
export async function getAirSnapshot(waitMs = 1500): Promise<AirData | null> {
  try {
    var timer: ReturnType<typeof setTimeout> | undefined;
    var timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), waitMs);
    });
    var result = await Promise.race([getAirService().get(), timeout]);
    if (timer) clearTimeout(timer);
    return result ? result.payload.data : null;
  } catch {
    return null;
  }
}
