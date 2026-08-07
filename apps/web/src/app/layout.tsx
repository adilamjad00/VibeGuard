import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VibeGuard — Ship Readiness for AI-generated apps",
  description:
    "Paste a public GitHub repo URL and get a Ship Readiness Score with ranked, explained, fixable security findings.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
