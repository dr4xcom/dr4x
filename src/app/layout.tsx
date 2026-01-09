// src/app/layout.tsx
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "DR4X",
  description: "Healthcare Social Platform",
  manifest: "/manifest.json",
  icons: {
    apple: "/icons/icon-192.png",
  },
};

// ✅ Next.js 16: themeColor لازم يكون هنا بدل metadata
export const viewport: Viewport = {
  themeColor: "#10b981",
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
      <body className="min-h-dvh bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
