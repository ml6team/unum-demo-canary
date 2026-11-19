export interface ThemeColours {
  light: Record<string, string>;
  dark: Record<string, string>;
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  let digits = hex.replace('#', '');
  if (digits.length === 3) digits = [...digits].map((d) => d + d).join('');
  const [r, g, b] = [0, 2, 4].map((i) => channel(Number.parseInt(digits.slice(i, i + 2), 16)));
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

/** The WCAG 2 contrast ratio of two hex colours, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

function hexProperties(block: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const m of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,6})\s*;/g)) {
    const [, name, value] = m;
    if (name !== undefined && value !== undefined) result[name] = value.toLowerCase();
  }
  return result;
}

/** The `--*` hex colours of `:root` and of the `prefers-color-scheme: dark` block of a stylesheet. */
export function themeColours(css: string): ThemeColours {
  const dark = /@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([^}]*)\}/.exec(css);
  const light = /:root\s*\{([^}]*)\}/.exec(css);
  return {
    light: hexProperties(light?.[1] ?? ''),
    dark: hexProperties(dark?.[1] ?? ''),
  };
}
