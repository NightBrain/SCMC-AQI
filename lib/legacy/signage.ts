// ตรรกะหน้า signage เดิม (index.html) ที่แก้ DOM ตรงๆ — ย้ายมาเกือบตรงตัว
// startSignage() เรียกครั้งเดียวหลัง mount และคืนฟังก์ชัน cleanup
import { fetchAir } from '../air-client';
import { applyTextZoomCompensation } from './text-zoom';
import {
  AQI_LEVELS,
  RETRY_MS,
  getAqiLevelIndex,
  getTempColor,
  nextDelay,
} from '../aqi-levels';

var CACHE_KEY = 'aqi-cache';

type Cached = { t: number; d: { aqi: number | string; temp: number | string; timestamp: string } };

function $(id: string): HTMLElement {
  return document.getElementById(id) as HTMLElement;
}

function getThermometerIcon(color: string): string {
  return (
    '<svg viewBox="0 0 100 100" style="width:100%; height:100%; overflow:visible;">' +
    '<path d="M50 20 A10 10 0 0 1 60 30 V70 A20 20 0 1 1 40 70 V30 A10 10 0 0 1 50 20 Z" fill="none" stroke="' +
    color +
    '" stroke-width="6"/>' +
    '<circle cx="50" cy="80" r="8" fill="' +
    color +
    '"/>' +
    '<rect x="47" y="40" width="6" height="35" rx="3" fill="' +
    color +
    '"/>' +
    '</svg>'
  );
}

function getAqiIcon(color: string, type: string): string {
  var mouth = type === 'happy' ? 'M30 70 Q50 85 70 70' : 'M30 80 Q50 65 70 80';
  return (
    '<svg viewBox="0 0 100 100" style="width:100%; height:100%;"><circle cx="50" cy="50" r="48" fill="' +
    color +
    '" /><circle cx="33" cy="40" r="6" fill="white" /><circle cx="67" cy="40" r="6" fill="white" /><path d="' +
    mouth +
    '" stroke="white" stroke-width="6" fill="none" stroke-linecap="round" /></svg>'
  );
}

// timestamp จาก API รูปแบบ "dd/mm/yyyy HH:MM:SS" (เวลาไทย) -> "อัปเดตล่าสุด dd/mm/yyyy HH:MM น."
function showUpdateTime(ts: string) {
  var m = /^(\d\d)\/(\d\d)\/(\d{4}) (\d\d:\d\d)/.exec(ts || '');
  if (!m) return;
  $('current-time').innerText = 'อัปเดตล่าสุด ' + m[1] + '/' + m[2] + '/' + m[3] + ' ' + m[4] + ' น.';
}

function readCache(): Cached | null {
  try {
    var c = JSON.parse(localStorage.getItem(CACHE_KEY) as string);
    if (c && typeof c.t === 'number' && c.d) return c as Cached;
  } catch (e) {
    /* ignore */
  }
  return null;
}

function writeCache(d: Cached['d']) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), d: d }));
  } catch (e) {
    /* ignore */
  }
}

// แถบสเกลทุกช่วงกว้างเท่ากัน ตำแหน่งตัวชี้คิดแบบเส้นตรงภายในแต่ละช่วง
function buildAqiScale() {
  var scale = $('aqi-scale');
  var n = AQI_LEVELS.length;
  var html = '<div class="scale-bar">';
  for (var i = 0; i < n; i++) {
    html += '<div class="scale-seg" style="background:' + AQI_LEVELS[i].color + '"></div>';
  }
  html += '</div>';
  for (var j = 0; j <= n; j++) {
    var label = j === 0 ? 0 : AQI_LEVELS[j - 1].max;
    var align = j === 0 ? 'transform:none;' : j === n ? 'transform:translateX(-100%);' : '';
    html += '<div class="scale-tick" style="left:' + (j / n) * 100 + '%;' + align + '">' + label + '</div>';
  }
  html += '<div class="scale-marker" id="scale-marker"></div>';
  scale.innerHTML = html;
}

