import type { Metadata, Viewport } from "next";
import { IconSprite } from "@/components/Icons";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cizaro Studio",
  description: "إدارة تاسكات التصميم بين الإدارة وفريق الجرافيك",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" />
      </head>
      <body>
        <IconSprite />
        {children}
      </body>
    </html>
  );
}
