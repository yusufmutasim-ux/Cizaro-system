import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { IconSprite } from "@/components/Icons";
import { currentUser } from "@/lib/auth";
import { LOCALE_COOKIE, dirOf, isLocale, type Locale } from "@/lib/i18n";
import { I18nProvider } from "@/components/I18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cizaro Studio",
  description: "Design task management for Cizaro and the graphic team",
  applicationName: "Cizaro Studio",
  appleWebApp: { capable: true, title: "Cizaro", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width", initialScale: 1, viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#eef0fa" }, { media: "(prefers-color-scheme: dark)", color: "#0b0e2a" }],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale: Locale = user?.locale ?? (isLocale(c) ? c : "ar");
  return (
    <html lang={locale} dir={dirOf(locale)} data-brand="cizaro">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=Unbounded:wght@500;700&display=swap" />
      </head>
      <body>
        <div className="ambient" aria-hidden="true"><i /><i /><i /></div>
        <IconSprite />
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
