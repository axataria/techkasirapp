import { activationHold, catalogByCategory, catalogCommon, conditions, phoneOptions, platforms, unitByCategory, unitCommon } from '../../shared/product-fields.mjs';

export function createProductDetails({ db, one, run, bad, date }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS catalog_details (product_id TEXT PRIMARY KEY REFERENCES v2_products(id), details TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS unit_details (unit_id TEXT PRIMARY KEY REFERENCES units(id), details TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS unit_imeis (store_id TEXT NOT NULL REFERENCES stores(id), imei TEXT NOT NULL,
      unit_id TEXT NOT NULL REFERENCES units(id), PRIMARY KEY(store_id, imei));
    CREATE INDEX IF NOT EXISTS idx_unit_imeis_unit ON unit_imeis(unit_id);
  `);

  function fields(value, allowed) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw bad('Detail produk atau unit tidak valid.');
    const result = {};
    for (const [key, entry] of Object.entries(value)) {
      if (!allowed.includes(key)) throw bad('Ada detail yang tidak sesuai dengan kategori.');
      if (entry == null || entry === '') continue;
      if (typeof entry !== 'string' && typeof entry !== 'number') throw bad('Nilai detail tidak valid.');
      const value = String(entry).trim();
      if (value.length > 400) throw bad('Detail maksimal 400 karakter per kolom.');
      if (value) result[key] = value;
    }
    return result;
  }

  function option(details, key, choices) {
    if (details[key] && !choices.includes(details[key])) throw bad('Pilihan detail tidak valid.');
  }

  function number(details, key, min, max, decimal = false) {
    if (details[key] === undefined) return;
    const value = Number(details[key]);
    if (!Number.isFinite(value) || (!decimal && !Number.isInteger(value)) || value < min || value > max) throw bad('Angka spesifikasi atau pemeriksaan di luar batas.');
    details[key] = value;
  }

  function catalog(category, value) {
    if (!Object.hasOwn(platforms, category)) throw bad('Kategori tidak valid.');
    const details = fields(value, [...catalogCommon, ...catalogByCategory[category]]);
    if (!details.brand || !platforms[category].includes(details.platform)) throw bad('Isi merek dan platform sesuai kategori.');
    number(details, 'storageGB', 1, 65536);
    number(details, 'ramGB', 1, 2048);
    number(details, 'screenInches', 1, 100, true);
    option(details, 'storageType', ['SSD', 'HDD', 'SSD + HDD']);
    option(details, 'networkSupport', ['4G', '5G', 'Lainnya']);
    option(details, 'esim', ['Ya', 'Tidak']);
    return details;
  }

  function unit(category, value, requiresCondition = false) {
    if (!Object.hasOwn(platforms, category)) throw bad('Kategori tidak valid.');
    const details = fields(value, [...unitCommon, ...unitByCategory[category]]);
    option(details, 'condition', conditions);
    if (requiresCondition && !details.condition) throw bad('Pilih kondisi Baru atau Bekas.');
    number(details, 'batteryHealth', 0, 100);
    number(details, 'batteryCycles', 0, 100000);
    for (const key of ['batteryCheckedOn', 'signalCheckedOn', 'warrantyEndsOn']) if (details[key]) date(details[key]);
    if (details.batteryHealth !== undefined && !details.batteryCheckedOn) throw bad('Isi tanggal pemeriksaan baterai.');
    if (category === 'HP') {
      for (const [key, choices] of Object.entries(phoneOptions)) option(details, key, choices);
      for (const key of ['imei1', 'imei2']) if (details[key] && !/^\d{15}$/.test(details[key])) throw bad('IMEI harus terdiri dari 15 digit.');
      if (details.imei1 && details.imei1 === details.imei2) throw bad('IMEI utama dan kedua harus berbeda.', 409);
      if (details.signal && details.signal !== 'Belum dites' && (!details.testedOperator || !details.signalCheckedOn)) throw bad('Isi operator dan tanggal untuk hasil tes sinyal.');
      if (details.activation === activationHold && !details.activationNotes) throw bad('Isi catatan untuk temuan bypass atau akun terkunci.');
    }
    return details;
  }

  function checkImei(storeId, imei, unitId = '') {
    const used = one('SELECT unit_id FROM unit_imeis WHERE store_id=? AND imei=? AND unit_id<>?', storeId, imei, unitId)
      || one("SELECT m.unit_id FROM v2_unit_meta m JOIN units u ON u.id=m.unit_id WHERE m.store_id=? AND m.serial=? AND m.unit_id<>? AND u.category='HP'", storeId, imei, unitId);
    if (used) throw bad('IMEI sudah digunakan pada unit lain di toko ini.', 409);
  }

  function writeUnit(storeId, unitId, details) {
    const identifiers = [details.imei1, details.imei2].filter(Boolean);
    for (const imei of identifiers) checkImei(storeId, imei, unitId);
    run('DELETE FROM unit_imeis WHERE unit_id=?', unitId);
    for (const imei of identifiers) run('INSERT INTO unit_imeis VALUES(?,?,?)', storeId, imei, unitId);
    run('INSERT INTO unit_details VALUES(?,?) ON CONFLICT(unit_id) DO UPDATE SET details=excluded.details', unitId, JSON.stringify(details));
  }

  return { catalog, unit, checkImei, writeUnit };
}
