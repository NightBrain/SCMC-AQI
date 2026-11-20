// ตรรกะหน้า /detail เดิม (v2/index.html) ที่แก้ DOM ตรงๆ — ย้ายมาเกือบตรงตัว
// startDashboard() เรียกครั้งเดียวหลัง mount และคืนฟังก์ชัน cleanup
/* eslint-disable @typescript-eslint/no-explicit-any */
import { fetchAir } from '../air-client';
import { LIGHT_TEXT, TIERS, getCompass, getPollutantStatus, getTier, type PollutantType } from '../tiers';
import { applyTextZoomCompensation } from './text-zoom';

function $(id: string): HTMLElement {
  return document.getElementById(id) as HTMLElement;
}
function $q(sel: string): HTMLElement {
  return document.querySelector(sel) as HTMLElement;
}
function $qa(sel: string): NodeListOf<HTMLElement> {
  return document.querySelectorAll<HTMLElement>(sel);
}

export function startDashboard(): () => void {
  var stopped = false;
  var CACHE_KEY = 'aqi-v2-cache';
  var CACHE_TTL = 10 * 60 * 1000;
  var currentData: any = null;
  var currentMetric = 'pm25';
  var lastChartSize = '';


  function initScale() {
      var bar = $('scale-bar');
      var html = '';
      for (var i = 0; i < TIERS.length; i++) {
          html += '<div class="scale-seg" style="background:' + TIERS[i].color + '"></div>';
      }
      html += '<div class="scale-pin" id="scale-pin"></div>';
      bar.innerHTML = html;
  }


  function render(data: any) {
      if (!data) return;
      currentData = data;
      var aqi = Number(data.aqi);
      var tier = getTier(aqi);

      document.documentElement.style.setProperty('--theme-color', tier.color);
      document.documentElement.style.setProperty('--theme-text-light', tier.light);

      // Left Hero
      $('val-aqi').innerText = isNaN(aqi) ? "--" : String(aqi);
      // เลข 1-2 หลักขยายได้ใหญ่กว่า เลข 3 หลักย่อลงให้พอดีการ์ด
      var aqiTwoDigits = String(isNaN(aqi) ? '--' : aqi).length <= 2;
      var heroCenter = $q('.hero-center');
      heroCenter.style.setProperty('--aqi-w', aqiTwoDigits ? '62cqw' : '44cqw');      // เดสก์ท็อป: หน้ายิ้มอยู่เหนือเลข
      heroCenter.style.setProperty('--aqi-w-row', aqiTwoDigits ? '43cqw' : '33cqw');  // มือถือ: หน้ายิ้มอยู่ข้างเลข
      $('hero-status-pill').innerText = tier.text;
      // สีข้อความสถานะใช้ --theme-text (ปรับให้อ่านง่ายตามธีม)
      $('hero-mascot').innerHTML = tier.face;

      $('act-outdoor').innerText = tier.outdoor;
      $('act-mask').innerText = tier.mask;
      $('act-window').innerText = tier.window;

      // Pin Position
      var pin = 0;
      if (!isNaN(aqi)) {
          if (aqi <= 25) pin = (aqi / 25) * 16.6;
          else if (aqi <= 50) pin = 16.6 + ((aqi - 25) / 25) * 16.6;
          else if (aqi <= 100) pin = 33.3 + ((aqi - 50) / 50) * 16.6;
          else if (aqi <= 150) pin = 50.0 + ((aqi - 100) / 50) * 16.6;
          else if (aqi <= 200) pin = 66.6 + ((aqi - 150) / 50) * 16.6;
          else pin = Math.min(98, 83.3 + ((aqi - 200) / 100) * 16.6);
      }
      $('scale-pin').style.left = pin + '%';

      // Pollutants
      updateCard('pm25', data.pm25);
      updateCard('o3', data.o3);
      updateCard('co', data.co);
      updateCard('no2', data.no2);
      updateCard('so2', data.so2);

      // Weather
      var temp = Number(data.temp);
      $('val-temp').innerText = isNaN(temp) ? '--' : temp.toFixed(1);
      $('hint-temp').innerText = temp < 22 ? 'เย็นสบาย' : (temp > 33 ? 'ค่อนข้างร้อน' : 'สบายกำลังดี');

      var hum = Number(data.hum);
      $('val-hum').innerText = isNaN(hum) ? '--' : String(Math.round(hum));
      $('hint-hum').innerText = hum > 75 ? 'ชุ่มชื้น' : (hum < 40 ? 'แห้ง' : 'กำลังดี');

      var ws = (data.wind_speed !== undefined && data.wind_speed !== '-') ? data.wind_speed : data.ws;
      var wd = (data.wind_dir !== undefined && data.wind_dir !== '-') ? data.wind_dir : data.wd;
      var wsNum = Number(ws);
      $('val-wind').innerText = isNaN(wsNum) ? '--' : wsNum.toFixed(2);
      var comp = getCompass(wd);
      $('hint-wind').innerText = comp.name;
      if (!isNaN(comp.deg)) {
          $('wind-icon').style.transform = 'rotate(' + comp.deg + 'deg)';
      }

      var press = Number(data.press || data.pressure);
      $('val-press').innerText = isNaN(press) ? '--' : String(Math.round(press));

      fitWeatherValues();

      // timestamp จาก API รูปแบบ "dd/mm/yyyy HH:MM:SS" (เวลาไทย) -> "อัปเดตล่าสุด dd/mm/yyyy HH:MM น."
      if (data.timestamp) {
          var tm = /^(\d\d)\/(\d\d)\/(\d{4}) (\d\d:\d\d)/.exec(data.timestamp);
          $('txt-updated').innerText = tm
              ? 'อัปเดตล่าสุด ' + tm[1] + '/' + tm[2] + '/' + tm[3] + ' ' + tm[4] + ' น.'
              : 'อัปเดตล่าสุด ' + data.timestamp;
      }

      renderChart();
  }

  // ---------- สลับธีม สว่าง / มืด ----------
  function applyThemeUI() {
      var light = document.documentElement.getAttribute('data-theme') === 'light';
      var icon = $('theme-icon');
      var label = $('theme-label');
      if (icon) icon.className = light ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
      if (label) label.innerText = light ? 'มืด' : 'สว่าง';
  }
  function toggleTheme() {
      var next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('scmc-theme', next); } catch (e) {}
      applyThemeUI();
      renderChart();
  }
  applyThemeUI();

  // สภาพอากาศ: วัดความกว้าง "ตัวเลข + หน่วย" ที่ยาวที่สุด แล้วใช้ขนาดเดียวกันทุกการ์ด
  function fitWeatherValues() {
      var grid = $q('.weather-grid');
      if (!grid) return;
      if (!_fitCtx) _fitCtx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
      var maxEm = 2;
      grid.querySelectorAll('.weather-val-box').forEach(function (box) {
          var parts = box.querySelectorAll('span');
          _fitCtx!.font = '600 100px Prompt, sans-serif';
          var w = _fitCtx!.measureText(parts[0].innerText + ' ').width / 100;
          w += 0.65 * _fitCtx!.measureText(parts[1].innerText).width / 100;
          maxEm = Math.max(maxEm, w);
      });
      grid.style.setProperty('--ww', (maxEm * 1.05).toFixed(3));
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitWeatherValues);

  // วัดความกว้างจริงของตัวเลข (หน่วย em) แล้วให้ทุกการ์ดใช้ขนาดเดียวกันตามค่าที่ยาวที่สุด
  var _fitCtx: CanvasRenderingContext2D | null = null;
  function fitStatValues() {
      var grid = $q('.pollutants-grid');
      if (!grid) return;
      if (!_fitCtx) _fitCtx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
      _fitCtx!.font = '700 100px Prompt, sans-serif';
      var maxEm = 1.6;
      $qa('.stat-val').forEach(function (el) {
          maxEm = Math.max(maxEm, _fitCtx!.measureText(el.innerText).width / 100);
      });
      grid.style.setProperty('--w', (maxEm * 1.04).toFixed(3));
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitStatValues);

  function updateCard(key: PollutantType, val: unknown) {
      var valEl = $('val-' + key);
      var badgeEl = $('badge-' + key);
      var fillEl = $('fill-' + key);
      if (!valEl) return;

      var num = (val === '-' || val === null || val === undefined) ? '--' : Number(val).toFixed(key === 'co' ? 2 : 1);
      valEl.innerText = num;
      fitStatValues();

      var st = getPollutantStatus(key, val);
      badgeEl.innerText = st.text;
      badgeEl.style.background = st.color + "25";
      badgeEl.style.setProperty('--bc', st.color);
      badgeEl.style.setProperty('--bcl', LIGHT_TEXT[st.color] || '#475569');

      if (fillEl) {
          fillEl.style.width = Math.min(100, Math.max(8, st.pct)) + '%';
          fillEl.style.background = st.color;
      }
  }

  function switchMetric(m: string, btn: HTMLElement) {
      currentMetric = m;
      var btns = $qa('.tab-btn');
      btns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      renderChart();
  }

  function renderChart() {
      if (!currentData || !currentData.history || !currentData.history.length) return;
      var h = currentData.history;
      var svg = $('chart-svg');
      var box = $('chart-box');

      // วาดตามขนาดจริงของกล่อง (px) เพื่อให้ตัวอักษรและจุดไม่ถูกยืด/บีบ
      var w = Math.round(box.clientWidth), hgt = Math.round(box.clientHeight);
      if (w < 50 || hgt < 50) return;
      lastChartSize = w + 'x' + hgt;
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + hgt);

      var rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 14;
      var fs = Math.max(11, rem * 0.95);
      var padL = fs * 3, padR = fs * 1.6, padT = fs * 1.1, padB = fs * 2.2;

      var vals: number[] = [], times: string[] = [];
      for (var i = 0; i < h.length; i++) {
          var v = h[i][currentMetric];
          vals.push((v === '-' || v === undefined || v === null) ? (vals.length ? vals[vals.length - 1] : 0) : Number(v));
          var t = h[i].timestamp ? h[i].timestamp.split(' ')[1] : '';
          times.push(t ? t.slice(0, 5) : i + ":00");
      }

      var min = Math.min.apply(null, vals);
      var max = Math.max.apply(null, vals);
      if (min === max) { min = 0; max += 10; }
      min = Math.max(0, Math.floor(min * 0.9));
      max = Math.ceil(max * 1.15);

      var plotH = hgt - padT - padB;
      var step = (w - padL - padR) / Math.max(1, vals.length - 1);
      var pts = [];
      for (var j = 0; j < vals.length; j++) {
          var x = padL + j * step;
          var normY = (vals[j] - min) / (max - min);
          pts.push({ x: x, y: padT + plotH - normY * plotH, v: vals[j], t: times[j] });
      }

      var baseY = padT + plotH;
      var line = 'M ' + pts[0].x + ' ' + pts[0].y;
      for (var k = 1; k < pts.length; k++) line += ' L ' + pts[k].x + ' ' + pts[k].y;
      var area = line + ' L ' + pts[pts.length - 1].x + ' ' + baseY + ' L ' + pts[0].x + ' ' + baseY + ' Z';

      var rs = getComputedStyle(document.documentElement);
      var cGrid = rs.getPropertyValue('--chart-grid').trim() || 'rgba(255,255,255,0.08)';
      var cText = rs.getPropertyValue('--chart-text').trim() || '#94a3b8';
      var cDot = rs.getPropertyValue('--chart-dot').trim() || '#060b11';
      var col = currentMetric === 'temp' ? '#f59e0b' : (currentMetric === 'hum' ? '#06b6d4' : '#38bdf8');
      var svgHtml = '<defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="' + col + '" stop-opacity="0.35"/><stop offset="100%" stop-color="' + col + '" stop-opacity="0"/></linearGradient></defs>';

      for (var g = 0; g <= 2; g++) {
          var gy = baseY - (g / 2) * plotH;
          var gv = Math.round(min + (g / 2) * (max - min));
          svgHtml += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (w - padR) + '" y2="' + gy + '" stroke="' + cGrid + '" stroke-dasharray="3"/>';
          svgHtml += '<text x="' + (padL - fs * 0.6) + '" y="' + (gy + fs * 0.35) + '" fill="' + cText + '" font-size="' + fs + '" text-anchor="end">' + gv + '</text>';
      }

      svgHtml += '<path d="' + area + '" fill="url(#cg)"/>';
      svgHtml += '<path d="' + line + '" fill="none" stroke="' + col + '" stroke-width="' + Math.max(2, rem * 0.18) + '" stroke-linecap="round" stroke-linejoin="round"/>';

      // ป้ายเวลา: เว้นระยะไม่ให้ซ้อนกัน (ปกติทุก 4 จุด, จอแคบจะห่างขึ้น)
      var every = Math.max(4, Math.ceil((fs * 4.5) / step));
      var lastLabelIdx = -999;
      var dotR = Math.max(3, rem * 0.26);
      for (var p = 0; p < pts.length; p++) {
          var isLast = p === pts.length - 1;
          if ((p % every === 0) || (isLast && (p - lastLabelIdx) * step >= fs * 4.5)) {
              lastLabelIdx = p;
              svgHtml += '<text x="' + pts[p].x + '" y="' + (hgt - fs * 0.35) + '" fill="' + cText + '" font-size="' + fs + '" text-anchor="middle">' + pts[p].t + '</text>';
          }
          svgHtml += '<circle cx="' + pts[p].x + '" cy="' + pts[p].y + '" r="' + dotR + '" fill="' + cDot + '" stroke="' + col + '" stroke-width="2" class="c-dot" data-val="' + pts[p].v + '" data-time="' + pts[p].t + '" data-x="' + pts[p].x + '" data-y="' + pts[p].y + '" style="cursor:pointer"/>';
      }

      svg.innerHTML = svgHtml;
      attachTooltips();
  }

  function attachTooltips() {
      var tip = $('chart-tooltip');
      var box = $('chart-box');
      var dots = $qa('.c-dot');

      dots.forEach(function (d) {
          function show() {
              var v = Number(d.getAttribute('data-val')).toFixed(1);
              var t = d.getAttribute('data-time');
              var unit = currentMetric === 'temp' ? '°C' : (currentMetric === 'hum' ? '%' : 'µg/m³');
              tip.innerText = t + ' น. • ' + v + ' ' + unit;

              // viewBox = px จริงของกล่อง จึงใช้พิกัดจุดได้ตรง ๆ และไม่ให้ล้นขอบ
              var cx = Number(d.getAttribute('data-x'));
              var cy = Number(d.getAttribute('data-y'));
              var left = Math.min(Math.max(0, cx - tip.offsetWidth / 2), box.clientWidth - tip.offsetWidth);
              var top = cy - tip.offsetHeight - 10;
              if (top < 0) top = cy + 14;

              tip.style.left = left + 'px';
              tip.style.top = top + 'px';
              tip.style.opacity = '1';
          }
          function hide() { tip.style.opacity = '0'; }

          d.addEventListener('mouseenter', show);
          d.addEventListener('mouseleave', hide);
          d.addEventListener('touchstart', show);
          d.addEventListener('touchend', hide);
      });
  }

  function readCache() {
      try {
          var c = JSON.parse(localStorage.getItem(CACHE_KEY) as string);
          if (c && typeof c.t === 'number' && c.d) return c;
      } catch (e) { }
      return null;
  }

  function writeCache(d: unknown) {
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), d: d })); } catch (e) { }
  }


  function fetchAirData() {
      fetchAir(function (d) {
          if (stopped || !d) return;
          render(d);
          writeCache(d);
      });
  }

  function manualRefresh() {
      fetchAirData();
  }

  // วาดกราฟใหม่เมื่อกล่องกราฟเปลี่ยนขนาด (หมุนจอ / ย่อ-ขยายหน้าต่าง)
  var raf = 0;
  function onResize() {
      var box = $('chart-box');
      if (Math.round(box.clientWidth) + 'x' + Math.round(box.clientHeight) === lastChartSize) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(renderChart);
  }

  // ผูกปุ่มด้วย addEventListener แทน onclick ใน markup เดิม
  var cleanups: Array<() => void> = [];
  function on(el: Element | Window, type: string, fn: EventListener) {
      el.addEventListener(type, fn);
      cleanups.push(function () { el.removeEventListener(type, fn); });
  }

  applyTextZoomCompensation();
  initScale();
  on($('btn-theme'), 'click', function () { toggleTheme(); });
  on($('btn-refresh'), 'click', function () { manualRefresh(); });
  $qa('.tab-btn').forEach(function (btn) {
      on(btn, 'click', function () { switchMetric(btn.getAttribute('data-metric') as string, btn); });
  });
  var cached = readCache();
  if (cached && (Date.now() - cached.t) < CACHE_TTL) {
      render(cached.d);
  }
  fetchAirData();
  var pollTimer = setInterval(function () { fetchAirData(); }, 5 * 60 * 1000);
  // โหลดหน้าใหม่ทุกชั่วโมงเพื่อรับโค้ดเวอร์ชันล่าสุด (?t= กันแคช)
  var reloadTimer = setInterval(function () { location.replace(location.pathname + '?t=' + Date.now()); }, 3600000);
  var ro: ResizeObserver | null = null;
  if (window.ResizeObserver) { ro = new ResizeObserver(onResize); ro.observe($('chart-box')); }
  on(window, 'resize', onResize);

  return function cleanup() {
      stopped = true;
      clearInterval(pollTimer);
      clearInterval(reloadTimer);
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      cleanups.forEach(function (fn) { fn(); });
  };
}
