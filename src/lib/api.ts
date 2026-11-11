export type Row = Record<string, any>;
export type User = { id: string; name: string; username: string; role: "owner" | "cashier" | "service"; store: string };
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); this.name = "ApiError"; }
}
const endpoint = process.env.NEXT_PUBLIC_TECHKASIR_API_URL || "";
const tokenKey = "techkasir.session";
function token() { try { return sessionStorage.getItem(tokenKey); } catch { return null; } }
function saveToken(value?: string) {
  try { value ? sessionStorage.setItem(tokenKey, value) : sessionStorage.removeItem(tokenKey); }
  catch { if (value) throw new ApiError("Izinkan penyimpanan sesi browser untuk masuk.", 400); }
}
export async function authenticatedFetch(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  const session = endpoint ? token() : null;
  if (session) headers.set("Authorization", `Bearer ${session}`);
  const response = await fetch(`${endpoint}${path}`, { ...options, headers, credentials: endpoint ? "omit" : "same-origin", cache: "no-store" });
  if (endpoint && response.status === 401) {
    saveToken();
    if (session) window.dispatchEvent(new Event("techkasir:session-expired"));
  }
  return response;
}
export async function api(path: string, body?: unknown, method = body === undefined ? "GET" : "POST") {
  const response = await authenticatedFetch(`/api${path}`, { method, headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const result = await response.json().catch(() => { throw new ApiError("Server belum dapat memproses permintaan. Silakan coba lagi.", response.status); });
  if (!response.ok) throw new ApiError(result.error || "Permintaan gagal. Silakan coba lagi.", response.status);
  if (endpoint && path === "/login" && result.sessionToken) saveToken(result.sessionToken);
  if (endpoint && path === "/logout") saveToken();
  return result;
}
export async function documentHtml(href: string, signal?: AbortSignal) {
  const response = await authenticatedFetch(href, { signal });
  if (!response.ok) throw new ApiError("Dokumen belum dapat dibuka. Periksa akses Anda dan coba lagi.", response.status);
  return response.text();
}
export const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export function money(value: string | number | bigint | null | undefined = 0) { return `Rp ${new Intl.NumberFormat("id-ID").format(BigInt(value || 0))}`; }
export function difference(a: string | number = 0, b: string | number = 0) { return (BigInt(a) - BigInt(b)).toString(); }
export function amount(value: string) { const number = Number(value || 0); if (!Number.isSafeInteger(number) || number < 0) throw new Error("Masukkan nominal rupiah bulat dalam batas yang didukung."); return number; }
export const roleName = (role: string) => ({ owner: "Pemilik", cashier: "Kasir", service: "Staf servis" }[role] || role);
