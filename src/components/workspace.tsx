"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SquaresFourIcon, ShoppingCartIcon, ListBulletsIcon, UsersIcon, ShieldCheckIcon, ArrowUUpLeftIcon, PackageIcon, TrayArrowDownIcon, CheckSquareIcon, ArrowUUpRightIcon, ChartBarIcon, SlidersHorizontalIcon, MagnifyingGlassIcon, ListIcon, SignOutIcon, MoonIcon, SunIcon, CaretDownIcon, ArrowRightIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { RecordForm, type FormSpec, text, date, numeric } from "@/components/record-form";
import { api, ApiError, today, roleName, type User } from "@/lib/api";
import { cn } from "@/lib/utils";
import { APP_RELEASE } from "@/lib/version";
import { applyPalette } from "@/lib/appearance";
import { Screens } from "@/components/screens";
import { createActions } from "@/components/workspace-actions";
import type { WorkspaceContext } from "@/components/workspace-context";

const navigation = [
  ["dashboard", "Dasbor", SquaresFourIcon, ["owner"]], ["sales", "Kasir", ShoppingCartIcon, ["owner", "cashier"]],
  ["orders", "Riwayat pesanan", ListBulletsIcon, ["owner", "cashier", "service"]], ["customers", "Pelanggan", UsersIcon, ["owner", "cashier", "service"]],
  ["warranties", "Garansi", ShieldCheckIcon, ["owner", "cashier", "service"]], ["customer-returns", "Retur pelanggan", ArrowUUpLeftIcon, ["owner", "cashier", "service"]],
  ["units", "Produk", PackageIcon, ["owner", "cashier", "service"]], ["receiving", "Barang masuk", TrayArrowDownIcon, ["owner", "service"]],
  ["qc", "QC", CheckSquareIcon, ["owner", "service"]], ["supplier-returns", "Retur supplier", ArrowUUpRightIcon, ["owner", "service"]],
  ["reports", "Report", ChartBarIcon, ["owner"]], ["settings", "Pengaturan", SlidersHorizontalIcon, ["owner", "cashier", "service"]]
] as const;
const parent = (page: string) => ({ services: "orders", payments: "reports", finance: "reports", staff: "settings", audit: "settings" }[page] || page);
export function Workspace({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const page = pathname.split("/")[1] || "dashboard";
  const validRoute = pathname === "/" || [...navigation.map(([id]) => id), "services", "payments", "finance", "staff", "audit"].includes(pathname.slice(1));
  const [me, setMe] = useState<User | null>(null), [setup, setSetup] = useState(false), [booting, setBooting] = useState(true), [loading, setLoading] = useState(false), [error, setError] = useState("");
  const [data, setData] = useState<Record<string, any>>({}), [dark, setDark] = useState(false), [mobile, setMobile] = useState(false), [collapsed, setCollapsed] = useState(false);
  const [dialog, setDialog] = useState<{ title: string; content?: ReactNode; spec?: FormSpec } | null>(null), [busy, setBusy] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false), [query, setQuery] = useState(""), [results, setResults] = useState<any>(null), [searchError, setSearchError] = useState(""), [searching, setSearching] = useState(false);
  const generation = useRef(0);
  const [loadedPage, setLoadedPage] = useState<string | null>(null);
  const scrollArea = useRef<HTMLDivElement>(null), contentArea = useRef<HTMLElement>(null);
  const pointerNavigation = useRef(false);
  const [focus, setFocus] = useState<string | null>(null);
  useEffect(() => { const syncRecord = () => setFocus(new URLSearchParams(window.location.search).get("record")); window.addEventListener("popstate", syncRecord); return () => window.removeEventListener("popstate", syncRecord); }, []);
  const navigate = useCallback((next: string, id?: string) => { setMobile(false); setFocus(id || null); router.push(`/${next}${id ? `?record=${encodeURIComponent(id)}` : ""}`); }, [router]);
  useEffect(() => {
    // Only the content scroll position resets. The shared shell stays mounted.
    scrollArea.current?.scrollTo({ top: 0, behavior: "instant" });
    setFocus(new URLSearchParams(window.location.search).get("record"));
    setMobile(false);
    setDialog(null);
    setSearchOpen(false);
  }, [pathname]);
  useEffect(() => {
    const pointer = () => { pointerNavigation.current = true; };
    const keyboard = () => { pointerNavigation.current = false; };
    window.addEventListener("pointerdown", pointer, true);
    window.addEventListener("keydown", keyboard, true);
    return () => { window.removeEventListener("pointerdown", pointer, true); window.removeEventListener("keydown", keyboard, true); };
  }, []);
  useLayoutEffect(() => {
    if (!me || loadedPage !== page || !pointerNavigation.current || !contentArea.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const style = getComputedStyle(contentArea.current);
    const animation = contentArea.current.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: parseFloat(style.getPropertyValue("--section-fade-duration")) || 180,
      easing: style.getPropertyValue("--ease-ui").trim() || "cubic-bezier(.22,1,.36,1)",
    });
    return () => animation.cancel();
  }, [me, page, loadedPage]);
  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem("techkasir.appearance") || "{}"); const value = saved.mode === "dark"; setDark(value); document.documentElement.classList.toggle("dark", value); applyPalette(saved.palette || "emerald"); setCollapsed(localStorage.getItem("techkasir.sidebarCollapsed") === "true"); } catch {}
    const id = new URLSearchParams(window.location.search).get("record"); setFocus(id);
    let active = true;
    (async () => { try { const bootstrap = await api("/bootstrap"); if (!active) return; setSetup(bootstrap.needsSetup); if (!bootstrap.needsSetup) { try { const user = await api("/me"); if (active) setMe(user); } catch (err) { if (!(err instanceof ApiError && err.status === 401)) throw err; } } } catch (err) { if (active) setError(err instanceof Error ? err.message : "Server belum tersedia."); } finally { if (active) setBooting(false); } })();
    return () => { active = false; };
  }, []);
  const reload = useCallback(async () => {
    if (!me) return; const version = ++generation.current; setLoading(true); setError("");
    const reads = new Map<string, string>();
    const add = (key: string, path = `/${key}`) => reads.set(key, path);
    if (["dashboard", "reports"].includes(page)) { add("summary", "/v2/summary"); add("reports", `/reports?year=${today().slice(0, 4)}`); }
    if (page === "dashboard") { add("dashboard"); add("units"); add("payments"); add("services"); }
    if (["sales", "orders", "customers", "units", "receiving", "qc", "warranties", "customer-returns", "supplier-returns", "services"].includes(page)) {
      add("customers"); add("units"); add("payments");
      if (me.role !== "service") add("sales");
      if (["orders", "services"].includes(page) && me.role !== "cashier") add("services");
      if (["orders", "customers", "warranties", "customer-returns"].includes(page)) { add("warranties", "/v2/warranties"); add("customerReturns", "/v2/customer-returns"); }
      if (["units", "receiving"].includes(page)) add("products", "/v2/products");
      if (["receiving", "supplier-returns"].includes(page) && me.role !== "cashier") { add("suppliers", "/v2/suppliers"); add("receiving", "/v2/receiving"); }
      if (["units", "qc"].includes(page) && me.role !== "cashier") add("qc", "/v2/qc");
      if (page === "supplier-returns") add("supplierReturns", "/v2/supplier-returns");
    }
    if (page === "payments") { add("payments"); add("sales"); }
    if (page === "finance") ["expenses", "incomes", "losses"].forEach(key => add(key));
    if (page === "settings" && me.role === "owner") { add("opening"); add("policy", "/v2/policy"); }
    if (page === "staff") add("users"); if (page === "audit") add("audit");
    try { const entries = await Promise.all([...reads].map(async ([key, path]) => [key, await api(path)])); if (version === generation.current) { setData(Object.fromEntries(entries)); setLoadedPage(page); } }
    catch (err) { if (version === generation.current) { if (err instanceof ApiError && err.status === 401) { setMe(null); setData({}); setLoadedPage(null); setError("Sesi berakhir. Silakan masuk kembali."); } else { setError(err instanceof Error ? err.message : "Data gagal dimuat."); setLoadedPage(page); } } }
    finally { if (version === generation.current) setLoading(false); }
  }, [me, page]);
  useEffect(() => { if (me && validRoute) { const permitted = navigation.find(([id]) => id === parent(page)); if (!permitted || !(permitted[3] as readonly string[]).includes(me.role) || (["finance", "payments", "staff", "audit"].includes(page) && me.role !== "owner")) { navigate(me.role === "owner" ? "dashboard" : me.role === "service" ? "orders" : "sales"); return; } void reload(); } return () => { generation.current++; }; }, [me, page, reload, navigate, validRoute]);
  function toggleTheme(value = !dark) { setDark(value); document.documentElement.classList.toggle("dark", value); try { const existing = JSON.parse(localStorage.getItem("techkasir.appearance") || "{}"); localStorage.setItem("techkasir.appearance", JSON.stringify({ ...existing, mode: value ? "dark" : "light" })); } catch {} }
  useEffect(() => { const handler = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && me) { e.preventDefault(); setSearchOpen(true); } }; window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler); }, [me]);
  useEffect(() => { if (!searchOpen) return; let active = true; const timer = setTimeout(async () => { if (!query.trim()) { setResults(null); setSearching(false); return; } setSearching(true); setSearchError(""); try { const response = await api("/search", { query, offset: 0 }); if (active) setResults(response); } catch (err) { if (active) setSearchError(err instanceof Error ? err.message : "Pencarian gagal."); } finally { if (active) setSearching(false); } }, 250); return () => { active = false; clearTimeout(timer); }; }, [query, searchOpen]);
  if (!validRoute) return children;
  if (booting) return <main className="grid min-h-dvh place-content-center p-6"><Card className="w-80"><Skeleton className="h-8 w-40" /><Skeleton className="h-11" /><Skeleton className="h-11" /><p className="caption-2">Menyiapkan workspace…</p></Card></main>;
  if (!me) {
    const spec: FormSpec = { title: setup ? "Siapkan toko" : "Masuk ke toko", fields: [...(setup ? [text("storeName", "Nama toko"), text("name", "Nama pemilik"), date("openingDate", "Tanggal saldo awal", today()), numeric("openingAmount", "Saldo kas awal")] : []), text("username", "Username"), { ...text("password", "Kata sandi"), type: "password" }], submit: setup ? "Buat toko" : "Masuk ke workspace", save: async values => { if (setup) { await api("/setup", values); setSetup(false); } else { await api("/login", values); const user = await api("/me"); setLoadedPage(null); setData({}); setError(""); setMe(user); navigate(user.role === "owner" ? "dashboard" : user.role === "service" ? "orders" : "sales"); } } };
    return <main className="relative grid min-h-dvh place-items-center overflow-hidden p-6"><div aria-hidden="true" className="pointer-events-none absolute -left-24 top-0 size-96 rounded-full bg-primary/10 blur-3xl" /><div aria-hidden="true" className="pointer-events-none absolute -right-24 bottom-0 size-96 rounded-full bg-primary/10 blur-3xl" /><div className="z-10 grid w-full max-w-md items-center lg:max-w-5xl gap-12 lg:grid-cols-2"><div className="hidden space-y-6 lg:block"><p className="text-xl font-semibold">Tech<span className="text-primary">Kasir</span></p><p className="caption-2 uppercase tracking-widest">Workspace toko Anda</p><h1 className="text-5xl font-semibold tracking-tight">Semua urusan toko.<br /><span className="text-primary">Satu tempat.</span></h1><p className="max-w-sm text-base text-muted-foreground">Dari penjualan pertama hingga laporan terakhir. Kelola stok, servis, dan pelanggan dengan lebih teratur.</p><div className="flex gap-3"><span className="rounded-lg border bg-card p-3 text-sm">Kasir</span><span className="rounded-lg border bg-card p-3 text-sm">Inventaris</span><span className="rounded-lg border bg-card p-3 text-sm">Servis</span></div></div><Card className="gap-6 p-8"><div className="flex items-center justify-between"><p className="title-4">Tech<span className="text-primary">Kasir</span></p><Button variant="ghost" size="icon" aria-label="Ganti tema" onClick={() => toggleTheme()}>{dark ? <SunIcon /> : <MoonIcon />}</Button></div><div className="space-y-2"><CardTitle>{spec.title}</CardTitle><CardDescription>{setup ? "Buat akun pemilik untuk memulai." : "Selamat datang kembali. Masuk dengan akun Anda."}</CardDescription></div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<RecordForm singleColumn key={String(setup)} spec={spec} onDone={() => {}} /><p className="caption-2">Data tersimpan di database toko Anda.</p></Card></div></main>;
  }
  const context: WorkspaceContext = { me, data, page, focus, reload, navigate, form: spec => setDialog({ title: spec.title, spec }), detail: (title, content) => setDialog({ title, content }), act: () => {} };
  context.act = createActions(context);
  const nav = navigation.filter(item => (item[3] as readonly string[]).includes(me.role));
  return <div className="workspace-shell relative h-dvh overflow-hidden"><a href="#main-content" className="sr-only z-50 rounded-md bg-popover p-3 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Lewati ke konten</a><div aria-hidden="true" className="pointer-events-none fixed left-0 top-0 -z-10 size-96 rounded-full bg-primary/10 blur-3xl" />
    {mobile && <button aria-label="Tutup navigasi" className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden" onClick={() => setMobile(false)} />}
    <aside data-workspace-sidebar className={cn("glass fixed inset-y-4 left-4 z-40 flex w-64 flex-col rounded-2xl p-4 transition-transform duration-200 lg:translate-x-0", collapsed && "lg:w-20", mobile ? "translate-x-0" : "invisible -translate-x-[120%] lg:visible")}><div className={cn("flex h-16 items-center justify-between px-2", collapsed && "lg:justify-center")}><Link href="/" className={cn("text-xl font-semibold tracking-tight", collapsed && "lg:hidden")}>Tech<span className="text-primary">Kasir</span></Link><Button variant="ghost" size="icon" aria-label="Buka atau tutup sidebar" onClick={() => { setCollapsed(!collapsed); setMobile(false); try { localStorage.setItem("techkasir.sidebarCollapsed", String(!collapsed)); } catch {} }}><ListIcon /></Button></div><p className={cn("caption-2 truncate px-3 pb-6", collapsed && "lg:hidden")}>{me.store}</p><nav aria-label="Navigasi utama" className="flex-1 space-y-1 overflow-y-auto">{nav.map(([id, label, Icon]) => <Link key={id} href={`/${id}`} onClick={() => setMobile(false)} title={label} aria-current={parent(page) === id ? "page" : undefined} className={cn("flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground", parent(page) === id && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground", collapsed && "lg:justify-center")}><Icon className="size-5 shrink-0" /><span className={cn(collapsed && "lg:hidden")}>{label}</span></Link>)}</nav><div className={cn("mt-4 rounded-lg bg-accent/50 p-3", collapsed && "lg:hidden")}><p className="title-4">Workspace toko</p><p className="caption-2 mt-1">{roleName(me.role)} · {me.store}</p></div></aside>
    <div className={cn("workspace-frame flex h-dvh min-w-0 flex-col overflow-hidden p-4 lg:pl-72", collapsed && "lg:pl-28")}><header data-workspace-header className="glass z-20 flex h-16 shrink-0 items-center justify-between gap-3 rounded-xl px-4"><div className="flex min-w-0 items-center gap-3"><Button className="lg:hidden" variant="ghost" size="icon" aria-label="Buka navigasi" onClick={() => setMobile(true)}><ListIcon /></Button><span className="caption-2 hidden sm:inline">Workspace <span className="px-2">/</span></span><span className="title-4 truncate">{nav.find(([id]) => id === parent(page))?.[1]}</span></div><div className="flex items-center gap-2"><Button variant="outline" aria-label="Cari data" onClick={() => setSearchOpen(true)}><MagnifyingGlassIcon /><span className="hidden sm:inline">Cari data</span><kbd className="caption-2 ml-4 hidden md:inline">Ctrl K</kbd></Button><Button variant="ghost" size="icon" aria-label="Ganti tema" onClick={() => toggleTheme()}>{dark ? <SunIcon /> : <MoonIcon />}</Button><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost"><span className="grid size-8 place-content-center rounded-full bg-primary/10 text-primary">{Array.from(me.name)[0]}</span><span className="hidden text-left sm:block"><span className="block text-xs font-medium">{me.name}</span><span className="caption-2">{roleName(me.role)}</span></span><CaretDownIcon /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => navigate("settings")}><SlidersHorizontalIcon />Pengaturan</DropdownMenuItem><DropdownMenuItem onSelect={async () => { try { await api("/logout", {}); generation.current++; try { sessionStorage.removeItem(`techkasir.pos.${me.id}`); } catch {} setMe(null); setData({}); setLoadedPage(null); router.push("/"); } catch (err) { setError(String(err)); } }}><SignOutIcon />Keluar</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></header>
      <div ref={scrollArea} className="workspace-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain"><main ref={contentArea} id="main-content" tabIndex={-1} aria-busy={loading || loadedPage !== page} className="mx-auto grid max-w-[1600px] min-w-0 gap-6 py-8 lg:px-4">{["reports", "finance", "payments", "settings", "staff", "audit"].includes(page) && me.role === "owner" && <nav className="flex flex-wrap gap-2" aria-label="Submenu">{(parent(page) === "reports" ? [["reports", "Report"], ["finance", "Pencatatan keuangan"], ["payments", "Pembayaran"]] : [["settings", "Toko & tampilan"], ["staff", "Staf dan akses"], ["audit", "Audit"]]).map(([id, label]) => <Button key={id} variant={page === id ? "secondary" : "ghost"} asChild><Link href={`/${id}`}>{label}</Link></Button>)}</nav>}
        {loadedPage === page && error ? <Card><CardTitle>Data belum dapat dimuat</CardTitle><p role="alert" className="text-sm text-destructive">{error}</p><Button onClick={() => void reload()}>Coba lagi</Button></Card> : loadedPage !== page ? <div aria-busy="true" aria-label="Memuat data" className="grid gap-6"><Skeleton className="h-12 w-64" /><div className="grid gap-4 sm:grid-cols-3">{[1, 2, 3].map(n => <Skeleton key={n} className="h-32" />)}</div><Skeleton className="h-80" /></div> : <Screens key={`${page}:${focus || ""}`} context={context} dark={dark} toggleTheme={toggleTheme} />}
      {children}</main><footer className="caption-2 px-4 pb-4">TechKasir {APP_RELEASE} · Workspace toko · WIB</footer></div></div>
    <Dialog open={!!dialog} onOpenChange={open => { if (!open && !busy) setDialog(null); }}><DialogContent onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onInteractOutside={e => { if (busy) e.preventDefault(); }}><DialogHeader><DialogTitle>{dialog?.title}</DialogTitle><DialogDescription>{dialog?.spec?.description || "Detail dan tindakan sesuai akses akun Anda."}</DialogDescription></DialogHeader>{dialog?.spec ? <RecordForm key={dialog.title} spec={dialog.spec} onBusy={setBusy} onDone={() => { setDialog(null); void reload(); }} /> : dialog?.content}</DialogContent></Dialog>
    <Dialog open={searchOpen} onOpenChange={setSearchOpen}><DialogContent><DialogHeader><DialogTitle>Cari data toko</DialogTitle><DialogDescription>Cari transaksi, pelanggan, unit, dan catatan sesuai akses Anda.</DialogDescription></DialogHeader><Input autoFocus type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Nama, kode transaksi, atau model…" aria-label="Pencarian database" />{searchError && <p role="alert" className="text-sm text-destructive">{searchError}</p>}{searching ? <Skeleton className="h-24" /> : <div className="grid gap-2">{results?.results?.map((record: any) => <button type="button" key={`${record.scope}-${record.id}`} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-left hover:bg-accent" onClick={() => { setSearchOpen(false); navigate(record.page === "services" || record.page === "sales" ? "orders" : record.page, record.id); }}><span className="min-w-0"><span className="caption-2">{record.label}</span><strong className="block break-words text-sm">{record.title}</strong><span className="caption-2 break-words">{record.summary}</span></span><ArrowRightIcon className="size-4 shrink-0" /></button>)}{results?.total === 0 && <p className="body-6 py-6 text-center text-muted-foreground">Tidak ada hasil. Coba kata lain.</p>}{results?.hasMore && <Button variant="outline" onClick={async () => { try { const more = await api("/search", { query, offset: results.results.length }); setResults({ ...more, results: [...results.results, ...more.results] }); } catch (err) { setSearchError(String(err)); } }}>Muat hasil berikutnya</Button>}</div>}</DialogContent></Dialog>
  </div>;
}
