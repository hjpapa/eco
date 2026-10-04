/** Village happiness of a plot as a colour: green = nice to live, red = noisy. */
export function happyTint(value: number): { color: string; opacity: number } | null {
  if (value > 0) return { color: "#22c55e", opacity: Math.min(0.85, 0.3 + value * 0.05) };
  if (value < 0) return { color: "#ef4444", opacity: Math.min(0.85, 0.3 + -value * 0.06) };
  return null;
}

/** The same tint as a CSS colour, to lay over a tile's own background. */
export function happyTintCss(value: number, strength = 0.6): string | null {
  const tint = happyTint(value);
  if (!tint) return null;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(tint.color.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${(tint.opacity * strength).toFixed(2)})`;
}
