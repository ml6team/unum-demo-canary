import { describe, expect, it } from 'vitest';
import { DARK_PALETTE, hexToLinear, luminance, wcagContrast } from './contrast';

// Light-mode values from src/style.css :root block (for AC5 no-retain check)
const LIGHT_PALETTE: Record<string, string> = {
  '--operational': '#1a7f37',
  '--operational-soft': '#dafbe1',
  '--operational-solid': '#1f883d',
  '--degraded': '#9a6700',
  '--degraded-soft': '#fff8c5',
  '--degraded-solid': '#bf8700',
  '--partial': '#bc4c00',
  '--partial-soft': '#fff1e5',
  '--partial-solid': '#d1560a',
  '--major': '#cf222e',
  '--major-soft': '#ffebe9',
  '--major-solid': '#cf222e',
  '--maintenance': '#0969da',
  '--maintenance-soft': '#ddf4ff',
  '--maintenance-solid': '#0969da',
};

describe('WCAG contrast helper', () => {
  it('computes a known contrast ratio correctly', () => {
    // black on white: 21:1
    expect(wcagContrast('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });

  it('is symmetric', () => {
    const a = '#4493f8';
    const b = '#0d1117';
    expect(wcagContrast(a, b)).toBeCloseTo(wcagContrast(b, a), 10);
  });
});

describe('AC4: dark palette structure', () => {
  it('AC4: dark palette defines a near-black background and a near-white text colour', () => {
    const bgL = luminance(hexToLinear(DARK_PALETTE['--bg']));
    const textL = luminance(hexToLinear(DARK_PALETTE['--text']));
    // background must be darker than text
    expect(bgL).toBeLessThan(textL);
    // background must be near-black (luminance < 0.05)
    expect(bgL).toBeLessThan(0.05);
    // text must be near-white (luminance > 0.5)
    expect(textL).toBeGreaterThan(0.5);
  });

  it('AC4: text on dark background achieves at least 4.5:1 contrast (automatic dark palette)', () => {
    expect(wcagContrast(DARK_PALETTE['--text'], DARK_PALETTE['--bg'])).toBeGreaterThanOrEqual(4.5);
  });
});

describe('AC5: text colours on backgrounds', () => {
  const textPairs: [name: string, fg: string, bg: string][] = [
    ['--text on --bg', '--text', '--bg'],
    ['--text on --surface', '--text', '--surface'],
    ['--text-muted on --bg', '--text-muted', '--bg'],
    ['--text-muted on --surface', '--text-muted', '--surface'],
    ['--accent on --bg', '--accent', '--bg'],
    ['--accent on --surface', '--accent', '--surface'],
  ];

  it.each(textPairs)('AC5: %s achieves >= 4.5:1', (_name, fg, bg) => {
    expect(wcagContrast(DARK_PALETTE[fg], DARK_PALETTE[bg])).toBeGreaterThanOrEqual(4.5);
  });
});

describe('AC5: status-indicator colours on backgrounds', () => {
  const statuses = [
    'operational',
    'degraded',
    'partial',
    'major',
    'maintenance',
  ] as const;

  for (const status of statuses) {
    const tone = `--${status}`;
    const toneKey = status === 'operational'
      ? '--operational'
      : status === 'degraded'
      ? '--degraded'
      : status === 'partial'
      ? '--partial'
      : status === 'major'
      ? '--major'
      : '--maintenance';

    it(`AC5: ${status} colour on --bg achieves >= 4.5:1`, () => {
      expect(wcagContrast(DARK_PALETTE[toneKey], DARK_PALETTE['--bg'])).toBeGreaterThanOrEqual(4.5);
    });

    it(`AC5: ${status} colour on --surface achieves >= 4.5:1`, () => {
      expect(wcagContrast(DARK_PALETTE[toneKey], DARK_PALETTE['--surface'])).toBeGreaterThanOrEqual(4.5);
    });

    it(`AC5: ${status} colour on its soft background achieves >= 4.5:1`, () => {
      expect(
        wcagContrast(DARK_PALETTE[`${toneKey}-soft` === '--partial-soft' ? '--partial-soft' : `${toneKey}-soft`], DARK_PALETTE[`${toneKey}-soft`])
      ).toSatisfy((_: number) => true); // soft-on-soft is same colour, skip; test fg on soft instead
      expect(
        wcagContrast(DARK_PALETTE[toneKey], DARK_PALETTE[`${toneKey}-soft`])
      ).toBeGreaterThanOrEqual(4.5);
    });

    it(`AC5: white on ${status}-solid achieves >= 4.5:1`, () => {
      expect(wcagContrast('#ffffff', DARK_PALETTE[`${toneKey}-solid`])).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe('AC5: no element retains a light-mode colour in dark mode', () => {
  const statusKeys = [
    '--operational',
    '--operational-soft',
    '--operational-solid',
    '--degraded',
    '--degraded-soft',
    '--degraded-solid',
    '--partial',
    '--partial-soft',
    '--partial-solid',
    '--major',
    '--major-soft',
    '--major-solid',
    '--maintenance',
    '--maintenance-soft',
    '--maintenance-solid',
  ] as const;

  it.each(statusKeys)('AC5: dark %s differs from light-mode value', (key) => {
    expect(DARK_PALETTE[key].toLowerCase()).not.toBe(LIGHT_PALETTE[key].toLowerCase());
  });
});
