export type Row = Record<string, any>;
export type User = { id: string; name: string; role: "owner" | "cashier" | "service"; store: string };
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); this.name = "ApiError"; }
}
export async function api(path: string, body?: unknown, method = body === undefined ? "GET" : "POST") {
  const response = await fetch(`/api${path}`, { method, credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const result = await response.json().catch(() => { throw new ApiError("Server belum dapat memproses permintaan. Silakan coba lagi.", response.status); });
  if (!response.ok) throw new ApiError(result.error || "Permintaan gagal. Silakan coba lagi.", response.status);
  return result;
}
export const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export function money(value: string | number | bigint | null | undefined = 0) { return `Rp ${new Intl.NumberFormat("id-ID").format(BigInt(value || 0))}`; }
export function difference(a: string | number = 0, b: string | number = 0) { return (BigInt(a) - BigInt(b)).toString(); }
export function amount(value: string) { const number = Number(value || 0); if (!Number.isSafeInteger(number) || number < 0) throw new Error("Masukkan nominal rupiah bulat dalam batas yang didukung."); return number; }
export const roleName = (role: string) => ({ owner: "Pemilik", cashier: "Kasir", service: "Staf servis" }[role] || role);
