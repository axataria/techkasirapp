import { createV2UI } from './v2.js';
import { themeSettings } from './theme.js';
import { openSearch } from './search.js';
import { enhanceTables, resetTables } from './data-table.js';
import { sumMoney, subtractMoney, formatMoney, fieldLimits, avatarInitial } from './domain.js';

const $ = s => document.querySelector(s);
const app = $('#app');
const state = { me:null, page:'dashboard', data:{}, notice:'', error:false, customerId:null, search:'' };
try { state.sidebarCollapsed = localStorage.getItem('techkasir.sidebarCollapsed') === 'true'; } catch {}
const navIcons = {
  dashboard: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M10 10v10"/>',
  customers: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v2"/>',
  units: '<path d="m12 3 9 5-9 5-9-5 9-5ZM3 8v9l9 5 9-5V8M12 13v9M7.5 5.5l9 5"/>',
  sales: '<path d="M3 4h2l3 12h11l2-8H6M9 20h.01M18 20h.01"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
  services: '<path d="M14 5a6 6 0 0 0-7 8L3 17a2.8 2.8 0 0 0 4 4l4-4a6 6 0 0 0 8-7l-4 4-4-4 4-4Z"/>',
  payments: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
  finance: '<path d="M4 8h15a2 2 0 0 1 2 2v9H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h13v4M21 12h-6v4h6"/>',
  reports: '<path d="M4 3v18h17M9 16v-5M14 16V7M19 16v-3"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  audit: '<path d="M7 3h10v3H7zM7 4H5v17h14V4h-2M8 11h8M8 15h6"/>',
  staff: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  logout: '<path d="M9 4H4v16h5M9 12h12m-5-5 5 5-5 5"/>',
  panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/><path class="toggle-arrow" d="m15 9-3 3 3 3"/>'
};
Object.assign(navIcons, {
 orders: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
 warranties: '<path d="m12 3 8 4v5c0 5-8 9-8 9s-8-4-8-9V7l8-4Z"/>',
 'customer-returns': '<path d="M20 12H4m6-6-6 6 6 6M4 21h16"/>',
 receiving: '<path d="M12 3v13m-6-6 6 6 6-6M4 21h16"/>',qc: '<path d="m4 12 5 5L20 6"/>',
 'supplier-returns': '<path d="M4 12h16m-6-6 6 6-6 6M4 21h16"/>'
});
const navIcon = name => `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${navIcons[name]}</svg>`;
let sidebarMotion;
function toggleSidebar(animate = true) {
  const shell = $('.shell'), content = $('.shell-content');
  const before = content.getBoundingClientRect().left;
  sidebarMotion?.cancel();
  state.sidebarCollapsed = !state.sidebarCollapsed;
  shell.classList.toggle('sidebar-collapsed', state.sidebarCollapsed);
  const toggle = $('[data-action="toggle-sidebar"]');
  toggle.setAttribute('aria-expanded', String(!state.sidebarCollapsed));
  toggle.setAttribute('aria-label', state.sidebarCollapsed ? 'Buka sidebar' : 'Tutup sidebar');
  toggle.dataset.tooltip = toggle.getAttribute('aria-label');
  try { localStorage.setItem('techkasir.sidebarCollapsed', String(state.sidebarCollapsed)); } catch {}
  if (animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const offset = before - content.getBoundingClientRect().left;
    sidebarMotion = content.animate([{ transform: `translateX(${offset}px)` }, { transform: 'translateX(0)' }], { duration: 260, easing: 'cubic-bezier(.22,1,.36,1)' });
  }
}
const today = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const fmt = formatMoney;
const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const val = (f,k) => f.get(k)?.toString().trim() || '';
const money = (f,k) => Number(val(f,k).replace(/^Rp /, '').replaceAll('.', '') || 0);
const line = (v='') => `<span class="muted">${esc(v||'—')}</span>`;
// Semantic variants follow the badge reference throughout every status view.
const badge = value => {
  const label = String(value || '—');
  const variants = {
    Lunas: 'success', Selesai: 'success', 'Siap dijual': 'success',
    Terjual: 'success', Aktif: 'success', Tercatat: 'success', Masuk: 'success',
    DP: 'warning', 'Menunggu sparepart': 'warning', 'Belum Bayar': 'warning',
    Batal: 'destructive', Retur: 'destructive', 'Minus / rusak': 'destructive',
    Dibatalkan: 'destructive', Pembatalan: 'destructive',
    'Dalam pengerjaan': 'primary', 'Dalam perbaikan': 'primary',
    Dikoreksi: 'info', Pembalikan: 'info',
  };
  const variant = Object.hasOwn(variants, label) ? variants[label] : 'secondary';
  return `<span data-slot="badge" class="badge ${variant}"><span data-slot="badge-dot" class="badge-dot" aria-hidden="true"></span><span class="badge-label">${esc(label)}</span></span>`;
};
function field(label,name,type='text',opts={}) {
  const isCurrency = type === 'currency';
  const value = isCurrency && opts.value != null ? fmt(opts.value) : opts.value ?? '';
  const currency = 'data-currency inputmode="numeric" pattern="(?:Rp )?(?:[0-9]+|[0-9]{1,3}(?:[.][0-9]{3})+)" title="Masukkan nominal rupiah bulat, misalnya Rp 125.000"';
  const dateHint = type === 'date' ? '<span class="hint">Pilih tanggal dari kalender atau ketik sesuai format perangkat.</span>' : '';
  const limit = state.page === 'login' ? null : fieldLimits[name];
  const maximumLength = limit ? `maxlength="${Math.max(limit, String(value).length)}"` : '';
  return `<label class="${opts.wide?'wide':''}"><span>${esc(label)}${opts.required?'<span class="required-marker" aria-hidden="true">*</span>':''}</span><input name="${name}" type="${isCurrency?'text':type}" value="${esc(value)}" ${opts.required?'required':''} ${type==='number'?'min="0" step="1"':''} ${type==='date'?'max="9999-12-31"':''} ${maximumLength} ${isCurrency?currency:''} ${opts.placeholder?`placeholder="${esc(opts.placeholder)}"`:''}>${dateHint}</label>`;
}
function select(label, name, options, required = true) {
  const guidance = {
    unitId:'Tambahkan unit berstatus Siap dijual melalui menu Stok unit.',
    customerId:'Tambahkan data pelanggan melalui menu Pelanggan.',
    supplierId:'Tambahkan supplier melalui menu Barang masuk.',
    productId:'Tambahkan produk melalui menu Produk.',
  }[name] || `Belum ada pilihan ${label.toLocaleLowerCase('id')}.`;
  const hint = options.length ? '' : `<span class="hint">${guidance}</span>`;
  return `<label><span>${esc(label)}${required?'<span class="required-marker" aria-hidden="true">*</span>':''}</span>
    <select name="${name}" ${required ? 'required' : ''}>
      <option value="">${options.length ? 'Pilih…' : 'Belum ada pilihan'}</option>
      ${options.map(([value, text]) => `<option value="${esc(value)}">${esc(text)}</option>`).join('')}
    </select>${hint}</label>`;
}
const head = (title,sub,action='') => `<header class="page-head"><div><h1>${esc(title)}</h1><p>${esc(sub)}</p></div><div class="actions">${action}</div></header>`;
const empty = (title,sub) => `<div class="empty"><strong>${esc(title)}</strong>${esc(sub)}</div>`;
const table = (headers,rows) => `<div class="table-wrap" data-data-table><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
const tr = cells => `<tr>${cells.map(c=>`<td>${c}</td>`).join('')}</tr>`;
const btn = (text,action,cls='secondary',attrs='') => `<button type="button" class="button ${cls}" data-action="${action}" ${attrs}>${esc(text)}</button>`;
const linkDoc = (id,type='payment') => id?`<a href="/document?type=${type}&id=${encodeURIComponent(id)}" target="_blank" rel="noopener">Lihat dokumen</a>`:'—';
async function api(path,opts={}) { const res=await fetch('/api'+path,{credentials:'same-origin',headers:{'Content-Type':'application/json'},...opts}); const data=await res.json(); if(!res.ok) throw new Error(data.error||'Permintaan gagal.'); return data; }
const post = (path,body,method='POST') => api(path,{method,body:JSON.stringify(body)});
function notice(message,error=false) { state.notice=message; state.error=error; render(); window.scrollTo({top:0,behavior:'instant'}); }
function formData(form) { return new FormData(form); }
const navParent = page => ({services:'orders',payments:'reports',finance:'reports',staff:'settings',audit:'settings'})[page]||page;
function navItems() { const role=state.me.role; return [
  role==='owner'&&['dashboard','Dasbor'],role!=='service'&&['sales','Kasir'],
  ['orders','Riwayat pesanan'],['customers','Pelanggan'],['warranties','Garansi'],
  ['customer-returns','Retur pelanggan'],['units','Produk'],
  role!=='cashier'&&['receiving','Barang masuk'],role!=='cashier'&&['qc','QC'],
  role!=='cashier'&&['supplier-returns','Retur supplier'],
  role==='owner'&&['reports','Report'],['settings','Pengaturan']
].filter(Boolean); }
function accountMenu() {
  const role = state.me.role === 'owner' ? 'Pemilik' : state.me.role === 'cashier' ? 'Kasir' : 'Staf servis';
  return `<div class="account-control">
    <button type="button" id="account-trigger" class="account-trigger" popovertarget="account-options" aria-label="Pilihan akun ${esc(state.me.name)}">
      <span class="account-avatar" aria-hidden="true">${esc(avatarInitial(state.me.name))}</span>
      <span class="account-identity"><strong>${esc(state.me.name)}</strong><small>${role}</small></span>
      <svg class="account-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
    </button>
    <nav id="account-options" class="account-options" popover aria-label="Pilihan akun">
      <div class="account-menu-heading"><strong>${esc(state.me.name)}</strong><small>${role} · ${esc(state.me.store)}</small></div>
      <button type="button" class="account-option" data-page="settings">${navIcon('settings')}<span>Pengaturan</span></button>
      <button type="button" class="account-option account-signout" data-action="logout">${navIcon('logout')}<span>Keluar</span></button>
    </nav>
  </div>`;
}
document.addEventListener('beforetoggle', e => {
  if (e.target.id !== 'account-options' || e.newState !== 'open') return;
  const trigger = $('#account-trigger').getBoundingClientRect();
  e.target.style.top = `${trigger.bottom + 8}px`;
  e.target.style.right = `${Math.max(16, window.innerWidth - trigger.right)}px`;
}, true);
function dismissAccountMenu() {
  const menu = $('#account-options');
  if (menu?.matches(':popover-open')) menu.hidePopover();
}
window.addEventListener('resize', dismissAccountMenu);
window.addEventListener('scroll', dismissAccountMenu, true);
function shell(content) {
  const nav = navItems().map(([id,label]) => `<button type="button" data-page="${id}" aria-label="${label}" data-tooltip="${label}" ${navParent(state.page)===id?'aria-current="page"':''} class="${navParent(state.page)===id?'active':''}">${navIcon(id)}<span class="nav-label">${label}</span></button>`).join('');
  const toggleLabel = state.sidebarCollapsed ? 'Buka sidebar' : 'Tutup sidebar';
  return `<div class="shell ${state.sidebarCollapsed?'sidebar-collapsed':''}"><aside class="sidebar"><div class="sidebar-surface"></div><div class="sidebar-header"><div class="sidebar-brand-row"><div class="brand sidebar-label">Tech<span>Kasir</span></div><button type="button" class="sidebar-toggle" data-action="toggle-sidebar" aria-label="${toggleLabel}" data-tooltip="${toggleLabel}" aria-expanded="${!state.sidebarCollapsed}" aria-controls="sidebar-nav">${navIcon('panel')}</button></div><div class="store-name sidebar-label">${esc(state.me.store)}</div></div><nav id="sidebar-nav" class="nav" aria-label="Navigasi utama">${nav}</nav></aside><div class="shell-content"><header class="app-top"><div class="brand mobile-brand">Tech<span>Kasir</span></div><button type="button" class="button secondary global-search-trigger" data-action="global-search" aria-label="Cari data" title="Cari data (Ctrl+K / Cmd+K)" aria-keyshortcuts="Control+k Meta+k"><svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg></button>${accountMenu()}</header><nav class="mobile-nav" aria-label="Navigasi seluler">${nav}</nav><main class="main">${state.notice?`<div class="message ${state.error?'error':'success'}" role="status">${esc(state.notice)}</div>`:''}${content}</main></div></div><dialog id="modal" aria-labelledby="modal-title"><div class="dialog-body"></div></dialog>`;
}
function authScreen(setup) { return `<div class="auth-wrap"><div class="auth-card"><div class="brand">Tech<span>Kasir</span></div><h1>${setup?'Siapkan toko':'Masuk ke toko'}</h1><p>${setup?'Buat akun pemilik untuk memulai.':'Masuk dengan akun staf Anda.'}</p>${state.notice?`<div class="message ${state.error?'error':'success'}">${esc(state.notice)}</div>`:''}<form data-form="${setup?'setup':'login'}">${setup?field('Nama toko','storeName','text',{required:true})+field('Nama pemilik','name','text',{required:true})+field('Tanggal saldo awal','openingDate','date',{required:true,value:today()})+field('Saldo kas awal','openingAmount','currency',{required:true,value:0}):''}${field('Username','username','text',{required:true})}${field('Kata sandi','password','password',{required:true})}<button class="button primary" type="submit">${setup?'Buat toko':'Masuk'}</button></form></div></div>`; }
async function boot() { const b=await api('/bootstrap'); if(b.needsSetup){state.page='setup';render();return;} try{state.me=await api('/me');state.page=state.me.role==='owner'?'dashboard':state.me.role==='service'?'orders':'sales';await loadPage();}catch{state.page='login';render();} }
async function loadPage() { state.notice=''; const p=state.page; state.pageError='';state.loading=true;render();try {
  if(v2ui)await v2ui.load();
  if(p==='dashboard') {
    const year=Number(today().slice(0,4));
    const [dashboard, dashboardReport, dashboardUnits, dashboardServices, dashboardPayments]=await Promise.all([
      api('/dashboard'), api('/reports?year='+year), api('/units'), api('/services'), api('/payments')
    ]);
    Object.assign(state.data,{dashboard,dashboardReport,dashboardUnits,dashboardServices,dashboardPayments});
  }
  if(p==='customers') { state.data.customers=await api('/customers'); state.data.payments=await api('/payments'); }
  if(p==='units' && !v2ui) state.data.units=await api('/units');
  if(p==='sales' && !v2ui) { const [sales,units,customers]=await Promise.all([api('/sales'),api('/units'),api('/customers')]);Object.assign(state.data,{sales,units,customers}); }
  if(p==='services') { const [services,customers]=await Promise.all([api('/services'),api('/customers')]);Object.assign(state.data,{services,customers}); }
  if(p==='payments') state.data.payments=await api('/payments');
  if(p==='finance') { const [expenses,incomes,losses]=await Promise.all([api('/expenses'),api('/incomes'),api('/losses')]);Object.assign(state.data,{expenses,incomes,losses}); }
  if(p==='reports') state.data.reports=await api('/reports?year='+(state.reportYear??Number(today().slice(0,4))));
  if(p==='settings' && state.me.role==='owner') state.data.opening=await api('/opening');
  if(p==='audit') state.data.audit=await api('/audit');
  if(p==='staff') state.data.users=await api('/users');
  state.loading=false;render();
}catch(e){state.loading=false;state.pageError=e.message;render();} }
function selectChartMonth(event) {
  const button = event.target.closest('[data-chart-month]');
  if (!button) return;
  document.querySelectorAll('[data-chart-month]').forEach(node => node.setAttribute('aria-pressed', String(node === button)));
  document.querySelector('#chart-selection').textContent = button.getAttribute('aria-label');
}
document.addEventListener('click', selectChartMonth);
document.addEventListener('focusin', selectChartMonth);
function dashboardGreeting(date = new Date()) {
  const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jakarta',hour:'2-digit',hourCycle:'h23'}).format(date));
  return hour>=4&&hour<11?'Selamat pagi':hour>=11&&hour<15?'Selamat siang':hour>=15&&hour<18?'Selamat sore':'Selamat malam';
}
function dashboardWelcome(date = new Date()) {
  return `<span data-dashboard-greeting>${dashboardGreeting(date)}, ${esc(state.me.name)}.</span>`;
}
function dashboard() {
  const d=state.data.dashboard||{}, report=state.data.dashboardReport||{year:today().slice(0,4),months:[]};
  const units=state.data.dashboardUnits||[], services=state.data.dashboardServices||[], payments=state.data.dashboardPayments||[];
  const active=services.filter(x=>!['Selesai','Batal'].includes(x.status));
  const months=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const now=new Date(), dateLabel=new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(now);
  const monthKey=today().slice(0,7), current=report.months.find(x=>x.month===monthKey)||{};
  const percent=(n,total)=>total>0?Math.round(n/total*100):0;
  const margin=d.totalRevenue?new Intl.NumberFormat('id-ID',{maximumFractionDigits:1}).format(d.netProfit/d.totalRevenue*100)+'%':'—';
  const jump=(label,page)=>`<button class="dash-link" data-page="${page}">${label} <span aria-hidden="true">↗</span></button>`;
  const title=(label,meta='',action='')=>`<div class="bento-heading"><div><h2>${label}</h2>${meta?`<p>${meta}</p>`:''}</div>${action}</div>`;
  const stat=(label,value,icon,sub,extra='')=>`<article class="card bento-stat ${extra}"><div class="bento-stat-top"><span>${label}</span>${navIcon(icon)}</div><strong class="bento-value ${value<0?'negative':''}">${fmt(value)}</strong><div class="bento-stat-note">${sub}</div></article>`;
  const sources=[['Penjualan unit',d.unitRevenue||0,'unit'],['Servis pelanggan',d.serviceRevenue||0,'service'],['Pendapatan lain',d.incomes||0,'other']];
  const max=Math.max(1,...report.months.map(x=>x.totalRevenue));
  const chart = report.months.map((month, index) => {
    const label = months[index] + ' ' + report.year + '. Pendapatan ' + fmt(month.totalRevenue) + '. Laba bersih ' + fmt(month.netProfit);
    return `<button type="button" class="revenue-column ${month.month===monthKey?'current':''}" data-chart-month="${index}" aria-label="${esc(label)}" aria-pressed="false"><span class="revenue-track"><span class="revenue-bar" style="height:${Math.max(0,Number(month.totalRevenue))/max*100}%"></span></span><span class="month-label">${months[index]}</span><span class="chart-tip">${months[index]} ${report.year}<strong>${fmt(month.totalRevenue)}</strong><small>Laba bersih ${fmt(month.netProfit)}</small></span></button>`;
  }).join('');
  const stockStatuses=['Siap dijual','Menunggu QC','Dalam perbaikan','Belum dikerjakan','Menunggu sparepart','Minus / rusak','Karantina retur','Karantina supplier','Retur'];
  const unsold=units.filter(x=>!x.sale_id);
  const stockRows=stockStatuses.map(status=>{const count=unsold.filter(x=>x.status===status).length;return `<div class="stock-line"><span>${status}</span><div class="stock-meter"><i style="width:${percent(count,unsold.length)}%"></i></div><strong>${count}</strong></div>`;}).join('');
  const serviceRows=active.slice().sort((a,b)=>a.received_on.localeCompare(b.received_on)).slice(0,4).map(x=>`<div class="service-line"><span class="device-symbol">${navIcon('services')}</span><div><strong>${esc(x.model)}</strong><small>${esc(x.code)} · ${esc(x.customer_name)}</small></div>${badge(x.status)}</div>`).join('');
  const paymentRows=payments.slice(0,5).map(x=>{
    const source=x.details?.source||x.document_number,person=x.details?.person||x.source_type;
    const date=new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(x.paid_on+'T00:00:00Z'));
    const status=x.reversed_by?badge('Dikoreksi'):x.original_document_number?badge('Pembalikan'):badge(x.direction==='IN'?'Masuk':'Keluar');
    return tr([`<div class="dash-payment-identity"><strong>${esc(source)}</strong><span class="dash-cell-sub">${esc(person)}</span><div class="dash-payment-meta"><time datetime="${esc(x.paid_on)}">${esc(date)}</time><span aria-hidden="true">·</span><span>${esc(paymentMethod(x.method))}</span></div></div>`,`<div class="dash-payment-total"><strong class="${x.direction==='OUT'?'negative':'dash-positive'}">${x.direction==='OUT'?'−':'+'} ${fmt(x.amount)}</strong>${status}</div>`]);
  }).join('');
  return `<div class="dashboard-home"><header class="dashboard-welcome"><div><div class="dash-eyebrow">RINGKASAN TOKO <span>·</span> ${esc(state.me.store)}</div><h1>${dashboardWelcome(now)}</h1><p>Semua yang perlu Anda pantau, dalam satu tempat.</p></div><div class="dash-date"><span>${esc(dateLabel)}</span><small>Waktu Indonesia Barat</small></div></header>
    <div class="dashboard-toolbar"><span><i class="live-dot"></i> Data transaksi tersimpan <span class="dash-scope">· Total seluruh periode</span></span><div>${jump('Lihat laporan','reports')}<button class="button primary" data-page="sales">${navIcon('sales')} Catat penjualan</button></div></div>
    <div class="dashboard-bento">
      ${stat('Total pendapatan',d.totalRevenue,'reports',`${fmt(d.unitRevenue)} unit · ${fmt(d.serviceRevenue)} servis`,'bento-featured')}
      ${stat('Laba bersih',d.netProfit,'finance',`Margin bersih <strong>${margin}</strong>`)}
      ${stat('Kas tercatat',d.cash,'payments','Saldo awal + kas masuk − kas keluar')}
      ${stat('Piutang pelanggan',d.receivables,'customers',jump('Kelola pembayaran','payments'))}
      ${v2ui?.dashboardExtras()||''}
      <section class="card bento-revenue">${title('Tren pendapatan',`Januari sampai Desember ${report.year}`,jump('Detail','reports'))}<div class="revenue-summary"><strong>${fmt(current.totalRevenue)}</strong><span>Bulan ini <b>·</b> ${months[Number(monthKey.slice(5))-1]} ${report.year}</span></div><div class="revenue-chart" role="img" aria-label="Pendapatan bulanan ${report.year}: ${esc(report.months.map((m,i)=>months[i]+' '+fmt(m.totalRevenue)).join('; '))}">${chart}</div><p class="chart-selection" id="chart-selection" role="status">Pilih bulan pada grafik untuk melihat rinciannya.</p>${report.months.every(x=>!x.totalRevenue)?'<p class="dash-empty-note">Belum ada pendapatan tercatat pada tahun ini.</p>':''}<div class="chart-footer"><span><i class="chart-key"></i> Pendapatan bulanan</span><span>Laba bersih bulan ini <strong class="${current.netProfit<0?'negative':''}">${fmt(current.netProfit)}</strong></span></div></section>
      <section class="card bento-sources">${title('Sumber pendapatan','Komposisi seluruh periode')}<strong class="source-total">${fmt(d.totalRevenue)}</strong><div class="source-stack" aria-hidden="true">${sources.map(([,v,c])=>`<span class="source-${c}" style="width:${percent(v,d.totalRevenue)}%"></span>`).join('')}</div><div class="source-list">${sources.map(([label,v,c])=>`<div><span><i class="source-dot source-${c}"></i>${label}</span><strong>${fmt(v)}</strong><small>${percent(v,d.totalRevenue)}%</small></div>`).join('')}</div><div class="source-bottom"><span>Laba kotor</span><strong>${fmt(d.grossProfit)}</strong></div></section>
      <section class="card bento-stock">${title('Kesehatan stok',`${unsold.length} unit belum terjual`,jump('Stok','units'))}<div class="stock-summary"><strong>${d.available||0}<small>siap dijual</small></strong><div><span>Nilai persediaan</span><b>${fmt(d.inventoryValue)}</b></div></div><div class="stock-breakdown">${stockRows}</div></section>
      <section class="card bento-activity">${title('Pembayaran terbaru','Termasuk koreksi dan pembalikan',jump('Semua','payments'))}${payments.length?`<div class="dash-payments"><table class="dashboard-table" aria-label="Pembayaran terbaru"><thead><tr><th scope="col">Transaksi / pelanggan</th><th scope="col">Nominal / status</th></tr></thead><tbody>${paymentRows}</tbody></table></div>`:empty('Belum ada pembayaran','Pembayaran yang dicatat akan muncul di sini.')}</section>
      <section class="card bento-services">${title('Antrean servis',`${active.length} pekerjaan aktif`,jump('Servis','services'))}<div class="service-counters"><div><strong>${active.filter(x=>x.status==='Dalam pengerjaan').length}</strong><span>Dikerjakan</span></div><div><strong>${active.filter(x=>x.status==='Menunggu sparepart').length}</strong><span>Menunggu part</span></div><div><strong>${services.filter(x=>x.status==='Selesai').length}</strong><span>Selesai</span></div></div>${serviceRows||empty('Antrean kosong','Belum ada servis yang sedang berjalan.')}</section>
      <section class="card bento-costs">${title('Biaya & perhatian','Total seluruh periode',jump('Keuangan','finance'))}<div class="cost-line"><span>Biaya operasional</span><strong>${fmt(d.expenses)}</strong></div><div class="cost-line"><span>Kerugian tercatat</span><strong class="${d.losses?'negative':''}">${fmt(d.losses)}</strong></div><div class="cost-line"><span>Unit dalam proses</span><strong>${d.inProcess||0} unit</strong></div><div class="attention-note">${d.receivables>0?`${fmt(d.receivables)} piutang belum lunas. Tinjau pembayaran pelanggan.`:'Tidak ada piutang pelanggan yang belum lunas.'}</div></section>
    </div><p class="dashboard-footnote">Ringkasan keuangan mencakup seluruh transaksi. Grafik mengikuti tahun ${report.year}. Pendapatan servis diakui saat pekerjaan selesai.</p></div>`;
}
// Keep the welcome accurate when the dashboard remains open across a time boundary.
setInterval(()=>{
  const greeting=$('[data-dashboard-greeting]');
  if(greeting&&state.me) greeting.textContent=`${dashboardGreeting()}, ${state.me.name}.`;
},60000);

function customerList() {
  const query = state.search.trim().toLowerCase();
  const rows = (state.data.customers || []).filter(customer =>
    (customer.name + ' ' + customer.phone).toLowerCase().includes(query)
  );
  if (query && !rows.length) return empty('Pelanggan tidak ditemukan', 'Coba nama atau nomor HP lain.');
  return table(['Nama','No. HP','Piutang','Uang muka','Aksi'],rows.map(c=>tr([esc(c.name),esc(c.phone||'—'),fmt(c.outstanding),fmt(c.advances),btn('Lihat riwayat','customer-detail','secondary tiny',`data-id="${c.id}"`)])));
}
function customers() { const detail=state.customerId?(state.data.customers||[]).find(c=>c.id===state.customerId):null; const payments=state.data.payments||[];return head('Pelanggan','Riwayat servis, penjualan, dan DP per pelanggan.',btn('Tambah pelanggan','new-customer','primary'))+`<div class="toolbar"><label class="search-field"><span class="sr-only">Cari pelanggan</span><svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input id="search" type="search" placeholder="Cari nama atau nomor HP" value="${esc(state.search)}" aria-label="Cari pelanggan"></label></div>`+ (detail?`<section class="card">${btn('← Kembali','back-customers','ghost tiny')}<h2 style="margin-top:18px">${esc(detail.name)}</h2><p>${esc(detail.phone||'Tanpa nomor HP')}</p><div class="cards"><div class="card metric"><div class="metric-label">Piutang invoice</div><div class="metric-value">${fmt(detail.outstanding)}</div></div><div class="card metric"><div class="metric-label">Uang muka servis</div><div class="metric-value">${fmt(detail.advances)}</div></div></div><h2>Riwayat transaksi</h2>${detail.transactions.length?detail.transactions.map(x=>{const ps=payments.filter(p=>p.source_type===x.type&&p.source_id===x.id);return `<div class="detail-item"><strong>${esc(x.code)}</strong> ${badge(x.status||((x.remaining||0)===0?'Lunas':x.paid>0?'DP':'Belum Bayar'))}<div class="detail-meta">${x.type==='service'?'Servis':'Penjualan'} · ${esc(x.received_on||x.sold_on)} · ${x.status==='Selesai'||x.type==='sale'?`Tagihan ${fmt(x.amount)} · Dibayar ${fmt(x.paid)} · Sisa ${fmt(x.remaining)}`:`Estimasi ${fmt(x.estimate_amount)} · Uang muka ${fmt(x.paid)}`}</div>${ps.map(p=>`<div class="detail-meta">${esc(p.paid_on)} · ${fmt(p.amount)} · ${linkDoc(p.document_id)}</div>`).join('')}</div>`}).join(''):empty('Belum ada transaksi','Transaksi pelanggan akan muncul di sini.')}</section>`:'')+`<section class="card"><h2>Daftar pelanggan</h2><div id="customer-list">${customerList()}</div></section>`; }
function units() {const rows=state.data.units||[];return head('Stok unit','Satu kode untuk satu laptop atau HP.',state.me.role==='owner'?btn('Tambah unit','new-unit','primary'):'')+`<section class="card"><h2>Daftar unit</h2>${table(['Kode','Model','Kategori','Modal','Status','Aksi'],rows.map(x=>tr([`<strong>${esc(x.code)}</strong>`,esc(x.model),esc(x.category),state.me.role==='owner'?fmt(x.total_cost):'—',badge(x.sale_id?'Terjual':x.status),state.me.role==='owner'&&!x.sale_id?`<div class="row-actions"><select data-unit-status="${x.id}" aria-label="Ubah status ${esc(x.code)}">${['Belum dikerjakan','Dalam perbaikan','Menunggu sparepart','Minus / rusak','Siap dijual','Retur'].map(s=>`<option ${x.status===s?'selected':''}>${s}</option>`).join('')}</select>${subtractMoney(x.total_cost,x.paid)>0?btn('Bayar modal','pay','secondary tiny',`data-type="unit" data-id="${x.id}" data-label="${esc(x.code)}" data-remaining="${subtractMoney(x.total_cost,x.paid)}"`):''}</div>`:'—'])))}</section>`; }
function sales() {const s=state.data.sales||[], units=(state.data.units||[]).filter(x=>!x.sale_id&&x.status==='Siap dijual'), customers=state.data.customers||[];return head('Penjualan unit','Pilih unit siap jual. Cicilan tercatat per tanggal pembayaran.',btn('Catat penjualan','new-sale','primary'))+`<section class="card"><h2>Transaksi penjualan</h2>${table(['Tanggal','ID','Unit','Pembeli','Penjualan neto','Dibayar','Status','Dokumen / Aksi'],s.map(x=>tr([esc(x.sold_on),esc(x.code),`${esc(x.unit_code)} · ${esc(x.model)}`,esc(x.customer_name||x.buyer_name||'—'),fmt(subtractMoney(x.price_amount,x.discount_amount)),fmt(x.paid),badge(x.remaining===0?'Lunas':x.paid>0?'DP':'Belum Bayar'),`<div class="row-actions">${linkDoc(x.invoice_id,'invoice')}${x.remaining>0?btn('Terima pembayaran','pay','secondary tiny',`data-type="sale" data-id="${x.id}" data-label="${esc(x.code)}" data-remaining="${x.remaining}"`):''}</div>`])))}</section><template id="sale-options" data-units="${esc(JSON.stringify(units.map((unit,index)=>[unit.id,unitChoiceLabel(unit,index)])))}" data-customers="${esc(JSON.stringify(customers.map(x=>[x.id,`${x.name} · ${x.phone||'tanpa HP'}`])))}"></template>`; }
function services() {const rows=state.data.services||[];return head('Servis pelanggan','Pantau pekerjaan, uang muka, dan pelunasan.',btn('Terima servis','new-service','primary'))+`<section class="card"><h2>Pekerjaan servis</h2>${table(['Masuk','ID','Pelanggan','Perangkat','Pekerjaan','Tagihan / estimasi','Dibayar','Aksi'],rows.map(x=>tr([esc(x.received_on),esc(x.code),esc(x.customer_name),esc(x.model),badge(x.status),fmt(x.status==='Selesai'?sumMoney(x.part_charge,x.service_charge):x.estimate_amount),fmt(x.paid),`<div class="row-actions">${x.invoice_id?linkDoc(x.invoice_id,'invoice'):''}${x.status!=='Batal'&&((x.status==='Selesai'?x.remaining:subtractMoney(x.estimate_amount,x.paid))>0)?btn('Terima DP / bayar','pay','secondary tiny',`data-type="service" data-id="${x.id}" data-label="${esc(x.code)}" data-remaining="${x.status==='Selesai'?x.remaining:subtractMoney(x.estimate_amount,x.paid)}"`):''}${!['Selesai','Batal'].includes(x.status)?btn('Ubah biaya','edit-service','ghost tiny',`data-id="${x.id}"`)+btn('Ubah status','service-status','ghost tiny',`data-id="${x.id}" data-label="${esc(x.code)}"`):''}</div>`])))}</section>`; }
const paymentDirection = p => p.direction === 'IN' ? 'Masuk' : 'Keluar';
const paymentStatus = p => p.original_document_number ? 'Pembatalan' : p.reversed_by ? 'Dibatalkan' : 'Tercatat';
const paymentMethod = method => method === 'Cash' ? 'Tunai' : method;
const paymentDate = date => new Intl.DateTimeFormat('id-ID', {dateStyle:'long', timeZone:'UTC'}).format(new Date(date+'T00:00:00Z'));
function payments() {
  const rows = state.data.payments || [];
  const content = rows.length ? table(['Tanggal','Dokumen','Nama / pihak','Arah','Jumlah','Metode','Status'], rows.map(p => tr([
    esc(paymentDate(p.paid_on)),
    btn(p.document_number,'payment-detail','secondary tiny',`data-id="${esc(p.id)}" aria-label="Lihat detail pembayaran ${esc(p.document_number)}"`),
    esc(p.details.person || '—'), esc(paymentDirection(p)), fmt(p.amount), esc(paymentMethod(p.method)), badge(paymentStatus(p)),
  ]))) : empty('Belum ada pembayaran','Pembayaran yang tercatat akan muncul di sini.');
  return head('Pembayaran','Pilih nomor dokumen untuk melihat detail pembayaran.') + `<section class="card"><h2>Riwayat pembayaran</h2>${content}</section>`;
}
function showPayment(p) {
  const d = p.details;
  const entries = [
    ['Nama / pihak',d.person], ['Toko',d.store], ['Transaksi',d.source], ['Invoice',d.invoice],
    ['Tanggal pembayaran',paymentDate(p.paid_on)], ['Jumlah',fmt(p.amount)], ['Metode',paymentMethod(p.method)],
    ['Arah kas',paymentDirection(p)], ['Status',paymentStatus(p)], ['Jenis dokumen',p.kind],
    ['Referensi',p.reference], ['Petugas',d.issuer], ['Total dibayar saat dokumen dibuat',fmt(d.cumulative)],
    ['Sisa saat dokumen dibuat',fmt(d.remaining)], ['Dokumen asal',p.original_document_number], ['Alasan koreksi',p.correction_reason],
  ];
  const details = entries.map(([label,value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value || '—')}</dd></div>`).join('');
  const canCorrect = state.me.role === 'owner' && !p.reversed_by && !p.original_document_number && !['customer_refund','supplier_refund'].includes(p.source_type) && !(state.data.sales||[]).some(s=>s.id===p.source_id&&s.returned_on);
  const attrs = `data-id="${esc(p.id)}" data-label="${esc(p.document_number)}"`;
  const actions = canCorrect ? btn('Koreksi pembayaran','correct-payment','secondary',attrs) + btn('Batalkan pembayaran','reverse-payment','ghost',attrs) : '';
  modal(p.document_number, `<dl class="payment-details">${details}</dl><div class="row-actions">${linkDoc(p.document_id)}${actions}${btn('Tutup','close-modal','ghost')}</div>`);
}
function correctPayment(p) {
  const methods = ['Cash','Transfer','QRIS'].map(method => `<option value="${method}" ${p.method === method ? 'selected' : ''}>${paymentMethod(method)}</option>`).join('');
  modal(`Koreksi ${p.document_number}`, `<p class="muted">Catatan lama akan dibatalkan. Pembayaran pengganti akan muncul di riwayat.</p>
  <form class="grid-form" data-form="correct-payment">
    <input type="hidden" name="id" value="${esc(p.id)}">
    ${field('Tanggal bayar','paidOn','date',{required:true,value:p.paid_on})}
    ${field('Jumlah bayar','amount','currency',{required:true,value:p.amount})}
    <label>Metode<select name="method" required>${methods}</select></label>
    ${field('Referensi','reference','text',{value:p.reference})}
    ${field('Alasan koreksi','reason','text',{required:true,wide:true})}
    ${formActions('Simpan koreksi')}
  </form>`);
}
function finance() {const names=[['expenses','Biaya operasional'],['incomes','Pendapatan lain'],['losses','Kerugian']];return head('Keuangan','Catat biaya, pendapatan lain, dan kerugian.')+names.map(([key,title])=>`<section class="card"><div class="page-head"><h2>${title}</h2>${btn('Tambah','new-finance','secondary tiny',`data-kind="${key}"`)}</div>${table(['Tanggal','ID','Kategori','Deskripsi','Jumlah','Dibayar','Aksi'],(state.data[key]||[]).map(x=>tr([esc(x.happened_on),esc(x.code),esc(x.category),esc(x.description),fmt(x.amount),fmt(x.paid),x.remaining>0?btn(key==='incomes'?'Terima pembayaran':'Catat pembayaran','pay','secondary tiny',`data-type="${key==='expenses'?'expense':key==='incomes'?'income':'loss'}" data-id="${x.id}" data-label="${esc(x.code)}" data-remaining="${x.remaining}"`):badge('Lunas')])))}</section>`).join(''); }
function reports() {const r=state.data.reports||{year:Number(today().slice(0,4)),months:[]},totals=r.months.reduce((a,x)=>{for(const k of ['totalRevenue','grossProfit','netProfit','cashIn','cashOut'])a[k]=sumMoney(a[k]||0,x[k]);return a;},{}),current=Number(today().slice(0,4)),years=r.years||[...new Set([current,r.year])].sort((a,b)=>b-a);return head('Report','Pendapatan dan laba menurut tanggal transaksi; kas menurut tanggal pembayaran.',`<label>Tahun <select id="report-year">${years.map(y=>`<option value="${y}" ${r.year===y?'selected':''}>${String(y).padStart(4,'0')}</option>`).join('')}</select></label>`)+`<div class="cards"><section class="card metric"><div class="metric-label">Total pendapatan</div><div class="metric-value">${fmt(totals.totalRevenue)}</div></section><section class="card metric"><div class="metric-label">Laba kotor</div><div class="metric-value">${fmt(totals.grossProfit)}</div></section><section class="card metric strong"><div class="metric-label">Laba bersih</div><div class="metric-value">${fmt(totals.netProfit)}</div></section><section class="card metric"><div class="metric-label">Kas masuk</div><div class="metric-value">${fmt(totals.cashIn)}</div></section></div><section class="card"><h2>Rekap per bulan</h2>${table(['Bulan','Pendapatan','Modal & biaya langsung','Laba kotor','Operasional','Kerugian','Laba bersih','Kas masuk','Kas keluar','Saldo kas','Nilai stok'],r.months.map(x=>tr([esc(x.month),fmt(x.totalRevenue),fmt(sumMoney(x.unitCost,x.serviceCost)),fmt(x.grossProfit),fmt(x.expense),fmt(x.loss),fmt(x.netProfit),fmt(x.cashIn),fmt(x.cashOut),fmt(x.closingCash),fmt(x.inventory)])))}</section>`; }
function settings() {
  if (state.me.role !== 'owner') return head('Pengaturan', 'Atur tampilan aplikasi Anda.') + themeSettings();
  const opening = state.data.opening || {};
  return head('Pengaturan', 'Atur tampilan aplikasi dan saldo kas awal toko.') + themeSettings() + 
    `<section class="card"><h2>Saldo kas awal</h2>
      <form class="grid-form" data-form="opening">
        ${field('Tanggal berlaku', 'effectiveOn', 'date', { value: opening.effective_on || today(), required: true })}
        ${field('Jumlah saldo awal', 'amount', 'currency', { value: opening.amount || 0, required: true })}
        <div class="form-actions"><button class="button primary" type="submit">Simpan saldo awal</button></div>
      </form>
    </section>`;
}
function audit(){return head('Log perubahan','Perubahan data penting dan koreksi pembayaran.')+`<section class="card"><h2>Aktivitas terbaru</h2>${table(['Waktu','Petugas','Data','Aksi','Detail'],(state.data.audit||[]).map(x=>tr([esc(x.created_at.slice(0,19).replace('T',' ')),esc(x.actor_name),`${esc(x.entity)} · ${esc(x.entity_id.slice(0,8))}`,esc(x.action),esc(x.detail)])))}</section>`;}
function staff() {return head('Staf','Akun dan akses aplikasi.',btn('Tambah staf','new-staff','primary'))+`<section class="card"><h2>Akun staf</h2>${table(['Nama','Username','Peran','Status','Aksi'],(state.data.users||[]).map(x=>tr([esc(x.name),esc(x.username),esc(x.role),badge(x.active?'Aktif':'Nonaktif'),x.active&&x.id!==state.me.id?`<div class="row-actions">${btn('Reset sandi','reset-password','secondary tiny',`data-id="${x.id}"`)}${btn('Nonaktifkan','deactivate','ghost tiny',`data-id="${x.id}"`)}</div>`:'—'])))}</section>`; }
const v2ui=typeof createV2UI==='function'?createV2UI({state,api,post,esc,fmt,field,select,btn,head,empty,table,tr,badge,modal,closeModal,linkDoc,today,render,loadPage,services,reports}):null;
function render(){ if(!state.me){resetTables();app.innerHTML=authScreen(state.page==='setup');return;} const pages={dashboard,customers,units,sales,services,payments,finance,reports,settings,audit,staff};let content=state.loading||state.pageError?'':v2ui?.render(state.page);if(content===undefined)content=(pages[state.page]||dashboard)();if(['reports','finance','payments'].includes(state.page)&&state.me.role==='owner')content=(v2ui?.tabs([['Report','reports'],['Pencatatan keuangan','finance'],['Pembayaran','payments']])||'')+content;if(['settings','staff','audit'].includes(state.page)&&state.me.role==='owner')content=(v2ui?.tabs([['Toko & tampilan','settings'],['Staf dan akses','staff'],['Audit','audit']])||'')+content;if(state.page==='customers')content+=v2ui?.customerExtras()||'';if(state.page==='settings')content+=v2ui?.policyForm()||'';if(state.loading)content='<section class="card v2-loading" aria-busy="true" aria-label="Memuat data"><p>Memuat data…</p><div></div><div></div><div></div></section>';if(state.pageError)content='<section class="card"><h1>Data belum dapat dimuat</h1><p role="alert">'+esc(state.pageError)+'</p>'+btn('Coba lagi','retry-page','primary')+'</section>';app.innerHTML=shell(content);enhanceTables(app,state.page);v2ui?.restorePos(); }
function modal(title, content) {
  const dialog = $('#modal');
  dialog.querySelector('.dialog-body').innerHTML = `
    <div class="modal-heading">
      <h2 id="modal-title">${esc(title)}</h2>
      <button type="button" class="button ghost modal-close" data-action="close-modal" aria-label="Tutup dialog"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
    </div>${content}`;
  if (!dialog.open) dialog.showModal();
  dialog.querySelector('input:not([type="hidden"]),select,textarea')?.focus();
}
function closeModal() {
  const dialog = $('#modal');
  if (!dialog?.querySelector('[aria-busy="true"]')) dialog?.close();
}
document.addEventListener('cancel', event => {
  if (event.target.id === 'modal' && event.target.querySelector('[aria-busy="true"]')) event.preventDefault();
}, true);
function showSearch() {
  if (!state.me || document.querySelector('dialog[open]')) return;
  dismissAccountMenu();
  openSearch({ post, navigate: async record => {
    state.page = record.page; v2ui?.navigate(record); state.search = ''; state.customerId = record.scope === 'customers' ? record.id : null;
    await loadPage();
  } });
}
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && state.me) {
    event.preventDefault(); showSearch();
  }
});
function formActions(label){return `<div class="form-actions">${btn('Batal','close-modal','ghost')}<button class="button primary" type="submit">${esc(label)}</button></div>`;}
function unitChoiceLabel(unit, index) {
  const code = String(unit.code);
  return String(index + 1).padStart(3, '0') + ' · ' + (code.length > 14 ? '…' + code.slice(-14) : code);
}
document.addEventListener('change', event => {
  if (event.target.name !== 'unitId') return;
  const preview = document.querySelector('#unit-choice-preview');
  if (!preview) return;
  const unit = state.data.units.find(row => row.id === event.target.value);
  preview.innerHTML = unit ? '<strong>' + esc(unit.code) + '</strong><span>' + esc(unit.model) + '</span>' : 'Pilih unit untuk melihat kode dan model lengkap.';
});
function openForm(action,el){const customers=state.data.customers||[],customerOptions=customers.map(c=>[c.id,`${c.name} · ${c.phone||'tanpa HP'}`]);
  if(action==='new-customer') return modal('Tambah pelanggan',`<form class="grid-form" data-form="customer">${field('Nama pelanggan','name','text',{required:true})}${field('Nomor HP','phone','tel')}${field('Catatan','notes','text',{wide:true})}${formActions('Simpan pelanggan')}</form>`);
  if(action==='new-unit') return modal('Tambah unit',`<form class="grid-form" data-form="unit">${field('Kode unit','code','text',{required:true})}${select('Kategori','category',[['Laptop','Laptop'],['HP','HP']])}${field('Model / tipe','model','text',{required:true})}${field('Tanggal masuk','intakeDate','date',{required:true,value:today()})}${field('Supplier / penjual','supplier')}${field('Harga beli','purchaseAmount','currency',{required:true})}${field('Biaya perbaikan','repairAmount','currency',{value:0})}${field('Biaya tambahan modal','extraAmount','currency',{value:0})}${field('Harga jual target','targetAmount','currency',{value:0})}${select('Status awal','status',['Belum dikerjakan','Dalam perbaikan','Menunggu sparepart','Minus / rusak','Siap dijual','Retur'].map(x=>[x,x]))}${field('Spesifikasi','specs','text',{wide:true})}${formActions('Simpan unit')}</form>`);
  if(action==='new-sale'){const units=state.data.units.filter(x=>!x.sale_id&&x.status==='Siap dijual');return modal('Catat penjualan',`<form class="grid-form" data-form="sale">${field('ID transaksi','code','text',{required:true,placeholder:'JUAL-001'})}${field('Tanggal jual','soldOn','date',{required:true,value:today()})}${select('Unit siap jual','unitId',units.map((unit,index)=>[unit.id,unitChoiceLabel(unit,index)]))}<div id="unit-choice-preview" class="unit-choice-preview wide" role="status">Pilih unit untuk melihat kode dan model lengkap.</div>${select('Pelanggan untuk DP','customerId',customerOptions,false)}${field('Nama pembeli jika langsung lunas','buyerName')}${field('Harga jual','price','currency',{required:true})}${field('Diskon','discount','currency',{value:0})}${field('Biaya penjualan','saleCost','currency',{value:0})}${field('Pembayaran awal','initialPayment','currency',{value:0})}${select('Metode pembayaran awal','method',['Cash','Transfer','QRIS'].map(x=>[x,x]),false)}<p class="hint wide">Pelanggan wajib dipilih jika belum lunas. Tambah pelanggan lewat menu Pelanggan terlebih dahulu.</p>${formActions('Simpan penjualan')}</form>`);}
  if(action==='new-service')return modal('Terima servis',`<form class="grid-form" data-form="service">${field('ID servis','code','text',{required:true,placeholder:'SRV-001'})}${field('Tanggal masuk','receivedOn','date',{required:true,value:today()})}${select('Pelanggan','customerId',customerOptions)}${select('Kategori','category',[['Laptop','Laptop'],['HP','HP']])}${field('Merek / model','model','text',{required:true})}${field('Keluhan','complaint','text',{required:true})}${field('Estimasi biaya untuk DP','estimateAmount','currency',{value:0})}${field('Kode sparepart','partCode')}${field('Modal per part','partUnitCost','currency',{value:0})}${field('Jumlah part','partQty','number',{value:0})}${field('Harga part ke pelanggan','partCharge','currency',{value:0})}${field('Biaya jasa ke pelanggan','serviceCharge','currency',{value:0})}${field('Biaya teknisi','technicianCost','currency',{value:0})}<p class="hint wide">Buat pelanggan terlebih dahulu melalui menu Pelanggan. Estimasi diperlukan sebelum menerima DP.</p>${formActions('Simpan servis')}</form>`);
  if(action==='edit-service'){const x=state.data.services.find(s=>s.id===el.dataset.id);return modal(`Ubah biaya ${x.code}`,`<form class="grid-form" data-form="edit-service"><input type="hidden" name="id" value="${x.id}">${field('Estimasi untuk DP','estimateAmount','currency',{value:x.estimate_amount})}${field('Kode sparepart','partCode','text',{value:x.part_code})}${field('Modal per part','partUnitCost','currency',{value:x.part_unit_cost})}${field('Jumlah part','partQty','number',{value:x.part_qty})}${field('Harga part ke pelanggan','partCharge','currency',{value:x.part_charge})}${field('Biaya jasa ke pelanggan','serviceCharge','currency',{value:x.service_charge})}${field('Biaya teknisi','technicianCost','currency',{value:x.technician_cost})}${field('Catatan','notes','text',{value:x.notes,wide:true})}${formActions('Simpan perubahan')}</form>`);}
  if(action==='pay')return modal(`Pembayaran ${el.dataset.label}`,`<p class="muted">Sisa tagihan atau estimasi: <strong>${fmt(el.dataset.remaining)}</strong></p><form class="grid-form" data-form="payment"><input type="hidden" name="requestKey" value="${crypto.randomUUID()}"><input type="hidden" name="sourceType" value="${esc(el.dataset.type)}"><input type="hidden" name="sourceId" value="${esc(el.dataset.id)}">${field('Tanggal bayar','paidOn','date',{required:true,value:today()})}${field('Jumlah bayar','amount','currency',{required:true})}${select('Metode','method',['Cash','Transfer','QRIS'].map(x=>[x,x]))}${field('Referensi','reference')}${formActions('Catat pembayaran')}</form>`);
  if(action==='service-status')return modal(`Status ${el.dataset.label}`,`<form class="grid-form" data-form="service-status"><input type="hidden" name="id" value="${esc(el.dataset.id)}">${select('Status baru','status',['Dalam pengerjaan','Menunggu sparepart','Selesai','Batal'].map(x=>[x,x]))}${field('Tanggal selesai','completedOn','date',{value:today()})}${formActions('Simpan status')}</form>`);
  if(action==='new-finance'){const key=el.dataset.kind,title={expenses:'Biaya operasional',incomes:'Pendapatan lain',losses:'Kerugian'}[key];return modal(`Tambah ${title}`,`<form class="grid-form" data-form="finance"><input type="hidden" name="kind" value="${key}">${field('ID transaksi','code','text',{required:true})}${field('Tanggal','happenedOn','date',{required:true,value:today()})}${field('Kategori','category','text',{required:true})}${field('Deskripsi','description','text',{required:true})}${field('Jumlah','amount','currency',{required:true})}${formActions('Simpan')}</form>`);}
  if(action==='new-staff')return modal('Tambah akun staf',`<form class="grid-form" data-form="staff">${field('Nama','name','text',{required:true})}${field('Username','username','text',{required:true})}${select('Peran','role',[['cashier','Kasir'],['service','Staf servis'],['owner','Pemilik']])}${field('Kata sandi sementara','password','password',{required:true})}${formActions('Tambah staf')}</form>`);
  if(action==='reset-password')return modal('Reset kata sandi',`<form class="grid-form" data-form="reset-password"><input type="hidden" name="id" value="${esc(el.dataset.id)}">${field('Kata sandi baru','password','password',{required:true})}${formActions('Reset sandi')}</form>`);
  if (action === 'payment-detail' || action === 'correct-payment') {
    const payment = state.data.payments.find(row => row.id === el.dataset.id);
    return action === 'payment-detail' ? showPayment(payment) : correctPayment(payment);
  }
  if(action==='reverse-payment')return modal(`Batalkan ${el.dataset.label}`,`<p class="muted">Pembayaran asli tetap tersimpan. Sistem akan membuat transaksi dan dokumen pembatalan.</p><form class="grid-form" data-form="reverse-payment"><input type="hidden" name="id" value="${esc(el.dataset.id)}">${field('Tanggal pembatalan','paidOn','date',{required:true,value:today()})}${field('Alasan koreksi','reason','text',{required:true,wide:true})}${formActions('Buat pembatalan')}</form>`);
}
document.addEventListener('click',async e=>{const page=e.target.closest('[data-page]');if(page){v2ui?.capturePos();dismissAccountMenu();state.page=page.dataset.page;state.customerId=null;state.search='';await loadPage();return;}const el=e.target.closest('[data-action]');if(!el)return;const action=el.dataset.action;try{if(action==='retry-page'){await loadPage();return;}if(action==='global-search'){showSearch();return;}if(action==='toggle-sidebar'){toggleSidebar(e.detail!==0);return;}if(action==='logout'){v2ui?.reset();dismissAccountMenu();await post('/logout',{});state.me=null;state.page='login';state.notice='';render();return;}if(action==='close-modal'){closeModal();return;}if(action==='back-customers'){state.customerId=null;render();return;}if(action==='customer-detail'){state.customerId=el.dataset.id;render();return;}if(action==='deactivate'){if(!confirm('Nonaktifkan akun staf ini?'))return;await post(`/users/${el.dataset.id}/deactivate`,{});await loadPage();return;}openForm(action,el);}catch(err){notice(err.message,true);}});
document.addEventListener('change',async e=>{if(e.target.id==='report-year'){state.reportYear=Number(e.target.value);await loadPage();return;}const el=e.target.closest('[data-unit-status]');if(!el)return;try{await post(`/units/${el.dataset.unitStatus}/status`,{status:el.value},'PATCH');await loadPage();}catch(err){notice(err.message,true);}});
document.addEventListener('input',e=>{if(e.target.id==='search'){state.search=e.target.value;const list=$('#customer-list');list.innerHTML=customerList();enhanceTables(list,state.page);}});
function currencyFocus(e) {
  if (e.target.matches('[data-currency]') && /^Rp [0-9.]+$/.test(e.target.value)) e.target.value = e.target.value.slice(3).replaceAll('.', '');
}
function currencyBlur(e) {
  if (!e.target.matches('[data-currency]') || !e.target.value || !e.target.validity.valid) return;
  const amount = Number(e.target.value.replace(/^Rp /, '').replaceAll('.', ''));
  if (Number.isSafeInteger(amount)) e.target.value = fmt(amount);
}
document.addEventListener('focusin', currencyFocus);
document.addEventListener('focusout', currencyBlur);
document.addEventListener('submit',async e=>{const form=e.target.closest('[data-form]');if(!form)return;e.preventDefault();
if (form.getAttribute('aria-busy') === 'true') return;
const f = formData(form), kind = form.dataset.form;
const submit = form.querySelector('[type=submit]');
const originalLabel = submit.textContent;
form.setAttribute('aria-busy', 'true');
submit.disabled = true;
submit.textContent = kind === 'login' ? 'Masuk…' : 'Menyimpan…';
form.closest('dialog')?.querySelectorAll('[data-action="close-modal"]').forEach(button => { button.disabled = true; });
try{if(kind==='setup'){await post('/setup',{storeName:val(f,'storeName'),name:val(f,'name'),username:val(f,'username'),password:val(f,'password'),openingDate:val(f,'openingDate'),openingAmount:money(f,'openingAmount')});state.page='login';state.notice='Toko siap. Silakan masuk.';render();return;}if(kind==='login'){await post('/login',{username:val(f,'username'),password:val(f,'password')});state.me=await api('/me');state.page=state.me.role==='owner'?'dashboard':state.me.role==='service'?'orders':'sales';await loadPage();return;}
  if(kind==='customer')await post('/customers',{name:val(f,'name'),phone:val(f,'phone'),notes:val(f,'notes')});
  if(kind==='unit')await post('/units',{code:val(f,'code'),category:val(f,'category'),model:val(f,'model'),intakeDate:val(f,'intakeDate'),supplier:val(f,'supplier'),purchaseAmount:money(f,'purchaseAmount'),repairAmount:money(f,'repairAmount'),extraAmount:money(f,'extraAmount'),targetAmount:money(f,'targetAmount'),status:val(f,'status'),specs:val(f,'specs')});
  if(kind==='sale')await post('/sales',{code:val(f,'code'),soldOn:val(f,'soldOn'),unitId:val(f,'unitId'),customerId:val(f,'customerId'),buyerName:val(f,'buyerName'),price:money(f,'price'),discount:money(f,'discount'),saleCost:money(f,'saleCost'),initialPayment:money(f,'initialPayment'),method:val(f,'method')});
  if(kind==='service')await post('/services',{code:val(f,'code'),receivedOn:val(f,'receivedOn'),customerId:val(f,'customerId'),category:val(f,'category'),model:val(f,'model'),complaint:val(f,'complaint'),estimateAmount:money(f,'estimateAmount'),partCode:val(f,'partCode'),partUnitCost:money(f,'partUnitCost'),partQty:Number(val(f,'partQty') || 0),partCharge:money(f,'partCharge'),serviceCharge:money(f,'serviceCharge'),technicianCost:money(f,'technicianCost')});
  if(kind==='edit-service')await post(`/services/${val(f,'id')}`,{estimateAmount:money(f,'estimateAmount'),partCode:val(f,'partCode'),partUnitCost:money(f,'partUnitCost'),partQty:Number(val(f,'partQty') || 0),partCharge:money(f,'partCharge'),serviceCharge:money(f,'serviceCharge'),technicianCost:money(f,'technicianCost'),notes:val(f,'notes')},'PATCH');
  if(kind==='payment')await post('/payments',{requestKey:val(f,'requestKey'),sourceType:val(f,'sourceType'),sourceId:val(f,'sourceId'),paidOn:val(f,'paidOn'),amount:money(f,'amount'),method:val(f,'method'),reference:val(f,'reference')});
  if(kind==='service-status')await post(`/services/${val(f,'id')}/status`,{status:val(f,'status'),completedOn:val(f,'completedOn')},'PATCH');
  if(kind==='finance')await post('/'+val(f,'kind'),{code:val(f,'code'),happenedOn:val(f,'happenedOn'),category:val(f,'category'),description:val(f,'description'),amount:money(f,'amount')});
  if(kind==='staff')await post('/users',{name:val(f,'name'),username:val(f,'username'),role:val(f,'role'),password:val(f,'password')});
  if(kind==='opening')await post('/opening',{effectiveOn:val(f,'effectiveOn'),amount:money(f,'amount')});
  if(kind==='reset-password')await post(`/users/${val(f,'id')}/password`,{password:val(f,'password')});
  if(kind==='correct-payment')await post('/payments/'+val(f,'id')+'/correct',{paidOn:val(f,'paidOn'),amount:money(f,'amount'),method:val(f,'method'),reference:val(f,'reference'),reason:val(f,'reason')});
  if(kind==='reverse-payment')await post(`/payments/${val(f,'id')}/reverse`,{paidOn:val(f,'paidOn'),reason:val(f,'reason')});
  form.removeAttribute('aria-busy');closeModal();await loadPage();
   if (!['payment','correct-payment','reverse-payment'].includes(kind) && !state.notice) notice('Data tersimpan.');
} catch (err) {
  form.removeAttribute('aria-busy');
  submit.disabled = false;
  submit.textContent = originalLabel;
  form.closest('dialog')?.querySelectorAll('[data-action="close-modal"]').forEach(button => {
    button.disabled = false;
  });
  form.querySelector('.message.error')?.remove();
  form.insertAdjacentHTML('afterbegin',
    `<div class="message error wide" role="alert" tabindex="-1">${esc(err.message)}</div>`);
  form.querySelector('.message.error')?.focus();
}});
boot().catch(e=>{state.page='login';notice(e.message,true);});
