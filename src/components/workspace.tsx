"use client";
import { avatarInitial } from "../../shared/domain.mjs";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SquaresFourIcon, ShoppingCartIcon, ListBulletsIcon, UsersIcon, ShieldCheckIcon, ArrowUUpLeftIcon, PackageIcon, TrayArrowDownIcon, CheckSquareIcon, ArrowUUpRightIcon, ChartBarIcon, SlidersHorizontalIcon, MagnifyingGlassIcon, ListIcon, SignOutIcon, MoonIcon, SunIcon, XIcon, CaretDownIcon, ArrowRightIcon } from "@phosphor-icons/react";
import { RecoveryCodeNotice, type RecoveryKit } from "@/components/account-recovery";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DashboardLoading } from "@/components/dashboard-loading";
import { parseCssTime } from "@/lib/css-time";
import { comparisonPeriods } from "@/lib/metric-trend";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { RecordForm, type FormSpec, text, date, currency } from "@/components/record-form";
import { api, ApiError, today, roleName, type Row, type User } from "@/lib/api";
import { cn } from "@/lib/utils";
import { APP_RELEASE } from "@/lib/version";
import { applyPalette, syncBrowserTheme } from "@/lib/appearance";
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
  const [dialog, setDialog] = useState<{ title: string; content?: ReactNode; spec?: FormSpec; motion?: "dashboard-detail" } | null>(null), [busy, setBusy] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false), [query, setQuery] = useState(""), [results, setResults] = useState<any>(null), [searchError, setSearchError] = useState(""), [searching, setSearching] = useState(false);
  const generation = useRef(0);
  const [recoveryKit, setRecoveryKit] = useState<RecoveryKit | null>(null);
  const [registering, setRegistering] = useState(false);
  const [storeDetails, setStoreDetails] = useState<Row | null>(null);
  const [registered, setRegistered] = useState(false);
  useEffect(() => {
    const expired = () => { generation.current++; setMe(null); setData({}); setDialog(null); setLoadedPage(null); };
    window.addEventListener("techkasir:session-expired", expired);
    return () => window.removeEventListener("techkasir:session-expired", expired);
  }, []);
  const [loadedPage, setLoadedPage] = useState<string | null>(null);
  const scrollArea = useRef<HTMLDivElement>(null), contentArea = useRef<HTMLElement>(null);
  const pointerNavigation = useRef(false);
  const pageAnimation = useRef<Animation | null>(null);
  const presentedPath = useRef<string | null>(null);
  const detailTrigger = useRef<HTMLElement | null>(null);
  const cancelPageAnimation = useCallback(() => {
    pageAnimation.current?.cancel();
    pageAnimation.current = null;
  }, []);
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
    const pointer = () => { cancelPageAnimation(); pointerNavigation.current = true; };
    const keyboard = () => { cancelPageAnimation(); pointerNavigation.current = false; };
    window.addEventListener("pointerdown", pointer, true);
    window.addEventListener("keydown", keyboard, true);
    return () => { window.removeEventListener("pointerdown", pointer, true); window.removeEventListener("keydown", keyboard, true); };
  }, [cancelPageAnimation]);
  useLayoutEffect(() => {
    cancelPageAnimation();
    if (!me || loadedPage !== page) { presentedPath.current = null; return; }
    if (presentedPath.current === pathname) return;
    presentedPath.current = pathname;
    if (!pointerNavigation.current || !contentArea.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const style = getComputedStyle(contentArea.current);
    pageAnimation.current = contentArea.current.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: parseCssTime(style.getPropertyValue("--section-fade-duration")),
      easing: style.getPropertyValue("--ease-ui").trim() || "cubic-bezier(.22,1,.36,1)",
    });
    return cancelPageAnimation;
  }, [me, page, pathname, loadedPage, cancelPageAnimation]);
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
    if (page === "dashboard") {
      add("dashboard"); add("units"); add("payments"); add("services");
      const periods = comparisonPeriods(today());
      add("trendCurrent", `/v2/summary?${new URLSearchParams(periods.current)}`);
      add("trendPrevious", `/v2/summary?${new URLSearchParams(periods.previous)}`);
    }
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
    if (page === "settings") add("recovery", "/recovery/email");
    if (page === "settings" && me.role === "owner") { add("opening"); add("policy", "/v2/policy"); }
    if (page === "staff") add("users"); if (page === "audit") add("audit");
    try { const entries = await Promise.all([...reads].map(async ([key, path]) => [key, await api(path)])); if (version === generation.current) { setData(Object.fromEntries(entries)); setLoadedPage(page); } }
    catch (err) { if (version === generation.current) { if (err instanceof ApiError && err.status === 401) { setMe(null); setDialog(null); setData({}); setLoadedPage(null); setError("Sesi berakhir. Silakan masuk kembali."); } else { setError(err instanceof Error ? err.message : "Data gagal dimuat."); setLoadedPage(page); } } }
    finally { if (version === generation.current) setLoading(false); }
  }, [me, page]);
  useEffect(() => { if (me && validRoute) { const permitted = navigation.find(([id]) => id === parent(page)); if (!permitted || !(permitted[3] as readonly string[]).includes(me.role) || (["finance", "payments", "staff", "audit"].includes(page) && me.role !== "owner")) { navigate(me.role === "owner" ? "dashboard" : me.role === "service" ? "orders" : "sales"); return; } void reload(); } return () => { generation.current++; }; }, [me, page, reload, navigate, validRoute]);
  function toggleTheme(value = !dark) { setDark(value); document.documentElement.classList.toggle("dark", value); syncBrowserTheme(); try { const existing = JSON.parse(localStorage.getItem("techkasir.appearance") || "{}"); localStorage.setItem("techkasir.appearance", JSON.stringify({ ...existing, mode: value ? "dark" : "light" })); } catch {} }
  useEffect(() => { syncBrowserTheme(); }, [dark, pathname]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) setMobile(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  useEffect(() => { const handler = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && me) { e.preventDefault(); setSearchOpen(true); } }; window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler); }, [me]);
  useEffect(() => { if (!searchOpen) return; let active = true; const timer = setTimeout(async () => { if (!query.trim()) { setResults(null); setSearching(false); return; } setSearching(true); setSearchError(""); try { const response = await api("/search", { query, offset: 0 }); if (active) setResults(response); } catch (err) { if (active) setSearchError(err instanceof Error ? err.message : "Pencarian gagal."); } finally { if (active) setSearching(false); } }, 250); return () => { active = false; clearTimeout(timer); }; }, [query, searchOpen]);
  if (!validRoute) return children;
  if (booting) return <main className="grid min-h-dvh place-content-center p-6"><Card className="w-80"><Skeleton className="h-8 w-40" /><Skeleton className="h-11" /><Skeleton className="h-11" /><p className="caption-2">Menyiapkan workspace…</p></Card></main>;
  if (!me) {
    const creatingStore = setup || registering;
    const spec: FormSpec = {
      title: creatingStore ? "Buat toko baru" : "Masuk ke toko",
      fields: [
        ...[
          ...(creatingStore ? [text("storeName", "Nama toko"), text("name", "Nama pemilik")] : []),
          text("username", "Username"),
          { ...text("password", "Kata sandi"), type: "password" },
        ].map(field => ({ ...field, visibleWhen: () => !storeDetails })),
        ...(creatingStore ? [date("openingDate", "Tanggal saldo awal", today()), currency("openingAmount", "Saldo kas awal")]
          .map(field => ({ ...field, visibleWhen: () => !!storeDetails })) : []),
      ],
      submit: creatingStore ? (storeDetails ? "Buat toko" : "Lanjut ke saldo awal") : "Masuk",
      save: async values => {
        if (creatingStore) {
          if (!storeDetails) { setStoreDetails(values); return; }
          const result = await api(setup ? "/setup" : "/register", { ...storeDetails, ...values });
          setRecoveryKit({ ...result, store: String(storeDetails.storeName).trim() });
          setStoreDetails(null);
          setSetup(false);
          setRegistering(false);
          setRegistered(true);
          return;
        }
        await api("/login", values);
        const user = await api("/me");
        setRegistered(false);
        setLoadedPage(null);
        setData({});
        setError("");
        setMe(user);
        const documentQuery = new URLSearchParams(window.location.search).get("document");
        if (documentQuery) { router.push(`/document?${documentQuery}`); return; }
        navigate(user.role === "owner" ? "dashboard" : user.role === "service" ? "orders" : "sales");
      },
    };
    return (
      <main className="grid min-h-dvh items-center px-4 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto grid w-full max-w-lg gap-8 lg:max-w-5xl lg:grid-cols-2">
          <div className="hidden flex-col justify-between gap-12 glass rounded-2xl p-12 lg:flex">
            <p className="title-1">Tech<span className="text-primary">Kasir</span></p>
            <div className="space-y-4">
              <h2 className="heading-2 text-balance">Kelola toko dalam satu tempat.</h2>
              <p className="body-3 max-w-sm text-pretty text-muted-foreground">
                Catat penjualan, pantau stok, dan ikuti progres servis pelanggan.
              </p>
            </div>
            <div className="caption-2 flex flex-wrap gap-x-6 gap-y-2 text-muted-foreground">
              <span className="flex items-center gap-2"><ShoppingCartIcon aria-hidden="true" /> Kasir</span>
              <span className="flex items-center gap-2"><PackageIcon aria-hidden="true" /> Stok</span>
              <span className="flex items-center gap-2"><ListBulletsIcon aria-hidden="true" /> Servis</span>
            </div>
          </div>
          <Card className="gap-6 rounded-2xl p-6 sm:p-8">
            <div className="flex items-center justify-between">
              <p className="title-1">Tech<span className="text-primary">Kasir</span></p>
              <Button variant="ghost" size="icon" aria-label="Ganti tema" onClick={() => toggleTheme()}>
                {dark ? <SunIcon /> : <MoonIcon />}
              </Button>
            </div>
            {recoveryKit ? (
              <RecoveryCodeNotice kit={recoveryKit} title="Toko berhasil dibuat" onDone={() => setRecoveryKit(null)} />
            ) : (
              <>
                <div className="space-y-2">
                  {creatingStore && <p className="caption-1 text-primary" role="status">
                    {storeDetails ? "Langkah 2 dari 2 · Saldo awal" : "Langkah 1 dari 2 · Akun pemilik"}
                  </p>}
                  <h1 className="heading-4 text-balance">{storeDetails ? "Atur saldo kas awal" : spec.title}</h1>
                  <CardDescription className="text-pretty">
                    {storeDetails ? "Masukkan jumlah uang yang tersedia pada tanggal saldo awal."
                      : creatingStore ? "Isi informasi toko dan buat akun pemilik."
                      : "Masuk dengan username dan kata sandi Anda."}
                  </CardDescription>
                </div>
                {error && <p role="alert" className="body-6 text-destructive">{error}</p>}
                {registered && !creatingStore && <p role="status" className="body-6 text-primary">Toko berhasil dibuat. Masuk dengan akun baru Anda.</p>}
                <div className="[&_button[type=submit]]:w-full">
                  <RecordForm singleColumn={!creatingStore} key={spec.title} spec={spec} onBusy={setBusy} onDone={() => {}} />
                </div>
                {storeDetails ? (
                  <Button variant="ghost" disabled={busy} onClick={() => setStoreDetails(null)}>Kembali ke akun pemilik</Button>
                ) : registering ? (
                  <Button variant="ghost" disabled={busy} onClick={() => setRegistering(false)}>Kembali ke login</Button>
                ) : !setup && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button variant="ghost" asChild><Link href="/lupa-kata-sandi">Lupa kata sandi?</Link></Button>
                    <Button variant="outline" disabled={busy} onClick={() => { setRegistered(false); setRegistering(true); }}>Buat toko baru</Button>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      </main>
    );
  }
  const context: WorkspaceContext = { me, updateUser: setMe, data, page, focus, reload, navigate, form: spec => setDialog({ title: spec.title, spec }), detail: (title, content) => {
    if (!dialog && page === "dashboard" && document.activeElement instanceof HTMLElement) detailTrigger.current = document.activeElement;
    const motion = page === "dashboard" && pointerNavigation.current ? "dashboard-detail" : undefined;
    setDialog(current => ({ title, content, motion: current ? current.motion : motion }));
  }, act: () => {} };
  context.act = createActions(context);
  const nav = navigation.filter(item => (item[3] as readonly string[]).includes(me.role));

  function sidebarContent(compact: boolean, inDrawer = false) {
    return <>
      <div className={cn("flex min-h-16 shrink-0 items-center justify-between gap-2 px-2", compact && "lg:justify-center lg:px-0", inDrawer && "sticky top-0 z-10 bg-popover")}>
        <Link href="/" onClick={() => setMobile(false)} className={cn("min-w-0 flex-1 wrap-anywhere text-xl font-semibold tracking-tight", compact && "lg:hidden")}>Tech<span className="text-primary">Kasir</span></Link>
        {inDrawer
          ? <Button variant="ghost" size="icon" aria-label="Tutup sidebar" onClick={() => setMobile(false)}><XIcon /></Button>
          : <Button variant="ghost" size="icon" aria-controls="workspace-sidebar" aria-expanded={!collapsed} aria-label={collapsed ? "Perluas sidebar" : "Ringkas sidebar"} onClick={() => {
              setCollapsed(!collapsed);
              try { localStorage.setItem("techkasir.sidebarCollapsed", String(!collapsed)); } catch {}
            }}><ListIcon /></Button>}
      </div>
      <p className={cn("caption-2 shrink-0 truncate px-3 pb-6", compact && "lg:hidden")}>{me?.store}</p>
      <nav aria-label="Navigasi utama" className={cn("min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain", compact && "lg:[scrollbar-gutter:stable_both-edges]")}>
        {nav.map(([id, label, Icon]) => <Link key={id} href={`/${id}`} onClick={() => setMobile(false)} title={label} aria-current={parent(page) === id ? "page" : undefined}
          className={cn("flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground", parent(page) === id && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground", compact && "lg:justify-center lg:px-0")}>
          <Icon className="size-5 shrink-0" /><span className={cn("min-w-0 wrap-anywhere", compact && "lg:sr-only")}>{label}</span>
        </Link>)}
      </nav>
      <div className={cn("mt-4 shrink-0 rounded-lg bg-accent/50 p-3", compact && "lg:hidden")}>
        <p className="title-4">Workspace toko</p><p className="caption-2 mt-1 truncate" title={me?.store}>{roleName(me!.role)} · {me?.store}</p>
      </div>
    </>;
  }

  return <Dialog open={mobile} onOpenChange={setMobile}><div className="workspace-shell relative h-dvh overflow-hidden"><a href="#main-content" className="sr-only z-50 rounded-md bg-popover p-3 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Lewati ke konten</a><div aria-hidden="true" className="pointer-events-none fixed left-0 top-0 -z-10 size-96 rounded-full bg-primary/10 blur-3xl" />
    <aside id="workspace-sidebar" data-workspace-sidebar className={cn("glass desktop-sidebar fixed inset-y-4 left-4 z-40 hidden w-64 flex-col rounded-2xl p-4 lg:flex", collapsed && "lg:w-20 lg:px-2")}>
      {sidebarContent(collapsed)}
    </aside>
    <DialogContent id="workspace-mobile-sidebar" aria-modal="true" className="mobile-navigation translate-x-0 translate-y-0" showCloseButton={false}>
      <DialogTitle className="sr-only">Navigasi toko</DialogTitle>
      <DialogDescription className="sr-only">Pilih halaman untuk mengelola toko.</DialogDescription>
      {sidebarContent(false, true)}
    </DialogContent>
    <div className={cn("workspace-frame flex h-dvh min-w-0 flex-col overflow-hidden p-4 lg:pl-72", collapsed && "lg:pl-28")}><header data-workspace-header className="glass z-20 flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl px-2 py-2 sm:px-4">
      <div className="flex min-w-0 flex-1 basis-40 items-center gap-1 sm:gap-3">
        <DialogTrigger asChild><Button className="lg:hidden" variant="ghost" size="icon" aria-label="Buka navigasi" aria-controls="workspace-mobile-sidebar"><ListIcon /></Button></DialogTrigger>
        <span className="caption-2 hidden shrink-0 md:inline">Workspace <span className="px-2">/</span></span>
        <span className="title-4 min-w-0 truncate">{nav.find(([id]) => id === parent(page))?.[1]}</span>
      </div>
      <div className="flex max-w-full flex-wrap items-center gap-1 sm:gap-2">
        <Button className="max-sm:size-11 max-sm:px-0" variant="outline" aria-label="Cari data" onClick={() => setSearchOpen(true)}>
          <MagnifyingGlassIcon /><span className="hidden sm:inline">Cari data</span><kbd className="caption-2 ml-4 hidden md:inline">Ctrl K</kbd>
        </Button>
        <Button variant="ghost" size="icon" aria-label="Ganti tema" onClick={() => toggleTheme()}>{dark ? <SunIcon /> : <MoonIcon />}</Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="min-w-0 max-sm:size-11 max-sm:px-0" aria-label={me.name} variant="ghost">
              <span className="grid size-8 shrink-0 place-content-center rounded-full bg-primary/10 text-primary">{avatarInitial(me.name)}</span>
              <span className="hidden min-w-0 max-w-32 text-left sm:block">
                <span className="block truncate text-xs font-medium">{me.name}</span>
                <span className="caption-2">{roleName(me.role)}</span>
              </span>
              <CaretDownIcon className="hidden sm:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => navigate("settings")}><SlidersHorizontalIcon />Pengaturan</DropdownMenuItem>
            <DropdownMenuItem onSelect={async () => {
              try {
                await api("/logout", {});
                generation.current++;
                try { sessionStorage.removeItem(`techkasir.pos.${me.id}`); } catch {}
                setMe(null); setDialog(null); setData({}); setLoadedPage(null); router.push("/");
              } catch (err) { setError(String(err)); }
            }}><SignOutIcon />Keluar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
      <div ref={scrollArea} className="workspace-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain"><main ref={contentArea} id="main-content" tabIndex={-1} aria-busy={loading || loadedPage !== page} className={cn("mx-auto grid max-w-[1600px] min-w-0 gap-6 py-8 lg:px-4", page === "dashboard" && "@container grid-cols-1 dashboard-bento")}>{["reports", "finance", "payments", "settings", "staff", "audit"].includes(page) && me.role === "owner" && <nav className="flex flex-wrap gap-2" aria-label="Submenu">{(parent(page) === "reports" ? [["reports", "Report"], ["finance", "Pencatatan keuangan"], ["payments", "Pembayaran"]] : [["settings", "Toko & tampilan"], ["staff", "Staf dan akses"], ["audit", "Audit"]]).map(([id, label]) => <Button key={id} variant={page === id ? "secondary" : "ghost"} asChild><Link href={`/${id}`}>{label}</Link></Button>)}</nav>}
        {loadedPage === page && error ? <Card><CardTitle>Data belum dapat dimuat</CardTitle><p role="alert" className="text-sm text-destructive">{error}</p><Button onClick={() => void reload()}>Coba lagi</Button></Card> : loadedPage !== page ? page === "dashboard" ? <DashboardLoading /> : <div aria-busy="true" aria-label="Memuat data" className="grid gap-6"><Skeleton className="h-12 w-64 max-w-full" /><div className="grid gap-4 sm:grid-cols-3">{[1, 2, 3].map(n => <Skeleton key={n} className="h-32" />)}</div><Skeleton className="h-80" /></div> : <Screens key={`${page}:${focus || ""}`} context={context} dark={dark} toggleTheme={toggleTheme} />}
      {children}</main><footer className="caption-2 px-4 pb-4">TechKasir {APP_RELEASE} · Workspace toko · WIB</footer></div></div>
    <Dialog open={!!dialog} onOpenChange={open => { if (!open && !busy) setDialog(null); }}><DialogContent motion={dialog?.motion} onCloseAutoFocus={event => {
      const trigger = detailTrigger.current;
      detailTrigger.current = null;
      if (trigger?.isConnected) {
        event.preventDefault();
        trigger.focus({ preventScroll: true });
      }
    }} onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onInteractOutside={e => { if (busy) e.preventDefault(); }}><DialogHeader><DialogTitle>{dialog?.title}</DialogTitle><DialogDescription>{dialog?.spec?.description || "Detail dan tindakan sesuai akses akun Anda."}</DialogDescription></DialogHeader>{dialog?.spec ? <RecordForm key={dialog.title} spec={dialog.spec} onBusy={setBusy} onDone={() => { setDialog(null); void reload(); }} /> : dialog?.content}</DialogContent></Dialog>
    <Dialog open={searchOpen} onOpenChange={setSearchOpen}><DialogContent><DialogHeader><DialogTitle>Cari data toko</DialogTitle><DialogDescription>Cari transaksi, pelanggan, unit, dan catatan sesuai akses Anda.</DialogDescription></DialogHeader><Input autoFocus type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Nama, kode transaksi, atau model…" aria-label="Pencarian database" />{searchError && <p role="alert" className="text-sm text-destructive">{searchError}</p>}{searching ? <Skeleton className="h-24" /> : <div className="grid gap-2">{results?.results?.map((record: any) => <Button variant="outline" size="natural" key={`${record.scope}-${record.id}`} className="flex items-center justify-between gap-3 rounded-lg p-3 text-left whitespace-normal" onClick={() => { setSearchOpen(false); navigate(record.page === "services" || record.page === "sales" ? "orders" : record.page, record.id); }}><span className="min-w-0"><span className="caption-2">{record.label}</span><strong className="block break-words text-sm">{record.title}</strong><span className="caption-2 break-words">{record.summary}</span></span><ArrowRightIcon className="size-4 shrink-0" /></Button>)}{results?.total === 0 && <p className="body-6 py-6 text-center text-muted-foreground">Tidak ada hasil. Coba kata lain.</p>}{results?.hasMore && <Button variant="outline" onClick={async () => { try { const more = await api("/search", { query, offset: results.results.length }); setResults({ ...more, results: [...results.results, ...more.results] }); } catch (err) { setSearchError(String(err)); } }}>Muat hasil berikutnya</Button>}</div>}</DialogContent></Dialog>
  </div></Dialog>;
}
