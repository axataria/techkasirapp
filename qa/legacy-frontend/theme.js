const themeSettings = (() => {
  const storageKey = 'techkasir.appearance';
  const palettes = {
    paper: '#f7f6f3',
    sage: '#f0f5ef',
    ocean: '#eff5f8',
    clay: '#faf1ec',
    cobalt: '#eef2fc',
    cyan: '#ecf8fa',
    violet: '#f4f0fc',
    emerald: '#edf8f3',
    graphite: '#f0f2f5',
  };
  const appearance = { palette: 'paper', mode: 'light' };

  try {
    const stored = JSON.parse(localStorage.getItem(storageKey));
    if (stored && Object.hasOwn(palettes, stored.palette)) {
      appearance.palette = stored.palette;
    }
    if (['light', 'dark'].includes(stored?.mode)) {
      appearance.mode = stored.mode;
    }
  } catch {
    // The default appearance also works when browser storage is unavailable.
  }

  function applyAppearance() {
    document.documentElement.dataset.palette = appearance.palette;
    document.documentElement.dataset.mode = appearance.mode;
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', appearance.mode === 'dark' ? '#181818' : palettes[appearance.palette]);
  }

  applyAppearance();

  document.addEventListener('change', event => {
    if (!['theme-palette', 'theme-mode'].includes(event.target.id)) return;
    const palette = document.getElementById('theme-palette');
    const mode = document.getElementById('theme-mode');
    const status = document.getElementById('theme-save-status');
    if (palette && mode && status) {
      appearance.palette = palette.value;
      appearance.mode = mode.value;
      applyAppearance();
      try {
        localStorage.setItem(storageKey, JSON.stringify(appearance));
        status.textContent = 'Tampilan tersimpan di browser ini.';
      } catch {
        status.textContent = 'Tampilan diterapkan. Browser ini tidak dapat menyimpannya.';
      }
    }

  });

  const labels = {
    paper: 'Paper · netral hangat',
    sage: 'Sage · hijau lembut',
    ocean: 'Ocean · biru tenang',
    clay: 'Clay · terakota',
    cobalt: 'Cobalt · biru teknologi',
    cyan: 'Cyan · biru siber',
    violet: 'Violet · ungu digital',
    emerald: 'Emerald · hijau teknologi',
    graphite: 'Graphite · abu karbon',
  };

  return function themeSettingsMarkup() {
    const options = Object.entries(labels).map(([value, label]) =>
      `<option value="${value}" ${appearance.palette === value ? 'selected' : ''}>${label}</option>`
    ).join('');

    return `<section class="card theme-settings" aria-labelledby="theme-title">
      <h2 id="theme-title">Tema tampilan</h2>
      <p class="hint">Pilih warna dan mode tampilan. Pilihan tersimpan di browser ini.</p>
      <div class="grid-form">
        <label for="theme-mode">Mode tampilan
          <select id="theme-mode">
            <option value="light" ${appearance.mode === 'light' ? 'selected' : ''}>Terang</option>
            <option value="dark" ${appearance.mode === 'dark' ? 'selected' : ''}>Gelap</option>
          </select>
        </label>
        <label for="theme-palette">Warna tampilan
          <select id="theme-palette">${options}</select>
        </label>
      </div>
      <p class="hint theme-save-status" id="theme-save-status" role="status"></p>
    </section>`;
  };
})();

export { themeSettings };
