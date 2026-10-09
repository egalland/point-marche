type Rgb = [number, number, number];

function rgb(hex: string): Rgb {
  const value = /^#[\da-f]{6}$/i.test(hex) ? hex : "#72f5c5";
  return [1, 3, 5].map((index) => Number.parseInt(value.slice(index, index + 2), 16)) as Rgb;
}

function luminance(color: Rgb) {
  const [r, g, b] = color.map((channel) => {
    const value = channel / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  });
  return .2126 * r + .7152 * g + .0722 * b;
}

export function contrastRatio(foreground: string, background: string) {
  const a = luminance(rgb(foreground));
  const b = luminance(rgb(background));
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

function mix(color: Rgb, target: number, amount: number) {
  return `#${color.map((channel) => Math.round(channel + (target - channel) * amount).toString(16).padStart(2, "0")).join("")}`;
}

export function readableAccent(hex: string, background: string, target: 0 | 255) {
  const color = rgb(hex);
  const original = mix(color, target, 0);
  if (contrastRatio(original, background) >= 4.5) return original;
  let from = 0;
  let to = 1;
  for (let index = 0; index < 16; index++) {
    const middle = (from + to) / 2;
    if (contrastRatio(mix(color, target, middle), background) >= 4.5) to = middle;
    else from = middle;
  }
  return mix(color, target, to);
}

export function accentTokens(hex: string) {
  const light = readableAccent(hex, "#eaf0f6", 0);
  const dark = readableAccent(hex, "#1b2a3c", 255);
  const foreground = (color: string) => contrastRatio("#ffffff", color) >= contrastRatio("#0b1420", color) ? "#ffffff" : "#0b1420";
  return {
    "--accent-light": light,
    "--accent-dark": dark,
    "--on-accent-light": foreground(light),
    "--on-accent-dark": foreground(dark),
  };
}
