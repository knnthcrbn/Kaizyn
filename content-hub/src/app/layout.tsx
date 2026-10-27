import type { Metadata, Viewport } from "next";
import {
  Anton,
  Archivo_Black,
  Bangers,
  Bebas_Neue,
  Geist,
  Geist_Mono,
  Instrument_Serif,
  Luckiest_Guy,
  Montserrat,
  Oswald,
  Permanent_Marker,
  Poppins,
  Unbounded,
} from "next/font/google";
import { AppShell } from "@/components/shell/AppShell";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Studio's burned-in captions: LeadLab's caption face (Montserrat ExtraBold).
// Loaded only when a caption is drawn, so other pages don't pay for it.
const captionFont = Montserrat({
  variable: "--font-caption",
  subsets: ["latin"],
  weight: ["800"],
  preload: false,
});

// The rest of Studio's caption and hook-text fonts (lib/studio/fonts.ts).
// None preloads: a font is fetched the first time something is drawn in it.
const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["800"], preload: false });
const archivo = Archivo_Black({ variable: "--font-archivo", subsets: ["latin"], weight: ["400"], preload: false });
const unbounded = Unbounded({ variable: "--font-unbounded", subsets: ["latin"], weight: ["900"], preload: false });
const anton = Anton({ variable: "--font-anton", subsets: ["latin"], weight: ["400"], preload: false });
const bebas = Bebas_Neue({ variable: "--font-bebas", subsets: ["latin"], weight: ["400"], preload: false });
const oswald = Oswald({ variable: "--font-oswald", subsets: ["latin"], weight: ["700"], preload: false });
const luckiest = Luckiest_Guy({ variable: "--font-luckiest", subsets: ["latin"], weight: ["400"], preload: false });
const bangers = Bangers({ variable: "--font-bangers", subsets: ["latin"], weight: ["400"], preload: false });
const marker = Permanent_Marker({ variable: "--font-marker", subsets: ["latin"], weight: ["400"], preload: false });
const serif = Instrument_Serif({ variable: "--font-serif", subsets: ["latin"], weight: ["400"], preload: false });
const studioFonts = [poppins, archivo, unbounded, anton, bebas, oswald, luckiest, bangers, marker, serif];

export const metadata: Metadata = {
  title: "Content Hub",
  description: "Idea to posted, in one place. Built to make creating a daily habit.",
  // Added to an iPhone home screen, it opens full screen like an app.
  appleWebApp: { capable: true, title: "Content Hub", statusBarStyle: "black" },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0c",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${captionFont.variable} ${studioFonts.map((f) => f.variable).join(" ")} h-full antialiased`}>
      <body className="h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
