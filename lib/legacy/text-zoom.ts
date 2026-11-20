// ชดเชย "ขนาดตัวอักษรของเครื่อง/ไลน์": เบราว์เซอร์ในแอป (Android WebView) บางเครื่องขยายเฉพาะตัวอักษร
// ตามค่าตั้งขนาดฟอนต์ แต่ไม่ขยายกรอบ ทำให้ข้อความล้น/ตัดขอบ (ปิดด้วย text-size-adjust ไม่ได้)
// จึงวัดอัตราขยายจริงแล้วตั้ง --tz ให้ font-size ทุกจุดในสไตล์ชีตหารด้วยค่านี้ (เครื่องปกติ tz = 1 ไม่มีผล)
// ทดสอบ/บังคับเองได้ด้วย ?tz=1.4 และดูค่าที่วัดได้ด้วย ?debug
export function applyTextZoomCompensation() {
  var tz = 1;
  var q = /[?&]tz=([\d.]+)/.exec(location.search);
  if (q) {
    tz = parseFloat(q[1]);
    if (!(tz >= 0.5 && tz <= 3)) tz = 1;
  } else {
    try {
      var box = document.createElement('div');
      // inline !important เพื่อไม่ให้สไตล์ชีตของหน้า (เช่น `* { font-family: Prompt }`) มีผลกับ probe
      // ไม่งั้นถ้าฟอนต์ Prompt โหลดเสร็จก่อนตอนวัด จะได้อัตราเกิน 1 แล้วย่อทั้งหน้าผิดๆ
      var locked = 'font:700 20px/1.2 sans-serif !important;letter-spacing:normal !important;';
      box.style.cssText =
        'position:absolute;left:0;top:0;width:90%;visibility:hidden;pointer-events:none;' + locked;
      var probe = document.createElement('span');
      probe.style.cssText = locked;
      probe.textContent = 'MMMMMMMM';
      box.appendChild(probe);
      box.appendChild(document.createTextNode(' ' + new Array(30).join('lorem ipsum dolor sit amet ')));
      document.body.appendChild(box);
      var shown = probe.getBoundingClientRect().width;
      document.body.removeChild(box);
      var ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
      ctx.font = '700 20px sans-serif';
      var base = ctx.measureText('MMMMMMMM').width;
      var r = shown / base;
      if (r >= 1.08 && r <= 2.5) tz = Math.round(r * 100) / 100;
    } catch (e) {
      /* ignore */
    }
  }
  (window as unknown as { __tz: number }).__tz = tz;
  document.documentElement.style.setProperty('--tz', String(tz));
  if (/[?&]debug\b/.test(location.search) && !document.getElementById('tz-debug')) {
    var d = document.createElement('div');
    d.id = 'tz-debug';
    d.style.cssText =
      'position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#000;color:#0f0;font:12px/1.4 monospace;padding:4px 6px;word-break:break-all;';
    d.textContent =
      'tz=' + tz + ' | ' + innerWidth + 'x' + innerHeight + ' | dpr=' + devicePixelRatio + ' | ' + navigator.userAgent;
    document.body.appendChild(d);
  }
}
