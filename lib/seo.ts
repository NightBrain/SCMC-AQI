import { AQI_LEVELS, getAqiLevelIndex } from './aqi-levels';

export const SITE_NAME = 'SCMC Air Quality';
export const STATIC_DESCRIPTION =
  'ติดตามคุณภาพอากาศ (AQI) PM2.5 และอุณหภูมิแบบเรียลไทม์ จากสถานี ACAIR CMU มหาวิทยาลัยเชียงใหม่';

type HeaderGetter = { get(name: string): string | null };

const first = (v: string | null) => (v ? v.split(',')[0].trim() : '');
// host ที่ยอมรับ: ชื่อโดเมน/IP + port เท่านั้น (กัน header แปลกๆ ไหลลงไปใน HTML)
const HOST_RE = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/i;

// URL สาธารณะของเว็บ ใช้ทำ canonical / sitemap / og:url
// ลำดับ: SITE_URL (แนะนำให้ตั้ง) → header จาก reverse proxy → host ของ request → localhost
export function resolveSiteUrl(envUrl: string | undefined, headers: HeaderGetter): string {
  if (envUrl && /^https?:\/\/[^\s/]+/i.test(envUrl.trim())) return envUrl.trim().replace(/\/+$/, '');
  var host = first(headers.get('x-forwarded-host')) || first(headers.get('host'));
  if (!HOST_RE.test(host)) return 'http://localhost:3000';
  var proto = first(headers.get('x-forwarded-proto')).toLowerCase();
  return (proto === 'https' ? 'https' : 'http') + '://' + host;
}

// คำอธิบายหน้า: ใส่ค่าล่าสุดเข้าไปด้วย (ให้ผลค้นหา/ตัวอย่างลิงก์เห็นค่าจริง) ถ้าไม่มีข้อมูลใช้ข้อความคงที่
export function buildDescription(data: { aqi: number | string; temp: number | string } | null): string {
  if (!data) return STATIC_DESCRIPTION;
  var aqi = Number(data.aqi);
  if (typeof data.aqi === 'string' && data.aqi.trim() === '') return STATIC_DESCRIPTION;
  if (!isFinite(aqi)) return STATIC_DESCRIPTION;
  var level = AQI_LEVELS[getAqiLevelIndex(aqi)].text;
  var out = 'คุณภาพอากาศตอนนี้ AQI ' + Math.round(aqi) + ' (' + level + ')';
  var temp = typeof data.temp === 'string' && data.temp.trim() === '' ? NaN : Number(data.temp);
  if (isFinite(temp)) out += ' อุณหภูมิ ' + Math.round(temp * 10) / 10 + '°C';
  return out + ' จากสถานี ACAIR CMU มหาวิทยาลัยเชียงใหม่ อัปเดตทุกชั่วโมง';
}
