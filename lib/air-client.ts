import type { AirData } from './air-server';

// ดึงข้อมูลจาก /api/air ของเราเอง (ไม่ผ่านตัวกลางภายนอก)
// ใช้ XMLHttpRequest ตั้งใจ: รองรับเบราว์เซอร์ในแอป (LINE / Android WebView) เก่า
// done(data) เรียกครั้งเดียว: ได้ข้อมูล -> data, ล้มเหลวทุกกรณี -> null
export function fetchAir(done: (data: AirData | null) => void): void {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', '/api/air', true);
  xhr.timeout = 10000;
  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) return;
    var data: AirData | null = null;
    try {
      if (xhr.status !== 200) throw new Error('HTTP ' + xhr.status);
      var r = JSON.parse(xhr.responseText);
      if (r.status !== 'success') throw new Error('API status ' + r.status);
      data = r.data as AirData;
    } catch (e) {
      console.error('/api/air', e);
    }
    done(data);
  };
  xhr.send();
}