function updateAqiMarker(aqi: number) {
  var i = getAqiLevelIndex(aqi);
  var lo = i === 0 ? 0 : AQI_LEVELS[i - 1].max;
  var frac = Math.min(Math.max((aqi - lo) / (AQI_LEVELS[i].max - lo), 0), 1);
  $('scale-marker').style.left = ((i + frac) / AQI_LEVELS.length) * 100 + '%';
}

function renderUI(aqi: number, temp: number, ts: string) {
  if (isNaN(aqi)) return;
  showUpdateTime(ts);
  var level = AQI_LEVELS[getAqiLevelIndex(aqi)];
  var color = level.color;
  var text = level.text;
  var type = level.type;
  var textOnColor = level.textOnColor;
  updateAqiMarker(aqi);

  // อัปเดต UI
  var aqiVal = $('aqi-value');
  var tempVal = $('temp-value');
  var statusTxt = $('status-text-large');
  var labelTxt = document.querySelector('.aqi-label') as HTMLElement | null;

  aqiVal.innerText = String(aqi);
  // สำหรับสีเหลืองปรับสีตัวหนังสือให้เข้มเพื่อ Contrast
  aqiVal.style.color = color === '#F5C842' ? '#B8860B' : color;
  tempVal.innerText = isNaN(temp) ? '--°C' : temp.toFixed(1) + '°C';
  var tempColor = getTempColor(temp);
  tempVal.style.color = tempColor;

  $('bottom-bar').style.background = color;

  statusTxt.innerText = text;
  statusTxt.style.color = textOnColor;

  $('status-icon').innerHTML = getAqiIcon(color, type);
  $('weather-icon-box').innerHTML = getThermometerIcon(tempColor);
  if (labelTxt) labelTxt.style.color = color === '#F5C842' ? '#B8860B' : color;
}

export function startSignage(): () => void {
  var stopped = false;
  var refreshTimer: ReturnType<typeof setTimeout> | undefined;
  var reloadTimer: ReturnType<typeof setInterval> | undefined;

  applyTextZoomCompensation();

  // done(ok) ถูกเรียกเมื่อดึงสำเร็จ หรือดึงไม่สำเร็จ
  function fetchAirData(done: (ok: boolean) => void) {
    fetchAir(function (d) {
      if (stopped) return;
      if (!d) {
        done(false);
        return;
      }
      renderUI(Number(d.aqi), Number(d.temp), d.timestamp);
      writeCache({ aqi: d.aqi, temp: d.temp, timestamp: d.timestamp });
      done(true);
    });
  }

  // แคชใน localStorage: ถ้ายังสดใช้ค่าในแคชเลย ไม่ยิง API แล้วนัดเช็คใหม่ตอนแคชหมดอายุ
  function refresh() {
    if (stopped) return;
    var c = readCache();
    var age = c ? Date.now() - c.t : Infinity;
    var wait = c ? nextDelay(c.d.timestamp) : 0;
    if (c && age >= 0 && age < wait) {
      renderUI(Number(c.d.aqi), Number(c.d.temp), c.d.timestamp);
      refreshTimer = setTimeout(refresh, wait - age + 1000);
    } else {
      fetchAirData(function (ok) {
        var fresh = ok && readCache();
        refreshTimer = setTimeout(refresh, fresh ? nextDelay(fresh.d.timestamp) : RETRY_MS);
      });
    }
  }

  buildAqiScale();
  refresh();
  // โหลดหน้าใหม่ทุกชั่วโมงเพื่อรับโค้ดเวอร์ชันล่าสุด (?t= กันแคช)
  reloadTimer = setInterval(function () {
    location.replace(location.pathname + '?t=' + Date.now());
  }, 3600000);

  return function cleanup() {
    stopped = true;
    if (refreshTimer) clearTimeout(refreshTimer);
    if (reloadTimer) clearInterval(reloadTimer);
  };
}