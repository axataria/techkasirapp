export const palettes = [
  ["paper", "Paper"], ["sage", "Sage"], ["ocean", "Ocean"], ["clay", "Clay"],
  ["cobalt", "Cobalt"], ["cyan", "Cyan"], ["violet", "Violet"], ["emerald", "Emerald"], ["graphite", "Graphite"]
] as const;
export function applyPalette(palette: string) {
  if (!palettes.some(([key]) => key === palette)) return;
  document.documentElement.dataset.palette = palette;
  try { const existing = JSON.parse(localStorage.getItem("techkasir.appearance") || "{}"); localStorage.setItem("techkasir.appearance", JSON.stringify({ ...existing, palette })); } catch {}
}
