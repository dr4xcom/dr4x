// src/app/layout.tsx
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "DR4X",
  description: "Healthcare Social Platform",
  manifest: "/manifest.json",
  themeColor: "#10b981",
  icons: {
    apple: "/icons/icon-192.png",
  },
};

// ✅ مهم جداً للجوال: يضبط مقاس الصفحة والتكبير
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

type Locale = "ar" | "en" | "tr";
const COOKIE_NAME = "dr4x_locale";

function normalizeLocale(v?: string): Locale {
  if (v === "ar" || v === "en" || v === "tr") return v;
  return "ar";
}

function localeToDir(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

/* ✅ مهم: layout أصبح async */
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(COOKIE_NAME)?.value);
  const dir = localeToDir(locale);

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      {/* ✅ استبدلنا min-h-dvh بـ min-h-screen لأجل الجوال */}
      <body className="min-h-screen bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
