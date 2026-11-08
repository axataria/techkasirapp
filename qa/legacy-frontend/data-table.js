// Table05's controls adapted to the app's native HTML tables and real row actions.
const saved = new Map();
let nextId = 0;
const collator = new Intl.Collator('id', { numeric: true, sensitivity: 'base' });
const icon = path => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const previous = icon('<path d="m15 18-6-6 6-6"/>');
const next = icon('<path d="m9 18 6-6-6-6"/>');
if (typeof window !== 'undefined') {
  const closeMenus = event => {
    if (event.target?.closest?.('.data-table-actions')) return;
    document.querySelectorAll('.data-table-actions:popover-open').forEach(panel => panel.hidePopover());
  };
  window.addEventListener('scroll', closeMenus, { capture: true, passive: true });
  window.addEventListener('resize', closeMenus);
}

export function compareValues(a, b) {
  const number = text => {
    if (/^[−-]?\s*Rp\s/.test(text)) return BigInt(text.replace('−', '-').replace(/[^\d-]/g, ''));
    if (/^-?\d+$/.test(text)) return BigInt(text);
    return /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : null;
  };
  const left = number(a), right = number(b);
  return left !== null && right !== null ? (left < right ? -1 : left > right ? 1 : 0) : collator.compare(a, b);
}

export function tablePage(rows, state) {
  const terms = state.query.trim().toLocaleLowerCase('id').split(/\s+/).filter(Boolean);
  const filtered = rows.filter(row => terms.every(term => row.search.includes(term)));
  if (state.sort !== null) filtered.sort((a, b) =>
    compareValues(a.values[state.sort], b.values[state.sort]) * state.direction || a.index - b.index);
  const pageCount = Math.max(1, Math.ceil(filtered.length / state.size));
  state.page = Math.max(0, Math.min(state.page, pageCount - 1));
  return { total: filtered.length, pageCount, rows: filtered.slice(state.page * state.size, (state.page + 1) * state.size) };
}

