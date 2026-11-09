const scopes = {
  customers: ['Pelanggan', 'customers'], units: ['Stok unit', 'units'],
  sales: ['Penjualan', 'sales'], services: ['Servis', 'services'],
  payments: ['Pembayaran', 'payments'], expenses: ['Biaya operasional', 'finance'],
  incomes: ['Pendapatan lain', 'finance'], losses: ['Kerugian', 'finance'],
  users: ['Staf', 'staff'], audit: ['Log perubahan', 'audit'],
  'v2/warranties':['Garansi','warranties'],'v2/customer-returns':['Retur pelanggan','customer-returns'],
  'v2/receiving':['Barang masuk','receiving'],'v2/qc':['QC','qc'],'v2/supplier-returns':['Retur supplier','supplier-returns']
};
const normalize = value => String(value ?? '').normalize('NFKC').toLowerCase();
const tokens = value => normalize(value).match(/[\p{L}\p{N}+-]+/gu) || [];
// Read through the existing API so search inherits store isolation, role checks,
// and field redaction instead of maintaining a second set of access rules.
export async function searchRecords({ query, offset = 0, role, read, includeV2 = false }) {
  const terms = tokens(query);
  const message = 'Hasil pencarian dari database toko sesuai akses Anda.';
  if (!terms.length) return { message, total: 0, offset, results: [], hasMore: false };
  const allowed = ['customers','units','payments'];
  if (role !== 'service') allowed.push('sales');
  if (role !== 'cashier') allowed.push('services');
  if (role === 'owner') allowed.push('expenses','incomes','losses','users','audit');
  if(includeV2){allowed.push('v2/warranties','v2/customer-returns');if(role!=='cashier')allowed.push('v2/receiving','v2/qc','v2/supplier-returns');}
  const matches = [];
  for (const scope of allowed) {
    const response = await read(scope);
    const rows = Array.isArray(response)?response:response.claims||[];
    for (const row of rows) {
      const [label, page] = scopes[scope];
      const fields = Object.entries({ ...row, ...(row.details || {}), ...(row.catalogDetails?.brand ? { brand: row.catalogDetails.brand } : {}) }).filter(([key,value]) =>
        !/(^id$|_id$|password|snapshot|created_at)/.test(key) && value !== null && typeof value !== 'object');
      const text = normalize([label, scope, ...fields.map(([,value]) => value)].join(' '));
      const date = row.sold_on || row.received_on || row.paid_on || row.happened_on || row.intake_date || row.created_at?.slice(0,10) || '';
      if (!terms.every(term => text.includes(term))) continue;
      const title = row.document_number || row.code || row.name || `${row.entity} · ${row.action}`;
      matches.push({ id: row.id, scope, page, label, title,
        summary: [row.model, row.customer_name || row.buyer_name, row.phone, row.description, row.details?.person, row.details?.source, row.status, date].filter(Boolean).join(' · '),
        fields: Object.fromEntries(fields) });
    }
  }
  return { message, total: matches.length, offset, results: matches.slice(offset, offset + 20), hasMore: offset + 20 < matches.length };
}
