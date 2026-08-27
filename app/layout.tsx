import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Point marché Revêtements et Menuiserie",
  description: "Outil de point marché hebdomadaire : dossiers, simulations tarifaires Planner, Jira, statistiques et sauvegarde en ligne.",
  openGraph: {
    title: "Market Pulse — Point marché",
    description: "Dossiers, simulations tarifaires Planner, Jira, statistiques et points hebdomadaires.",
    images: ["https://example.test/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Market Pulse — Point marché",
    description: "Dossiers, opérations commerciales, Jira et points hebdomadaires.",
    images: ["https://example.test/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
