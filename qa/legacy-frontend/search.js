const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels = { code:'Kode', name:'Nama', phone:'Nomor HP', notes:'Catatan', model:'Model', category:'Kategori', specs:'Spesifikasi', supplier:'Supplier', status:'Status', intake_date:'Tanggal masuk', purchase_amount:'Harga beli', repair_amount:'Biaya perbaikan', extra_amount:'Biaya tambahan', target_amount:'Harga jual target', total_cost:'Total modal', paid:'Dibayar', remaining:'Sisa tagihan', outstanding:'Piutang', advances:'Uang muka', sold_on:'Tanggal jual', received_on:'Tanggal diterima', completed_on:'Tanggal selesai', paid_on:'Tanggal bayar', happened_on:'Tanggal transaksi', buyer_name:'Pembeli', customer_name:'Pelanggan', unit_code:'Kode unit', invoice_number:'Nomor invoice', document_number:'Nomor dokumen', amount:'Jumlah', method:'Metode', reference:'Referensi', description:'Deskripsi', direction:'Arus kas', source_type:'Jenis transaksi', source:'Transaksi', person:'Nama', date:'Tanggal', store:'Toko', username:'Username', role:'Peran', active:'Akun aktif', actor_name:'Petugas', entity:'Data', action:'Aktivitas', detail:'Detail', complaint:'Keluhan', part_code:'Kode sparepart', part_unit_cost:'Modal sparepart', part_qty:'Jumlah sparepart', part_charge:'Tagihan sparepart', service_charge:'Biaya jasa', technician_cost:'Biaya teknisi', estimate_amount:'Estimasi', price_amount:'Harga jual', discount_amount:'Diskon', sale_cost_amount:'Biaya penjualan', unit_cost_snapshot:'Modal unit', kind:'Jenis dokumen', correction_reason:'Alasan koreksi', original_document_number:'Dokumen asli' };
const fieldLabel = key => labels[key] || key.replaceAll('_',' ');

export function openSearch({ post, navigate }) {
  if (document.querySelector('#global-search')) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'global-search';
  dialog.className = 'search-dialog';
  dialog.setAttribute('aria-labelledby', 'global-search-title');
  dialog.innerHTML = `<div class="dialog-body">
    <div class="search-heading"><div><h2 id="global-search-title">Pencarian data</h2><p class="muted">Temukan data di seluruh toko sesuai akses Anda.</p></div><button type="button" class="button ghost" data-close aria-label="Tutup pencarian">Tutup</button></div>
    <form class="search-form"><label for="global-search-query">Apa yang ingin Anda cari?</label><div class="search-input-row"><div class="search-field"><svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input id="global-search-query" name="query" type="search" required maxlength="300" autocomplete="off" placeholder="Nama, nomor HP, kode, atau model…"></div><button type="submit" class="button primary">Cari</button></div></form>
    <div class="search-examples"><span class="muted">Coba:</span>${['Samsung','Menunggu sparepart','Transfer'].map(q => `<button type="button" class="button secondary tiny" data-example="${q}">${q}</button>`).join('')}</div>
    <p class="search-status muted" role="status" aria-live="polite">Cari data yang tersimpan di database toko berdasarkan kata kunci.</p>
    <div class="search-results"></div><div class="search-pagination"></div>
  </div>`;
  document.body.append(dialog);
  const trigger = document.activeElement;
  const form = dialog.querySelector('form'), input = dialog.querySelector('input');
  const status = dialog.querySelector('.search-status'), results = dialog.querySelector('.search-results');
  const pagination = dialog.querySelector('.search-pagination');
  let busy = false, currentQuery = '', offset = 0, records = [];
  let inputRevision = 0;
  dialog.addEventListener('close', () => { dialog.remove(); if(trigger?.isConnected) trigger.focus(); }, { once: true });
  dialog.querySelector('[data-close]').onclick = () => dialog.close();
  async function search(nextOffset = 0) {
    if (busy || !form.reportValidity()) return;
    const query = input.value.trim();
    if (!query) { input.setCustomValidity('Masukkan kata pencarian.'); input.reportValidity(); return; }
    busy = true;
    const revision = inputRevision;
    form.querySelector('button').disabled = true;
    form.querySelector('button').textContent = 'Mencari…';
    records = [];
    results.innerHTML = '';
    pagination.innerHTML = '';
    results.setAttribute('aria-busy','true');
    status.textContent = 'Mencari data toko…';
    try {
      const data = await post('/search', { query, offset: nextOffset });
      if (!dialog.isConnected || revision !== inputRevision) return;
      currentQuery = query; offset = data.offset; records = data.results;
      status.textContent = `${data.total} hasil. ${data.message}`;
      results.innerHTML = records.length ? records.map((r,i) => `<article class="search-result"><span class="badge">${escape(r.label)}</span><h3>${escape(r.title)}</h3><p>${escape(r.summary || r.label)}</p><details><summary>Detail data</summary><dl>${Object.entries(r.fields).map(([key,value]) => `<div><dt>${escape(fieldLabel(key))}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl></details><button type="button" class="button secondary tiny" data-result="${i}">Buka ${escape(r.label)}</button></article>`).join('') : '<div class="empty"><strong>Tidak ada data yang cocok</strong>Coba nama, kode transaksi, model, atau kata yang lebih singkat.</div>';
      pagination.innerHTML = `${offset ? '<button type="button" class="button secondary" data-offset="'+Math.max(0,offset-20)+'">Sebelumnya</button>' : ''}${data.hasMore ? '<button type="button" class="button secondary" data-offset="'+(offset+20)+'">Berikutnya</button>' : ''}`;
    } catch (error) {
      if (!dialog.isConnected || revision !== inputRevision) return;
      status.textContent = error.message;
      results.innerHTML = '';
      pagination.innerHTML = '';
    } finally {
      busy = false;
      form.querySelector('button').disabled = false;
      form.querySelector('button').textContent = 'Cari';
      results.removeAttribute('aria-busy');
    }
  }
  input.oninput = () => {
    input.setCustomValidity('');
    inputRevision++;
    records = [];
    results.innerHTML = '';
    pagination.innerHTML = '';
    status.textContent = 'Tekan Cari untuk mencari kata kunci ini.';
  };
  form.onsubmit = event => { event.preventDefault(); search(); };
  dialog.addEventListener('click', async event => {
    const example = event.target.closest('[data-example]');
    if (example && !busy) { input.value = example.dataset.example; input.setCustomValidity(''); search(); }
    const page = event.target.closest('[data-offset]');
    if (page && !busy) { input.value = currentQuery; search(Number(page.dataset.offset)); }
    const result = event.target.closest('[data-result]');
    if (result) { const record = records[Number(result.dataset.result)]; dialog.close(); await navigate(record); }
  });
  dialog.showModal();
  input.focus();
}
