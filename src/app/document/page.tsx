"use client";
import { useEffect, useRef, useState } from "react";
import { documentHtml, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";

export default function DocumentPage() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [login, setLogin] = useState(false);
  const [returnQuery, setReturnQuery] = useState("");
  useEffect(() => {
    const query = window.location.search;
    setReturnQuery(query.slice(1));
    const controller = new AbortController();
    void documentHtml(`/document${query}`, controller.signal).then(setHtml).catch(error => {
      if (controller.signal.aborted) return;
      setLogin(error instanceof ApiError && error.status === 401);
      setError(error instanceof Error ? error.message : "Dokumen belum tersedia.");
    });
    return () => controller.abort();
  }, []);
  return <main className="grid min-h-dvh gap-4 p-4">
    {html ? <>
      <Button className="w-fit" onClick={() => frame.current?.contentWindow?.print()}>Cetak / Simpan PDF</Button>
      <iframe ref={frame} title="Dokumen TechKasir" srcDoc={html} sandbox="allow-same-origin allow-modals" className="min-h-[85dvh] w-full border-0" />
    </> : <div role={error ? "alert" : "status"}>
      <p>{error || "Memuat dokumen…"}</p>
      {login && <Button asChild><a href={`/?document=${encodeURIComponent(returnQuery)}`}>Masuk untuk membuka dokumen</a></Button>}
    </div>}
  </main>;
}
