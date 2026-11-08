"use client";
import { useMemo, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type Row } from "@/lib/api";
export type Column = { key: string; label: string; render?: (row: Row) => ReactNode };
export function Status({ value }: { value: unknown }) { const label = String(value ?? "—"); return <Badge variant={/Lunas|Selesai|Siap dijual|Lulus|Aktif|Masuk/.test(label) ? "default" : /Batal|Ditolak|Gagal|rusak/.test(label) ? "destructive" : "secondary"}>{label}</Badge>; }
export function Empty({ title = "Belum ada data", description = "Data yang Anda catat akan muncul di sini." }: { title?: string; description?: string }) { return <div className="grid min-h-40 place-content-center gap-2 p-6 text-center"><h3 className="title-4">{title}</h3><p className="body-6 max-w-sm text-muted-foreground">{description}</p></div>; }
export function DataGrid({ rows, columns, title = "data", highlight }: { rows: Row[]; columns: Column[]; title?: string; highlight?: string | null }) {
  const [query, setQuery] = useState(""), [page, setPage] = useState(0), [size, setSize] = useState(10), [sort, setSort] = useState({ key: "", direction: 1 }), [selected, setSelected] = useState<Set<string>>(new Set());
  const filtered = useMemo(() => {
    const result = rows.filter(r => JSON.stringify(r).toLocaleLowerCase("id").includes(query.toLocaleLowerCase("id")));
    if (sort.key) result.sort((a, b) => { const av = a[sort.key] ?? "", bv = b[sort.key] ?? ""; return (/^-?\d+$/.test(String(av)) && /^-?\d+$/.test(String(bv)) ? BigInt(av) < BigInt(bv) ? -1 : BigInt(av) > BigInt(bv) ? 1 : 0 : String(av).localeCompare(String(bv), "id", { numeric: true })) * sort.direction; });
    return result;
  }, [rows, query, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / size)), current = Math.min(page, pages - 1), visible = filtered.slice(current * size, (current + 1) * size);
  return <div className="grid min-w-0 gap-4"><div className="flex flex-wrap items-center justify-between gap-3"><Input className="max-w-sm" type="search" aria-label={`Cari ${title}`} placeholder={`Cari ${title}…`} value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} /><span className="caption-2">{selected.size ? `${selected.size} dipilih · ` : ""}{filtered.length} data</span></div>
    <div className="overflow-hidden rounded-lg border"><Table><TableHeader><TableRow><TableHead><input type="checkbox" aria-label="Pilih semua baris halaman ini" checked={visible.length > 0 && visible.every(r => selected.has(r.id))} onChange={e => setSelected(prev => { const next = new Set(prev); visible.forEach(r => e.target.checked ? next.add(r.id) : next.delete(r.id)); return next; })} /></TableHead>{columns.map(col => <TableHead key={col.key}><button type="button" className="inline-flex gap-2 text-left" onClick={() => setSort(s => ({ key: col.key, direction: s.key === col.key ? -s.direction : 1 }))}>{col.label}<span aria-hidden="true">{sort.key === col.key ? sort.direction === 1 ? "↑" : "↓" : "↕"}</span></button></TableHead>)}</TableRow></TableHeader><TableBody>{visible.map((row, index) => <TableRow key={row.id || index} data-selected={selected.has(row.id) || highlight === row.id}><TableCell><input type="checkbox" aria-label={`Pilih ${row.code || row.name || index + 1}`} checked={selected.has(row.id)} onChange={e => setSelected(prev => { const next = new Set(prev); if (e.target.checked) next.add(row.id); else next.delete(row.id); return next; })} /></TableCell>{columns.map(col => <TableCell key={col.key}>{col.render ? col.render(row) : String(row[col.key] ?? "—")}</TableCell>)}</TableRow>)}</TableBody></Table></div>
    {!filtered.length && <Empty title={query ? "Tidak ada hasil" : "Belum ada data"} description={query ? "Coba kata pencarian lain." : "Tambahkan data untuk memulai."} />}
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="caption-2 flex items-center gap-2"><span>Baris per halaman</span><Select value={String(size)} onValueChange={value => { setSize(Number(value)); setPage(0); }}><SelectTrigger className="w-20" aria-label="Baris per halaman"><SelectValue /></SelectTrigger><SelectContent>{[5, 10, 20].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent></Select></div><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={!current} onClick={() => setPage(current - 1)}>Sebelumnya</Button><span className="caption-2">{current + 1} / {pages}</span><Button variant="outline" size="sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Berikutnya</Button></div></div>
  </div>;
}
