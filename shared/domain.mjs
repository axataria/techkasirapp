const safeInteger = BigInt(Number.MAX_SAFE_INTEGER);

function integer(value) {
  if (value === null || value === undefined || value === '') return 0n;
  if (typeof value === 'number' && !Number.isSafeInteger(value)) {
    throw new RangeError('Nilai rupiah tidak dapat dihitung secara tepat.');
  }
  return BigInt(value);
}

export function publicInteger(value) {
  return value >= -safeInteger && value <= safeInteger ? Number(value) : value.toString();
}

export function sumMoney(...values) {
  return publicInteger(values.reduce((total, value) => total + integer(value), 0n));
}

export function subtractMoney(left, right) {
  return publicInteger(integer(left) - integer(right));
}

export function multiplyMoney(left, right) {
  return publicInteger(integer(left) * integer(right));
}

export function formatMoney(value) {
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(integer(value));
}

export function avatarInitial(name) {
  const first = new Intl.Segmenter('id', { granularity: 'grapheme' })
    .segment(String(name || '').trim())[Symbol.iterator]().next().value;
  return first ? first.segment.toLocaleUpperCase('id') : 'T';
}

export const fieldLimits = Object.freeze({
  storeName: 200, name: 160, buyerName: 160, username: 80, password: 256,
  phone: 40, code: 96, model: 240, supplier: 200, partCode: 96,
  category: 80, notes: 4000, specs: 4000, complaint: 4000, description: 4000,
  reference: 2000, reason: 1000,
});

const fieldNames = {
  storeName: 'Nama toko', name: 'Nama', buyerName: 'Nama pembeli',
  username: 'Username', password: 'Kata sandi', phone: 'Nomor HP',
  code: 'Kode transaksi', model: 'Model', supplier: 'Supplier',
  partCode: 'Kode sparepart', category: 'Kategori', notes: 'Catatan',
  specs: 'Spesifikasi', complaint: 'Keluhan', description: 'Deskripsi',
  reference: 'Referensi', reason: 'Alasan koreksi',
};

export function validateTextFields(payload, existing = {}) {
  for (const [key, limit] of Object.entries(fieldLimits)) {
    const value = payload[key];
    if (value !== undefined && value !== null && typeof value !== 'string') {
      throw Object.assign(new Error(fieldNames[key] + ' harus berupa teks.'), { status: 400 });
    }
    if (typeof value === 'string' && value.length > limit && value !== existing[key]) {
      throw Object.assign(new Error(fieldNames[key] + ' maksimal ' + limit + ' karakter.'), { status: 400 });
    }
  }
}
