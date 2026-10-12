export interface BrandingColors {
  primaryColor: string;
  secondaryColor: string;
}

/**
 * Aplica los colores de marca al tema de daisyUI (claro y oscuro).
 * daisyUI consume --p/--pc/--s/--sc a través de oklch(var(--p)),
 * por eso los valores deben ir en formato LCH (% de luminosidad,
 * croma y ángulo de tono), no como triplete RGB.
 */
export function applyBrandingTheme(colors: BrandingColors): void {
  const primary = normalizeHex(colors.primaryColor);
  const secondary = normalizeHex(colors.secondaryColor);

  const root = document.documentElement;
  root.style.setProperty('--primary-color', primary);
  root.style.setProperty('--secondary-color', secondary);

  let style = document.getElementById('branding-theme') as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = 'branding-theme';
    document.head.appendChild(style);
  }

  style.textContent = `
    [data-theme="light"] { ${themeVars(primary, secondary)} }
    [data-theme="dark"] { ${themeVars(primary, secondary)} }
  `;
}

export function setChatBackground(lightUrl?: string | null, darkUrl?: string | null): void {
  document.documentElement.style.removeProperty('--chat-bg-image');
  let style = document.getElementById('chat-background-theme') as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = 'chat-background-theme';
    document.head.appendChild(style);
  }

  const light = lightUrl?.trim() || '';
  const dark = darkUrl?.trim() || light;
  style.textContent = `${backgroundRule('light', light)}\n${backgroundRule('dark', dark)}`;
}

function backgroundRule(theme: 'light' | 'dark', url: string): string {
  if (!url) {
    return '';
  }
  const escapedUrl = url.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]/g, '');
  return `:root[data-theme="${theme}"] { --chat-bg-image: url("${escapedUrl}"); }`;
}

function themeVars(primary: string, secondary: string): string {
  return [
    `--p:${hexToOklch(primary)}`,
    `--pc:${hexToOklch(contrastColor(primary))}`,
    `--s:${hexToOklch(secondary)}`,
    `--sc:${hexToOklch(contrastColor(secondary))}`
  ].join(';') + ';';
}

function normalizeHex(hex: string): string {
  let h = (hex || '').replace('#', '').trim();
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) {
    return '#062e86';
  }
  return '#' + h.toLowerCase();
}

/**
 * Devuelve negro o blanco segun el contraste con el color de fondo. Se usa
 * para pintar textos sobre superficies de color (por ejemplo, el titulo de
 * la pantalla de carga sobre el color primario de la marca).
 */
export function contrastColor(hex: string): string {
  const rgb = hexToRgb(hex);
  const luminance = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
  return luminance > 186 ? '#000000' : '#ffffff';
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16)
  ];
}

function toLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
}

export function hexToOklch(hex: string): string {
  const rgb = hexToRgb(normalizeHex(hex));
  const r = toLinear(rgb[0] / 255);
  const g = toLinear(rgb[1] / 255);
  const b = toLinear(rgb[2] / 255);

  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

  const C = Math.sqrt(a * a + bb * bb);
  let H = (Math.atan2(bb, a) * 180) / Math.PI;
  if (H < 0) H += 360;

  return `${(L * 100).toFixed(4)}% ${C.toFixed(6)} ${H.toFixed(6)}`;
}