"use client";

import { useState } from "react";
import { CaretDownIcon, CheckIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Row } from "@/lib/api";

const pageSize = 20;
const countFormat = new Intl.NumberFormat("id-ID");

export function CustomerPicker({ id, customers, value, onChange, disabled }: {
  id: string;
  customers: Row[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const selected = customers.find(customer => customer.id === value);
  const label = value ? selected?.name || "Pelanggan tidak tersedia" : "Pelanggan umum";
  const normalized = query.trim().toLocaleLowerCase("id-ID");
  const filtered = customers.filter(customer =>
    `${customer.name || ""} ${customer.phone || ""}`.toLocaleLowerCase("id-ID").includes(normalized)
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * pageSize, (current + 1) * pageSize);

  function choose(customerId: string) {
    onChange(customerId);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={next => {
      setOpen(next);
      if (next) {
        setQuery("");
        setPage(0);
      }
    }}>
      <DialogTrigger asChild>
        <Button id={id} variant="outline" disabled={disabled}
          className="h-auto min-h-11 w-full min-w-0 justify-between whitespace-normal py-2 text-left">
          <span className="min-w-0 flex-1 wrap-anywhere">{label}</span>
          <CaretDownIcon className="size-4 shrink-0" aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent className="min-w-0 grid-cols-[minmax(0,1fr)] p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle>Pilih pelanggan</DialogTitle>
          <DialogDescription className="wrap-anywhere">Cari berdasarkan nama atau nomor HP.</DialogDescription>
        </DialogHeader>
        <Input type="search" aria-label="Cari pelanggan" placeholder="Nama atau nomor HP"
          value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} />
        <Button variant="outline" aria-pressed={!value} className="h-auto min-h-11 justify-between whitespace-normal wrap-anywhere py-2" onClick={() => choose("")}>
          Pelanggan umum {!value && <CheckIcon aria-hidden />}
        </Button>
        <p className="caption-2 wrap-anywhere" role="status">{countFormat.format(filtered.length)} pelanggan</p>
        <div className="grid min-w-0 gap-2" aria-label="Hasil pencarian pelanggan">
          {visible.map(customer => (
            <Button key={customer.id} variant={value === customer.id ? "secondary" : "outline"}
              aria-pressed={value === customer.id}
              className="h-auto min-h-11 min-w-0 justify-between whitespace-normal py-2 text-left"
              onClick={() => choose(customer.id)}>
              <span className="min-w-0 flex-1 wrap-anywhere">
                <span className="block">{customer.name}</span>
                {customer.phone && <span className="caption-2 block">{customer.phone}</span>}
              </span>
              {value === customer.id && <CheckIcon className="shrink-0" aria-hidden />}
            </Button>
          ))}
          {!visible.length && <p className="body-6 py-4 text-muted-foreground">Tidak ada pelanggan yang cocok.</p>}
        </div>
        {pages > 1 && (
          <nav aria-label="Halaman pelanggan" className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" size="sm" className="h-auto min-h-8 max-w-full whitespace-normal wrap-anywhere py-2" disabled={current === 0} onClick={() => setPage(current - 1)}>Sebelumnya</Button>
            <span className="caption-2">{current + 1} / {countFormat.format(pages)}</span>
            <Button variant="outline" size="sm" className="h-auto min-h-8 max-w-full whitespace-normal wrap-anywhere py-2" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Berikutnya</Button>
          </nav>
        )}
      </DialogContent>
    </Dialog>
  );
}
