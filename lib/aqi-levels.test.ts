import { describe, expect, test } from 'vitest';
import { AQI_LEVELS, getAqiLevelIndex, getTempColor, nextDelay, tsToEpoch } from './aqi-levels';

describe('getAqiLevelIndex', () => {
  test('boundaries', () => {
    expect(getAqiLevelIndex(0)).toBe(0);
    expect(getAqiLevelIndex(50)).toBe(0);
    expect(getAqiLevelIndex(51)).toBe(1);
    expect(getAqiLevelIndex(100)).toBe(1);
    expect(getAqiLevelIndex(300)).toBe(4);
    expect(getAqiLevelIndex(301)).toBe(5);
    expect(getAqiLevelIndex(500)).toBe(5);
    expect(getAqiLevelIndex(9999)).toBe(5);
  });
  test('table has the six levels from the original page', () => {
    expect(AQI_LEVELS.map((l) => l.max)).toEqual([50, 100, 150, 200, 300, 500]);
    expect(AQI_LEVELS[0]).toMatchObject({ color: '#20C982', text: 'อากาศดี', type: 'happy', textOnColor: 'white' });
    expect(AQI_LEVELS[1]).toMatchObject({ color: '#F5C842', textOnColor: 'black' });
    expect(AQI_LEVELS[5]).toMatchObject({ color: '#8F3D58', text: 'อันตราย', type: 'sad' });
  });
});

describe('getTempColor', () => {
  test('bands', () => {
    expect(getTempColor(NaN)).toBe('#95a5a6');
    expect(getTempColor(19.9)).toBe('#2D8CFF');
    expect(getTempColor(20)).toBe('#00B050');
    expect(getTempColor(27.9)).toBe('#00B050');
    expect(getTempColor(28)).toBe('#F29900');
    expect(getTempColor(33)).toBe('#FF5A00');
    expect(getTempColor(37.9)).toBe('#FF5A00');
    expect(getTempColor(38)).toBe('#E00000');
  });
});

describe('tsToEpoch', () => {
  test('Thai local time (UTC+7) regardless of machine timezone', () => {
    expect(tsToEpoch('20/11/2026 11:00:00')).toBe(Date.UTC(2026, 10, 20, 4, 0, 0));
    expect(tsToEpoch('01/01/2026 00:30:15')).toBe(Date.UTC(2025, 11, 31, 17, 30, 15));
  });
  test('bad input is NaN', () => {
    expect(tsToEpoch('')).toBeNaN();
    expect(tsToEpoch('-')).toBeNaN();
    expect(tsToEpoch(undefined as unknown as string)).toBeNaN();
  });
});

describe('nextDelay', () => {
  const thai = (h: number, m: number) => Date.UTC(2026, 10, 20, h - 7, m, 0);
  test('start of hour, data still from previous hour: wait until hh:05', () => {
    expect(nextDelay('20/11/2026 10:00:00', thai(11, 2))).toBe(3 * 60 * 1000);
  });
  test('after hh:05 and data still old: poll every 20s', () => {
    expect(nextDelay('20/11/2026 10:00:00', thai(11, 7))).toBe(20 * 1000);
  });
  test('data is current: at most 10 minutes', () => {
    expect(nextDelay('20/11/2026 11:00:00', thai(11, 7))).toBe(10 * 60 * 1000);
  });
  test('data is current near end of hour: sleep until next hh:05', () => {
    expect(nextDelay('20/11/2026 11:00:00', thai(11, 58))).toBe(7 * 60 * 1000);
  });
});
