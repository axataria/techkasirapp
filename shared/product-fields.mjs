export const platforms = {
  HP: ['Android', 'iOS', 'Lainnya'],
  Laptop: ['Windows', 'macOS', 'ChromeOS', 'Linux', 'Tanpa OS', 'Lainnya'],
};
export const conditions = ['Baru', 'Bekas'];
export const phoneOptions = {
  signal: ['Belum dites', 'Normal', 'Terbatas', 'Tidak ada sinyal'],
  carrierLock: ['Belum diperiksa', 'Bebas operator', 'SIM lock'],
  origin: ['Belum diketahui', 'Resmi Indonesia', 'Inter'],
  imeiRegistration: ['Belum diperiksa', 'Bukti registrasi tercatat', 'Bukti belum tersedia'],
  activation: ['Belum diperiksa', 'Tidak ada indikasi', 'Indikasi bypass atau akun terkunci'],
};
export const activationHold = phoneOptions.activation[2];
export const catalogCommon = ['brand', 'platform', 'manufacturerCode', 'storageGB', 'ramGB'];
export const catalogByCategory = {
  HP: ['color', 'networkSupport', 'esim'],
  Laptop: ['storageType', 'processor', 'gpu', 'screenInches', 'resolution'],
};
export const unitCommon = ['condition', 'physicalCondition', 'batteryHealth', 'batteryCheckedOn', 'repairHistory', 'accessories', 'purchaseProof', 'warrantyType', 'warrantyEndsOn'];
export const unitByCategory = {
  HP: ['imei1', 'imei2', 'signal', 'testedOperator', 'signalCheckedOn', 'carrierLock', 'lockedOperator', 'origin', 'retailer', 'imeiRegistration', 'imeiProof', 'activation', 'activationNotes'],
  Laptop: ['batteryCycles'],
};
