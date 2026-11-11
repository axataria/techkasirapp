import { notFound } from "next/navigation";
const pages = ["dashboard", "sales", "orders", "services", "customers", "warranties", "customer-returns", "units", "receiving", "qc", "supplier-returns", "reports", "payments", "finance", "settings", "staff", "audit"];
export function generateStaticParams() { return pages.map(page => ({ page })); }
export default async function Page({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  if (!pages.includes(page)) notFound();
  return null;
}
