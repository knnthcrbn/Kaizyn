import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Montserrat } from "next/font/google";
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
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${captionFont.variable} h-full antialiased`}>
      <body className="h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
