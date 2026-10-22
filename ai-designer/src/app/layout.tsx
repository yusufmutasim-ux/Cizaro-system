import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Studio AI — مصمم الإعلانات", description: "مصمم جرافيك بالذكاء الاصطناعي بيلتزم بهوية كل براند", icons: { icon: "/icon.svg" } };
export const viewport: Viewport = { themeColor: "#0b0b10", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
