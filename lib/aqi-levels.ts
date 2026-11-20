// ตรรกะบริสุทธิ์ของหน้า signage (ย้ายจาก index.html เดิม ค่าเหมือนเดิมทุกตัว)

export type AqiLevel = {
  max: number;
  color: string;
  text: string;
  type: 'happy' | 'sad';
  textOnColor: string;
};

// ชุดสี AQI 6 ระดับ (max = ขอบบนของระดับ, ใช้เป็นตัวเลขบนแถบสเกลด้วย)
export var AQI_LEVELS: AqiLevel[] = [
  { max: 50, color: '#20C982', text: 'อากาศดี', type: 'happy', textOnColor: 'white' },
  { max: 100, color: '#F5C842', text: 'อากาศปานกลาง', type: 'happy', textOnColor: 'black' },
  { max: 150, color: '#F08B3E', text: 'เริ่มมีผลต่อกลุ่มเสี่ยง', type: 'sad', textOnColor: 'white' },
  { max: 200, color: '#EE4D5A', text: 'มีผลต่อสุขภาพ', type: 'sad', textOnColor: 'white' },
  { max: 300, color: '#9561D1', text: 'มีผลต่อสุขภาพอย่างมาก', type: 'sad', textOnColor: 'white' },
  { max: 500, color: '#8F3D58', text: 'อันตราย', type: 'sad', textOnColor: 'white' },
];

export function getAqiLevelIndex(aqi: number): number {
  for (var i = 0; i < AQI_LEVELS.length - 1; i++) {
    if (aqi <= AQI_LEVELS[i].max) return i;
  }
  return AQI_LEVELS.length - 1;
}

// สีของอุณหภูมิ (°C) แยกจากสีของ AQI
export function getTempColor(t: number): string {
  if (isNaN(t)) return '#95a5a6';
  if (t < 20) return '#2D8CFF'; // เย็น
  if (t < 28) return '#00B050'; // สบาย
  if (t < 33) return '#F29900'; // อุ่น/ร้อน
  if (t < 38) return '#FF5A00'; // ร้อนมาก
  return '#E00000'; // ร้อนจัด
}

export var CACHE_TTL = 10 * 60 * 1000; // เช็คค่าใหม่ทุก 10 นาที
export var RETRY_MS = 60 * 1000; // ดึงไม่สำเร็จ ลองใหม่ทุก 1 นาที
export var WAIT_MS = 20 * 1000; // รอข้อมูลชั่วโมงใหม่ เช็คทุก 20 วินาที
export var START_MS = 5 * 60 * 1000; // เริ่มเช็คชั่วโมงใหม่ที่ hh:05:00 (CMU ปล่อยค่าราว hh:03)
export var HOUR_MS = 60 * 60 * 1000;
export var TZ_MS = 7 * HOUR_MS; // timestamp จาก API เป็นเวลาไทย (UTC+7)
export var FAST_WINDOW_MS = 20 * 60 * 1000; // ช่วงต้นชั่วโมงที่ถี่ขึ้นเพื่อรอข้อมูลใหม่

// "dd/mm/yyyy HH:MM:SS" (เวลาไทย) -> epoch ms
export function tsToEpoch(ts: string): number {
  var m = /^(\d\d)\/(\d\d)\/(\d{4}) (\d\d):(\d\d):(\d\d)/.exec(ts || '');
  return m ? Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4] - 7, +m[5], +m[6]) : NaN;
}

// ข้อมูลออกทุกต้นชั่วโมง: นัดเช็คที่ hh:05:00 แล้วถ้าข้อมูลยังเป็นของชั่วโมงก่อนให้เช็คทุก 20 วินาทีจนกว่าจะมาใหม่
export function nextDelay(ts: string, nowMs?: number): number {
  var now = nowMs === undefined ? Date.now() : nowMs;
  var hourStart = Math.floor((now + TZ_MS) / HOUR_MS) * HOUR_MS - TZ_MS;
  var since = now - hourStart;
  if (since < FAST_WINDOW_MS && tsToEpoch(ts) < hourStart) return Math.max(WAIT_MS, START_MS - since);
  return Math.min(CACHE_TTL, hourStart + HOUR_MS + START_MS - now);
}
