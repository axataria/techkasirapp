import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { Workspace } from "@/components/workspace";
import "./globals.css";
export const metadata: Metadata = { title: "TechKasir V3 · Workspace toko", description: "Kasir, inventaris, servis, dan laporan toko dalam satu workspace.", robots: { index: false, follow: false } };
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7f6" },
    { media: "(prefers-color-scheme: dark)", color: "#181818" },
  ],
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id" className={GeistSans.variable} suppressHydrationWarning><body><Workspace>{children}</Workspace></body></html>;
}
