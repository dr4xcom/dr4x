"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Locale = "ar" | "en" | "tr";

const COOKIE_NAME = "dr4x_locale";
const ONE_YEAR = 60 * 60 * 24 * 365;

const LANGS: {
  locale: Locale;
  label: string;
  flag: string;
  dir: "rtl" | "ltr";
}[] = [
  { locale: "ar", label: "العربية", flag: "🇸🇦", dir: "rtl" },
  { locale: "en", label: "English", flag: "🇺🇸", dir: "ltr" },
  { locale: "tr", label: "Türkçe", flag: "🇹🇷", dir: "ltr" },
];

function getCookie(name: string) {
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(
    value
  )}; Max-Age=${ONE_YEAR}; Path=/; SameSite=Lax`;
}

function applyHtml(locale: Locale, dir: "rtl" | "ltr") {
  document.documentElement.setAttribute("lang", locale);
  document.documentElement.setAttribute("dir", dir);
}

export default function LanguageDropdown() {
  const router = useRouter();
  const ref = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [locale, setLocale] = useState<Locale>("ar");

  const current = LANGS.find((l) => l.locale === locale) ?? LANGS[0];

  useEffect(() => {
    const saved = (getCookie(COOKIE_NAME) as Locale | null) ?? "ar";
    const lang = LANGS.find((l) => l.locale === saved) ?? LANGS[0];
    setLocale(lang.locale);
    applyHtml(lang.locale, lang.dir);
  }, []);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function choose(lang: (typeof LANGS)[number]) {
    setLocale(lang.locale);
    setCookie(COOKIE_NAME, lang.locale);
    applyHtml(lang.locale, lang.dir);
    setOpen(false);

    // مهم: يعيد قراءة cookies() في layout على السيرفر
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium hover:bg-slate-200 transition"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="text-base leading-none">{current.flag}</span>
        <span>{current.label}</span>
        <span className="text-xs opacity-70">▼</span>
      </button>

      {open && (
        <div className="absolute end-0 mt-2 w-44 rounded-xl border bg-white shadow-lg overflow-hidden z-50">
          {LANGS.map((l) => {
            const active = l.locale === locale;
            return (
              <button
                key={l.locale}
                type="button"
                onClick={() => choose(l)}
                className={`w-full px-3 py-2 text-sm flex items-center gap-2 text-start hover:bg-slate-50 ${
                  active ? "bg-slate-50" : ""
                }`}
                role="menuitem"
              >
                <span className="text-base leading-none">{l.flag}</span>
                <span className="flex-1">{l.label}</span>
                {active && <span className="text-xs text-slate-500">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
