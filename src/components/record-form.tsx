"use client";
import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { amount, type Row } from "@/lib/api";
type FormInputs = Record<string, string | number>;
export type Field = { name: string; label: string; type?: string; required?: boolean; value?: string | number; options?: [string, string][]; presets?: Record<string, FormInputs>; wide?: boolean; hint?: string; maxLength?: number; autoComplete?: string; inputMode?: React.ComponentProps<"input">["inputMode"]; pattern?: string; minLength?: number;
  visibleWhen?: (values: FormInputs) => boolean;
  disabledWhen?: (values: FormInputs) => boolean;
  optionsFor?: (values: FormInputs) => [string, string][];
};
export type FormSpec = { title: string; description?: string; fields: Field[]; submit?: string; save: (values: Row) => Promise<void> };
export const text = (name: string, label: string, value: string | number = "", required = true): Field => ({ name, label, value, required });
export const numeric = (name: string, label: string, value: string | number = 0): Field => ({ name, label, value, type: "number", required: true });
export const currency = (name: string, label: string): Field => ({ name, label, value: "0", type: "currency", required: true });
export const date = (name: string, label: string, value: string): Field => ({ name, label, value, type: "date", required: true });
export const choice = (name: string, label: string, values: string[] | [string, string][], value = "", required = true): Field => ({ name, label, value, required, options: values.map(v => Array.isArray(v) ? v : [v, v]) });
export function RecordForm({ spec, onDone, onBusy, singleColumn = false }: { spec: FormSpec; onDone: () => void; onBusy?: (busy: boolean) => void; singleColumn?: boolean }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [inputs, setInputs] = useState<Record<string, string | number>>(() => Object.fromEntries(spec.fields.map(field => [field.name, field.value ?? ""])));
  const lock = useRef(false);
  const fields = spec.fields.filter(field => !field.visibleWhen || field.visibleWhen(inputs)).map(field => ({
    ...field, options: field.optionsFor?.(inputs) ?? field.options,
  }));
  return <form className={singleColumn ? "grid grid-cols-1 gap-4 [&>div]:col-span-1 [&>p]:col-span-1" : "grid grid-cols-1 gap-4 sm:grid-cols-2"} aria-busy={busy} onSubmit={async event => {
    event.preventDefault(); if (lock.current) return; lock.current = true; setBusy(true); onBusy?.(true); setError("");
    try {
      const values: Row = {};
      for (const field of fields) {
        const value = inputs[field.name] === "__none" ? "" : inputs[field.name];
        if (field.required && (value === undefined || value === "")) throw new Error(`${field.label} wajib diisi.`);
        if (field.type === "currency") {
          const rupiah = Number(String(value).replaceAll(".", ""));
          if (!Number.isSafeInteger(rupiah) || rupiah < 0) throw new Error(`${field.label} harus berupa jumlah rupiah yang valid.`);
          values[field.name] = rupiah;
        } else {
          values[field.name] = field.type === "number" && value !== "" ? amount(String(value)) : value;
        }
      }
      await spec.save(values);
      onDone();
    }
    catch (err) { setError(err instanceof Error ? err.message : "Data belum berhasil disimpan."); }
    finally { lock.current = false; setBusy(false); onBusy?.(false); }
  }}>
    {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive sm:col-span-2">{error}</p>}
    {fields.map(field => <div key={field.name} className={field.wide ? "grid gap-2 sm:col-span-2" : "grid min-w-0 gap-2"}><Label htmlFor={`field-${field.name}`}>{field.label}{field.required && <span className="ml-1 text-destructive">*</span>}</Label>
      {field.type === "currency" ? <div className="relative">
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">Rp</span>
        <Input id={`field-${field.name}`} name={field.name} className="pl-10 tabular-nums" inputMode="numeric" required={field.required} disabled={busy} value={inputs[field.name] ?? ""} onChange={event => {
          const value = event.target.value;
          if (/^\d*(?:\.\d*)*$/.test(value)) setInputs(current => ({ ...current, [field.name]: value.replaceAll(".", "") }));
        }} onBlur={event => {
          const digits = event.target.value.replaceAll(".", "");
          if (digits) setInputs(current => ({ ...current, [field.name]: BigInt(digits).toLocaleString("id-ID") }));
        }} />
      </div> : field.options ? <Select name={field.name} value={String(inputs[field.name] ?? "")} onValueChange={value => setInputs(current => ({ ...current, ...field.presets?.[value], [field.name]: value }))} required={field.required} disabled={busy || !field.options.length || field.disabledWhen?.(inputs)}><SelectTrigger id={`field-${field.name}`}><SelectValue placeholder={field.options.length ? "Pilih…" : "Belum ada pilihan"} /></SelectTrigger><SelectContent>{!field.required && <SelectItem value="__none">Tanpa pilihan</SelectItem>}{field.options.filter(([v]) => v).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select> : <Input id={`field-${field.name}`} name={field.name} type={field.type || "text"} value={inputs[field.name] ?? ""} onChange={event => setInputs(current => ({ ...current, [field.name]: event.target.value }))} required={field.required} disabled={busy || field.disabledWhen?.(inputs)} min={field.type === "number" ? 0 : undefined} step={field.type === "number" ? 1 : undefined} max={field.type === "date" ? "9999-12-31" : undefined} maxLength={field.maxLength || (field.type === "password" ? 256 : 4000)} inputMode={field.inputMode} pattern={field.pattern} minLength={field.minLength ?? (field.type === "password" && spec.title !== "Masuk ke toko" ? 10 : undefined)} autoComplete={field.autoComplete ?? (field.type === "password" ? (spec.title === "Masuk ke toko" ? "current-password" : "new-password") : field.name === "username" ? "username" : undefined)} />}
      {field.hint && <p className="caption-2">{field.hint}</p>}
    </div>)}
    <div className="flex justify-end gap-2 pt-2 sm:col-span-2"><Button type="submit" disabled={busy || fields.some(f => f.required && f.options?.length === 0)}>{busy ? "Menyimpan…" : spec.submit || "Simpan"}</Button></div>
  </form>;
}
