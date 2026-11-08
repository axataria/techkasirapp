import { notFound } from "next/navigation";
export default async function Page({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  if (!["dashboard", "sales", "orders", "services", "customers", "warranties", "customer-returns", "units", "receiving", "qc", "supplier-returns", "reports", "payments", "finance", "settings", "staff", "audit"].includes(page)) notFound();
  return null;
}
