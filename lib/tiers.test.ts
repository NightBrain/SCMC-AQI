import { describe, expect, test } from 'vitest';
import { LIGHT_TEXT, TIERS, getCompass, getPollutantStatus, getTier } from './tiers';

describe('getTier', () => {
  test('boundaries', () => {
    expect(getTier(25).text).toBe('คุณภาพดีมาก');
    expect(getTier(26).text).toBe('คุณภาพดี');
    expect(getTier(100).text).toBe('ปานกลาง');
    expect(getTier(101).text).toBe('เริ่มมีผลกระทบ');
    expect(getTier(200).text).toBe('มีผลต่อสุขภาพ');
    expect(getTier(201).text).toBe('อันตรายมาก');
  });
  test('NaN / null fall back to the first tier, huge values to the last', () => {
    expect(getTier(NaN)).toBe(TIERS[0]);
    expect(getTier(null)).toBe(TIERS[0]);
    expect(getTier(9999)).toBe(TIERS[5]);
  });
  test('table matches the original page', () => {
    expect(TIERS.map((t) => t.max)).toEqual([25, 50, 100, 150, 200, 500]);
    expect(TIERS[0]).toMatchObject({ color: '#10b981', light: '#08a672', outdoor: 'ทำได้เต็มที่', mask: 'ไม่ต้องใส่' });
    expect(TIERS[5]).toMatchObject({ color: '#8b5cf6', window: 'เปิดเครื่องฟอก' });
    expect(TIERS.every((t) => t.face.startsWith('<svg'))).toBe(true);
    expect(LIGHT_TEXT['#10b981']).toBe('#047857');
  });
});

describe('getPollutantStatus', () => {
  test('pm25 bands', () => {
    expect(getPollutantStatus('pm25', 15)).toMatchObject({ text: 'ดีมาก', color: '#10b981', pct: 20 });
    expect(getPollutantStatus('pm25', 25).text).toBe('ดี');
    expect(getPollutantStatus('pm25', 37.5).text).toBe('ปานกลาง');
    expect(getPollutantStatus('pm25', 75).text).toBe('เริ่มมีผล');
    expect(getPollutantStatus('pm25', 76)).toMatchObject({ text: 'อันตราย', pct: 90 });
  });
  test('other pollutants', () => {
    expect(getPollutantStatus('co', 4.4).text).toBe('ปลอดภัย');
    expect(getPollutantStatus('co', 4.5).text).toBe('ปกติ');
    expect(getPollutantStatus('co', 9.1).text).toBe('ควรระวัง');
    expect(getPollutantStatus('o3', 50).text).toBe('ปลอดภัย');
    expect(getPollutantStatus('o3', 71).text).toBe('ระคายเคือง');
    expect(getPollutantStatus('no2', 100).text).toBe('ปานกลาง');
    expect(getPollutantStatus('so2', 76).text).toBe('เริ่มมีผล');
  });
  test('missing values ("-", null, NaN) do not crash', () => {
    for (const v of ['-', null, undefined, NaN]) {
      expect(getPollutantStatus('pm25', v)).toEqual({ text: '-', color: '#64748b', pct: 0 });
    }
  });
});

describe('getCompass', () => {
  test('names', () => {
    expect(getCompass(0)).toEqual({ name: 'ทิศเหนือ (N)', deg: 0 });
    expect(getCompass(180).name).toBe('ทิศใต้ (S)');
    expect(getCompass(209.46).name).toBe('ต.ต.ใต้ (SW)');
    expect(getCompass(359).name).toBe('ทิศเหนือ (N)');
  });
  test('missing -> calm', () => {
    expect(getCompass('-')).toEqual({ name: 'นิ่ง', deg: 0 });
    expect(getCompass(null).name).toBe('นิ่ง');
    expect(getCompass(NaN).name).toBe('นิ่ง');
  });
});