export function enhanceTables(scope, pageKey) {
  scope.querySelectorAll('[data-data-table]').forEach((wrap, tableIndex) => {
    if (wrap.dataset.tableReady) return;
    wrap.dataset.tableReady = 'true';
    const table = wrap.querySelector('table'), body = table.tBodies[0];
    const headers = Array.from(table.tHead.rows[0].cells);
    const actionColumn = headers.findIndex(header => /aksi/i.test(header.textContent));
    const key = `${pageKey}:${tableIndex}`;
    const state = saved.get(key) || { query: '', size: 5, page: 0, sort: null, direction: 1, selected: new Set() };
    saved.set(key, state);
    const duplicates = new Map();
    const rows = Array.from(body.rows).map((element, index) => {
      const values = Array.from(element.cells, cell => cell.textContent.trim());
      const identity = JSON.stringify(values.filter((_, column) => column !== actionColumn));
      const occurrence = duplicates.get(identity) || 0;
      duplicates.set(identity, occurrence + 1);
      return { element, values, index, key: `${identity}:${occurrence}`, search: values.filter((_, column) => column !== actionColumn).join(' ').toLocaleLowerCase('id') };
    });
    for (const row of rows) {
      for (const cell of row.element.cells) {
        if (/^\d{4}-\d{2}(-\d{2})?$/.test(cell.textContent.trim())) cell.classList.add('date-cell');
      }
    }
    const validKeys = new Set(rows.map(row => row.key));
    headers.forEach((header, column) => {
      if (column === actionColumn || !rows.length || !rows.every(row => /^[−-]?\s*Rp\s/.test(row.values[column]))) return;
      header.classList.add('number');
      for (const row of rows) row.element.cells[column].classList.add('number');
    });
    state.selected = new Set([...state.selected].filter(id => validKeys.has(id)));
    const id = `data-table-${++nextId}`;
    table.id = id;
    table.setAttribute('aria-label', wrap.closest('.card')?.querySelector('h2')?.textContent || 'Daftar data');
    const root = document.createElement('section');
    root.className = 'data-table';
    wrap.before(root);
    root.append(wrap);
    const toolbar = document.createElement('div');
    toolbar.className = 'data-table-toolbar';
    toolbar.innerHTML = `<label class="data-table-size">Tampilkan <select aria-label="Jumlah baris per halaman" aria-controls="${id}"><option>5</option><option>10</option><option>20</option></select><span>baris</span></label><label class="data-table-search"><span class="sr-only">Cari dalam tabel</span><input type="search" placeholder="Cari dalam tabel…" aria-controls="${id}"></label>`;
    root.prepend(toolbar);
    const size = toolbar.querySelector('select'), search = toolbar.querySelector('input');
    size.value = String(state.size); search.value = state.query;
    const footer = document.createElement('div');
    footer.className = 'data-table-footer';
    const summary = document.createElement('p');
    summary.className = 'data-table-summary'; summary.setAttribute('role', 'status');
    const pagination = document.createElement('nav');
    pagination.className = 'data-table-pagination'; pagination.setAttribute('aria-label', `Halaman ${table.getAttribute('aria-label')}`);
    footer.append(summary, pagination); root.append(footer);
    const selectHead = document.createElement('th');
    selectHead.className = 'data-table-check'; selectHead.scope = 'col';
    selectHead.innerHTML = '<input type="checkbox" aria-label="Pilih semua baris di halaman ini">';
    table.tHead.rows[0].prepend(selectHead);
    const selectAll = selectHead.firstElementChild;
    const controls = [];
    headers.forEach((header, column) => {
      header.scope = 'col';
      if (column === actionColumn) return;
      const label = header.textContent;
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'data-table-sort';
      const text = document.createElement('span'); text.textContent = label;
      const indicator = document.createElement('span'); indicator.setAttribute('aria-hidden', 'true');
      button.append(text, indicator); header.replaceChildren(button);
      controls.push({ header, button, indicator, column, label });
      button.addEventListener('click', () => {
        if (state.sort !== column) { state.sort = column; state.direction = 1; }
        else if (state.direction === 1) state.direction = -1;
        else state.sort = null;
        state.page = 0; refresh(); button.focus();
      });
    });
    const hideActions = () => root.querySelectorAll('.data-table-actions:popover-open').forEach(panel => panel.hidePopover());
    for (const row of rows) {
      const cell = document.createElement('td'); cell.className = 'data-table-check';
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox';
      checkbox.setAttribute('aria-label', `Pilih ${row.values.slice(0, 2).join(' · ')}`);
      cell.append(checkbox); row.element.prepend(cell); row.checkbox = checkbox;
      checkbox.addEventListener('change', () => { if (checkbox.checked) state.selected.add(row.key); else state.selected.delete(row.key); refresh(); checkbox.focus(); });
      const actions = actionColumn < 0 ? null : row.element.cells[actionColumn + 1];
      if (!actions?.querySelector('button,a,select')) continue;
      const panelId = `${id}-actions-${row.index}`;
      const panel = document.createElement('div'); panel.id = panelId;
      panel.className = 'data-table-actions'; panel.setAttribute('popover', 'auto');
      const trigger = document.createElement('button'); trigger.type = 'button';
      trigger.className = 'button ghost tiny data-table-menu'; trigger.setAttribute('popovertarget', panelId);
      trigger.setAttribute('aria-label', `Aksi ${row.values.slice(0, 2).join(' · ')}`);
      trigger.innerHTML = icon('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>');
      while (actions.firstChild) panel.append(actions.firstChild);
      actions.append(trigger, panel);
      panel.addEventListener('beforetoggle', event => {
        if (event.newState !== 'open') return;
        const rect = trigger.getBoundingClientRect();
        panel.style.left = `${Math.max(8, Math.min(rect.right - 264, window.innerWidth - 272))}px`;
        if (window.innerHeight - rect.bottom < 280 && rect.top > 280) {
          panel.style.top = 'auto'; panel.style.bottom = `${window.innerHeight - rect.top + 8}px`;
          panel.style.maxHeight = `${Math.min(320, rect.top - 16)}px`;
        } else {
          panel.style.top = `${rect.bottom + 8}px`; panel.style.bottom = 'auto';
          panel.style.maxHeight = `${Math.max(40, Math.min(320, window.innerHeight - rect.bottom - 16))}px`;
        }
      });
      panel.addEventListener('click', event => { if (event.target.closest('button,a')) panel.hidePopover(); });
    }
    let visible = [];
    function refresh() {
      hideActions();
      const view = tablePage(rows, state); visible = view.rows;
      body.replaceChildren(...visible.map(row => row.element));
      if (!visible.length) {
        const empty = document.createElement('tr'), cell = document.createElement('td');
        cell.colSpan = headers.length + 1; cell.className = 'data-table-empty';
        cell.textContent = rows.length ? 'Tidak ada hasil. Coba kata pencarian lain.' : 'Belum ada data. Tambahkan data pertama untuk memulai.';
        empty.append(cell); body.append(empty);
      }
      for (const row of visible) {
        row.checkbox.checked = state.selected.has(row.key);
        row.element.dataset.state = row.checkbox.checked ? 'selected' : '';
      }
      const count = visible.filter(row => state.selected.has(row.key)).length;
      selectAll.checked = count > 0 && count === visible.length;
      selectAll.indeterminate = count > 0 && count < visible.length;
      selectAll.disabled = visible.length === 0;
      for (const control of controls) {
        const active = state.sort === control.column;
        control.header.setAttribute('aria-sort', active ? state.direction === 1 ? 'ascending' : 'descending' : 'none');
        control.indicator.textContent = active ? state.direction === 1 ? '↑' : '↓' : '↕';
        control.button.setAttribute('aria-label', `Urutkan ${control.label}`);
      }
      const start = view.total ? state.page * state.size + 1 : 0;
      summary.textContent = `Menampilkan ${start}–${Math.min((state.page + 1) * state.size, view.total)} dari ${view.total} baris${state.selected.size ? ` · ${state.selected.size} dipilih` : ''}`;
      pagination.replaceChildren();
      const addButton = (label, content, page, disabled, current = false) => {
        const button = document.createElement('button'); button.type = 'button';
        button.className = `button ${current ? 'primary' : 'ghost'} tiny data-table-page`;
        button.setAttribute('aria-label', label); button.setAttribute('aria-controls', id);
        if (current) button.setAttribute('aria-current', 'page');
        button.innerHTML = content; button.disabled = disabled;
        button.addEventListener('click', () => {
          state.page = page; refresh();
          pagination.querySelector('[aria-current="page"]')?.focus();
        });
        pagination.append(button);
      };
      addButton('Halaman sebelumnya', previous, state.page - 1, state.page === 0);
      const pages = new Set([0, view.pageCount - 1, state.page - 1, state.page, state.page + 1].filter(page => page >= 0 && page < view.pageCount));
      let last = -1;
      for (const page of [...pages].sort((a, b) => a - b)) {
        if (last !== -1 && page - last > 1) { const gap = document.createElement('span'); gap.textContent = '…'; gap.setAttribute('aria-hidden', 'true'); pagination.append(gap); }
        addButton(`Halaman ${page + 1}`, String(page + 1), page, false, state.page === page); last = page;
      }
      addButton('Halaman berikutnya', next, state.page + 1, state.page === view.pageCount - 1);
    }
    selectAll.addEventListener('change', () => {
      for (const row of visible) { if (selectAll.checked) state.selected.add(row.key); else state.selected.delete(row.key); }
      refresh(); selectAll.focus();
    });
    search.addEventListener('input', () => { state.query = search.value; state.page = 0; refresh(); });
    search.addEventListener('keydown', event => { if (event.key === 'Escape') { search.value = ''; state.query = ''; state.page = 0; refresh(); } });
    size.addEventListener('change', () => { state.size = Number(size.value); state.page = 0; refresh(); });
    wrap.addEventListener('scroll', hideActions, { passive: true });
    refresh();
  });
}

export function resetTables() { saved.clear(); }
