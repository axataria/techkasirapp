/** Convert a computed CSS time to milliseconds for the Web Animations API. */
export function parseCssTime(value: string): number {
  const match = /^(\d+(?:\.\d+)?|\.\d+)(ms|s)$/i.exec(value.trim());
  if (!match) return 180;

  const milliseconds = Number(match[1]) * (match[2].toLowerCase() === "s" ? 1000 : 1);
  return Number.isFinite(milliseconds) ? milliseconds : 180;
}
