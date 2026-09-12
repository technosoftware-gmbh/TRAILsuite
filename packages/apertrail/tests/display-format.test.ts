/**
 * The two display conventions that are the reader's rather than the note's:
 * how a time is written, and what a distance is measured in.
 *
 * Neither changes anything stored. A note keeps its coordinates and its
 * datetimes exactly as they were; these decide only what reaches the screen.
 */
import { describe, expect, it } from 'vitest';
import { formatClockIn, hour12For } from '../src/shared/clock';
import { formatDistanceIn } from '../src/shared/units';

describe('clock format', () => {
  const evening = new Date('2026-06-14T17:42:00Z');

  it('maps the setting onto what Intl expects, with auto meaning "do not say"', () => {
    expect(hour12For('24h')).toBe(false);
    expect(hour12For('12h')).toBe(true);
    expect(hour12For('auto')).toBeUndefined();
  });

  it('writes 24-hour and 12-hour times of the same instant', () => {
    expect(formatClockIn(evening, 'UTC', false)).toBe('17:42');
    expect(formatClockIn(evening, 'UTC', true)).toMatch(/5:42/);
  });

  // The zone is the spot's, always: rendering a place abroad in the
  // reader's own zone is the bug the whole sun panel is careful about.
  it('renders in the zone it is given, not the machine one', () => {
    expect(formatClockIn(evening, 'Asia/Tokyo', false)).toBe('02:42');
  });

  // A typo in one note should not take a whole block down with it.
  it('falls back to the device zone rather than throwing on a bad zone name', () => {
    expect(() => formatClockIn(evening, 'Europe/Nowhere', false)).not.toThrow();
  });
});

describe('distance units', () => {
  it('measures in kilometres and metres', () => {
    expect(formatDistanceIn(0.4, 'metric')).toBe('400 m');
    expect(formatDistanceIn(8.9, 'metric')).toBe('8.9 km');
    expect(formatDistanceIn(24.2, 'metric')).toBe('24 km');
  });

  it('measures in miles and feet', () => {
    // Under a tenth of a mile, feet: "0.1 mi" is not an answer anyone can
    // use on the ground.
    expect(formatDistanceIn(0.1, 'imperial')).toBe('330 ft');
    expect(formatDistanceIn(8.9, 'imperial')).toBe('5.5 mi');
    expect(formatDistanceIn(40.2, 'imperial')).toBe('25 mi');
  });
});
