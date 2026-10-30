/**
 * WCAG contrast helpers and the verified dark-mode colour palette.
 *
 * The palette mirrors the `@media (prefers-color-scheme: dark)` block in
 * src/style.css exactly. Tests in contrast.test.ts prove every colour pair
 * meets WCAG AA (4.5:1) and that no status colour retains its light-mode value.
 */

/** Linear-light RGB triplet with each channel in [0, 1]. */
export type RGB = [r: number, g: number, b: number];

/**
 * Convert a single 8-bit sRGB channel value (0–255) to linear light.
 * Uses the IEC 61966-2-1 piecewise formula required by WCAG 2.1.
 */
function linearChannel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/**
 * Parse a `#rrggbb` hex colour string into linear-light RGB.
 * Throws for any other format.
 */
export function hexToLinear(hex: string): RGB {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
    throw new RangeError(`hexToLinear: expected #rrggbb, got "${hex}"`);
  }
  return [
    linearChannel(parseInt(hex.slice(1, 3), 16)),
    linearChannel(parseInt(hex.slice(3, 5), 16)),
    linearChannel(parseInt(hex.slice(5, 7), 16)),
  ];
}

/**
 * WCAG 2.1 relative luminance of a linear-light RGB triplet.
 * Returns a value in [0, 1] where 0 is black and 1 is white.
 */
export function luminance([r, g, b]: RGB): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * WCAG 2.1 contrast ratio between two `#rrggbb` hex colours.
 * Result is in [1, 21]. Order does not matter.
 */
export function wcagContrast(fg: string, bg: string): number {
  const l1 = luminance(hexToLinear(fg));
  const l2 = luminance(hexToLinear(bg));
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * All CSS custom-property values used in the `@media (prefers-color-scheme: dark)`
 * override block of src/style.css.
 *
 * Keep this in sync with style.css. When a colour changes there, update it here
 * and re-run the contrast tests.
 */
export const DARK_PALETTE: Record<string, string> = {
  '--bg': '#0d1117',
  '--surface': '#151b23',
  '--surface-hover': '#1a2230',
  '--border': '#2f3742',
  '--border-muted': '#252c36',
  '--text': '#f0f6fc',
  '--text-muted': '#9198a1',
  '--accent': '#4493f8',
  '--focus': '#4493f8',
  '--brand': '#388bfd',
  '--operational': '#3fb950',
  '--operational-soft': '#12261e',
  '--operational-solid': '#238636',
  '--degraded': '#d29922',
  '--degraded-soft': '#272115',
  '--degraded-solid': '#9e6a03',
  '--partial': '#e3793a',
  '--partial-soft': '#2c1d13',
  '--partial-solid': '#bd561d',
  '--major': '#f85149',
  '--major-soft': '#2d1517',
  '--major-solid': '#da3633',
  '--maintenance': '#4493f8',
  '--maintenance-soft': '#121d2f',
  '--maintenance-solid': '#1f6feb',
};
