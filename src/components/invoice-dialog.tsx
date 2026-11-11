"use client";

import { useRef, useState } from "react";
import { DownloadSimpleIcon, PrinterIcon, ShareNetworkIcon } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function InvoiceDialog({ href, label }: { href: string; label: string }) {
  const preview = useRef<HTMLIFrameElement>(null);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [manualLink, setManualLink] = useState("");

  function changeOpen(next: boolean) {
    setOpen(next);
    setState("loading");
    setMessage("");
    setManualLink("");
  }

  function print(save: boolean) {
    const frame = preview.current?.contentWindow;
    if (!frame || state !== "ready") return;
    setMessage(save ? 'Pilih “Simpan sebagai PDF” sebagai tujuan di dialog cetak.' : "");
    frame.print();
  }

  async function share() {
    const url = new URL(href, window.location.origin).href;
    setMessage("");
    setManualLink("");
    if (navigator.share) {
      try {
        await navigator.share({ title: "Invoice TechKasir", url });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Tautan invoice disalin.");
    } catch {
      setManualLink(url);
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm">{label}</Button></DialogTrigger>
      <DialogContent className="gap-0 overflow-x-hidden p-0 sm:max-w-4xl">
        <header className="grid gap-2 border-b px-6 py-4 pr-12">
          <DialogTitle>Detail invoice</DialogTitle>
          <DialogDescription>Pratinjau dokumen dalam format A5 potret.</DialogDescription>
        </header>
        <div className="grid min-w-0 md:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="min-w-0 bg-muted p-3 sm:p-6">
            <div className="relative mx-auto max-w-[30rem] border bg-white shadow-sm">
              {state === "loading" && <p role="status" className="absolute inset-x-0 top-4 text-center text-sm text-slate-600">Memuat invoice…</p>}
              {state === "error" && <p role="alert" className="p-4 text-sm text-slate-900">Pratinjau tidak tersedia. <a className="underline" href={href} target="_blank" rel="noopener noreferrer">Buka dokumen</a></p>}
              {open && <iframe
                ref={preview}
                title="Pratinjau invoice A5"
                tabIndex={-1}
                src={`${href}&preview=1`}
                className={`block aspect-[148/210] w-full ${state === "error" ? "hidden" : ""}`}
                onLoad={event => {
                  const document = event.currentTarget.contentDocument;
                  const ready = Boolean(document?.getElementById("invoice-sheet"));
                  setState(ready ? "ready" : "error");
                  if (ready) document?.addEventListener("keydown", keyEvent => {
                    if (keyEvent.key === "Escape") changeOpen(false);
                  });
                }}
              />}
            </div>
          </div>
          <section aria-label="Aksi invoice" className="grid content-start gap-3 border-t p-4 md:border-t-0 md:border-l md:p-6">
            <h3 className="text-sm font-semibold">Aksi invoice</h3>
            <Button className="justify-start" disabled={state !== "ready"} onClick={() => print(true)}><DownloadSimpleIcon /> Simpan PDF</Button>
            <Button className="justify-start" variant="outline" disabled={state !== "ready"} onClick={() => print(false)}><PrinterIcon /> Cetak</Button>
            <Button className="justify-start" variant="outline" disabled={state !== "ready"} onClick={share}><ShareNetworkIcon /> Bagikan tautan</Button>
            <p className="text-xs text-muted-foreground">Untuk menyimpan PDF, pilih “Simpan sebagai PDF” di dialog cetak. Tautan hanya dapat dibuka oleh pengguna yang memiliki akses.</p>
            <p role="status" className={message ? "text-sm" : "sr-only"}>{message}</p>
            {manualLink && <Input aria-label="Salin tautan invoice" readOnly value={manualLink} onFocus={event => event.currentTarget.select()} />}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
