import type { Metadata } from "next";
import { Fraunces, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const instrument = Instrument_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "MarginPlate — Food Cost & Menu Margin",
  description:
    "MarginPlate shows which dishes quietly lose money after market rates for your ingredients move.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${fraunces.variable} ${instrument.variable} ${plexMono.variable} min-h-full flex flex-col bg-paper text-ink font-sans antialiased`}
      >
        <nav className="border-b border-line bg-paper/90 px-4 py-3 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <a href="/" className="font-display text-xl font-semibold tracking-tight text-ink">
              Margin<span className="text-corten">Plate</span>
            </a>
            <div className="hidden md:flex items-center gap-6 text-sm text-ink-muted">
              <a href="/dashboard" className="hover:text-corten transition-colors">
                Dashboard
              </a>
              <a href="/alerts" className="hover:text-corten transition-colors">
                Alerts
              </a>
              <a href="/recipes" className="hover:text-corten transition-colors">
                Recipes
              </a>
              <a href="/suppliers" className="hover:text-corten transition-colors">
                Suppliers
              </a>
              <a href="/invoices" className="hover:text-corten transition-colors">
                Invoices
              </a>
            </div>
          </div>
        </nav>
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
