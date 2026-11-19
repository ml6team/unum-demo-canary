import { describe, expect, it } from 'vitest';
import html from '../../index.html?raw';
import css from '../style.css?raw';
import { contrastRatio, themeColours } from './contrast';

const AA = 4.5;
const TONES = ['operational', 'degraded', 'partial', 'major', 'maintenance'];
const { light, dark } = themeColours(css);

function colour(theme: Record<string, string>, name: string): string {
  const value = theme[name];
  if (value === undefined) throw new Error(`missing --${name}`);
  return value;
}

describe('contrastRatio', () => {
  it('AC9: black on white is 21', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  it('AC9: equal colours are 1, in either order, and short hex works', () => {
    expect(contrastRatio('#1f2328', '#1f2328')).toBeCloseTo(1, 5);
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 5);
  });

  it('AC9: matches a known WCAG pair', () => {
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });
});

describe('themeColours', () => {
  it('AC7: reads the light and the dark values of the custom properties', () => {
    expect(colour(light, 'bg')).toBe('#f6f8fa');
    expect(colour(dark, 'bg')).toBe('#0d1117');
  });
});

describe('dark theme', () => {
  it('AC7, AC10: overrides every colour of the light theme, so nothing stays light', () => {
    const names = Object.keys(light);
    expect(names.length).toBeGreaterThan(0);
    expect(names.filter((n) => !(n in dark))).toEqual([]);
  });

  it('AC7: declares color-scheme dark in the dark block and light by default', () => {
    expect(css).toMatch(
      /@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{[^}]*color-scheme: dark/,
    );
    expect(css).toMatch(/:root\s*\{[^}]*color-scheme: light/);
    expect(html).toContain('<meta name="color-scheme" content="light dark" />');
  });

  it('AC9, AC10: text, muted text and links reach 4.5:1 on every surface', () => {
    for (const fg of ['text', 'text-muted', 'accent']) {
      for (const bg of ['bg', 'surface', 'surface-hover']) {
        expect(
          contrastRatio(colour(dark, fg), colour(dark, bg)),
          `--${fg} on --${bg}`,
        ).toBeGreaterThanOrEqual(AA);
      }
    }
  });

  it('AC9, AC10: every status colour reaches 4.5:1 on the surfaces and its soft colour', () => {
    for (const tone of TONES) {
      for (const bg of ['surface', 'surface-hover', `${tone}-soft`]) {
        expect(
          contrastRatio(colour(dark, tone), colour(dark, bg)),
          `--${tone} on --${bg}`,
        ).toBeGreaterThanOrEqual(AA);
      }
    }
  });

  it('AC9, AC10: white text on every solid status colour reaches 4.5:1', () => {
    for (const tone of TONES) {
      expect(
        contrastRatio('#ffffff', colour(dark, `${tone}-solid`)),
        `white on --${tone}-solid`,
      ).toBeGreaterThanOrEqual(AA);
    }
  });

  it('AC10: the banner detail line is not made translucent', () => {
    const rule = /\.banner-detail\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).not.toMatch(/opacity/);
  });
});

describe('no theme toggle', () => {
  it('AC8: the page has no theme switch', () => {
    expect(html).not.toMatch(/theme-toggle|data-theme|aria-label="[^"]*theme/i);
    expect(html).not.toMatch(/<button/i);
  });
});
