import type { Metadata, Viewport } from "next";
import { Archivo, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { StatusStrip } from "@/components/StatusStrip";

// Self-hosted at build time by next/font — no runtime request to Google, and
// no layout shift from a late-arriving webfont.
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-jb",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VibeGuard — Ship Readiness for AI-generated apps",
  description:
    "Paste a public GitHub repo URL and get a Ship Readiness Score with ranked, explained, fixable security findings.",
};

export const viewport: Viewport = {
  themeColor: "#08080d",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${inter.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen">
        <a href="#main" className="sr-only-focusable">
          Skip to content
        </a>
        <StatusStrip />
        <SiteHeader />
        <div id="main">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
