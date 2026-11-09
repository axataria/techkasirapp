import { catalogByCategory, catalogCommon, conditions, phoneOptions, platforms, unitByCategory, unitCommon } from "../../shared/product-fields.mjs";
import { choice, date, numeric, text, type Field } from "@/components/record-form";
import type { Row } from "@/lib/api";

const categoryOf = (value: string | number) => value === "HP" || value === "Laptop" ? value : undefined;

export function catalogFields(product?: Row): Field[] {
  const values = product?.catalogDetails || {};
  const category = (inputs: Row) => categoryOf(product?.category || inputs.category);
  const optional = (name: string, label: string) => ({ ...text(name, label, values[name] ?? "", false), maxLength: 400 });
  const capacity = (name: string, label: string) => ({ ...numeric(name, label, values[name] ?? ""), required: false });
  const select = (name: string, label: string, options: string[]) => choice(name, label, options, values[name] || "", false);
  return [
    { ...text("brand", "Merek", values.brand || ""), maxLength: 400 },
    { ...choice("platform", "Platform / sistem operasi", [], values.platform || ""),
      optionsFor: inputs => { const type = category(inputs); return type ? platforms[type].map(value => [value, value]) : []; } },
    optional("manufacturerCode", "Kode model pabrikan"),
    capacity("storageGB", "Penyimpanan (GB)"),
    capacity("ramGB", "RAM (GB)"),
    ...[optional("color", "Warna"), select("networkSupport", "Dukungan jaringan", ["4G", "5G", "Lainnya"]), select("esim", "Dukungan eSIM", ["Ya", "Tidak"])]
      .map(field => ({ ...field, visibleWhen: (inputs: Row) => category(inputs) === "HP" })),
    ...[select("storageType", "Jenis penyimpanan", ["SSD", "HDD", "SSD + HDD"]), optional("processor", "Prosesor"), optional("gpu", "GPU"),
      { ...optional("screenInches", "Ukuran layar (inci)"), inputMode: "decimal" as const }, optional("resolution", "Resolusi layar")]
      .map(field => ({ ...field, visibleWhen: (inputs: Row) => category(inputs) === "Laptop" })),
  ];
}

export function unitFields(existing?: Row): Field[] {
  const values = existing?.unitDetails || {};
  const category = (inputs: Row) => existing?.category || inputs.category;
  const optional = (name: string, label: string) => ({ ...text(name, label, values[name] ?? "", false), maxLength: 400 });
  const number = (name: string, label: string) => ({ ...numeric(name, label, values[name] ?? ""), required: false });
  const day = (name: string, label: string) => ({ ...date(name, label, values[name] || ""), required: false });
  const select = (name: string, label: string, options: string[]) => choice(name, label, options, values[name] || "", false);
  const imei = (name: string, label: string) => ({ ...optional(name, label), inputMode: "numeric" as const, pattern: "[0-9]{15}", maxLength: 15 });
  return [
    choice("condition", "Kondisi barang", conditions, values.condition || "", !existing),
    optional("physicalCondition", "Kondisi fisik, segel, atau minus"),
    number("batteryHealth", "Kesehatan baterai (%)"), day("batteryCheckedOn", "Tanggal tes baterai"),
    optional("repairHistory", "Riwayat servis atau ganti komponen"), optional("accessories", "Kelengkapan"),
    optional("purchaseProof", "Referensi bukti pembelian"), optional("warrantyType", "Jenis garansi unit"), day("warrantyEndsOn", "Akhir garansi unit"),
    { ...number("batteryCycles", "Siklus baterai"), visibleWhen: inputs => category(inputs) === "Laptop" },
    ...[
      imei("imei1", "IMEI utama"), imei("imei2", "IMEI kedua"),
      select("signal", "Hasil tes sinyal", phoneOptions.signal), optional("testedOperator", "Operator yang diuji"), day("signalCheckedOn", "Tanggal tes sinyal"),
      select("carrierLock", "Kunci operator", phoneOptions.carrierLock), optional("lockedOperator", "Operator yang mengunci"),
      select("origin", "Asal unit", phoneOptions.origin), optional("retailer", "Penjual / distributor (mis. iBox)"),
      select("imeiRegistration", "Registrasi IMEI", phoneOptions.imeiRegistration), optional("imeiProof", "Referensi bukti Bea Cukai"),
      select("activation", "Temuan akun / aktivasi", phoneOptions.activation), optional("activationNotes", "Catatan temuan aktivasi"),
    ].map(field => ({ ...field, visibleWhen: (inputs: Row) => category(inputs) === "HP" })),
  ];
}

function pickFields(values: Row, keys: string[]) {
  return Object.fromEntries(keys.filter(key => Object.hasOwn(values, key)).map(key => [key, values[key]]));
}

export function catalogValues(values: Row, category = values.category) {
  const type = categoryOf(category);
  return pickFields(values, [...catalogCommon, ...(type ? catalogByCategory[type] : [])]);
}

export function unitValues(values: Row, category = values.category) {
  const type = categoryOf(category);
  return pickFields(values, [...unitCommon, ...(type ? unitByCategory[type] : [])]);
}

export function productTitle(row: Row) {
  const brand = row.catalogDetails?.brand;
  const model = String(row.model || "");
  return brand && !model.toLocaleLowerCase("id").startsWith(String(brand).toLocaleLowerCase("id")) ? `${brand} ${model}` : model;
}

export function productSpecs(row: Row) {
  const details = row.catalogDetails || {};
  return [details.platform, details.storageGB && `${details.storageGB} GB`, details.ramGB && `RAM ${details.ramGB} GB`, details.processor, row.specs].filter(Boolean).join(" · ");
}

export function networkNotes(row: Row) {
  const details = row.unitDetails || {};
  return [details.signal && `Sinyal ${String(details.signal).toLocaleLowerCase("id")}${details.testedOperator ? ` (${details.testedOperator})` : ""}`,
    details.carrierLock === "SIM lock" && `SIM lock${details.lockedOperator ? ` (${details.lockedOperator})` : ""}`].filter(Boolean).join(" · ");
}
