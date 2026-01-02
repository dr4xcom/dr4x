"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Locale = "ar" | "en" | "tr";
type Dir = "rtl" | "ltr";

const COOKIE_NAME = "dr4x_locale";
const ONE_YEAR = 60 * 60 * 24 * 365;

const OPTIONS: { locale: Locale; label: string; dir: Dir }[] = [
  { locale: "en", label: "English", dir: "ltr" },
  { locale: "ar", label: "العربية", dir: "rtl" },
  { locale: "tr", label: "Türkçe", dir: "ltr" },
];

function getCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(
    value
  )}; Max-Age=${ONE_YEAR}; Path=/; SameSite=Lax`;
}

function applyHtml(locale: Locale, dir: Dir) {
  document.documentElement.setAttribute("lang", locale);
  document.documentElement.setAttribute("dir", dir);
}

export default function LanguageTabs({
  className = "",
}: {
  className?: string;
}) {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("ar");

  const active = useMemo(() => {
    return OPTIONS.find((o) => o.locale === locale) ?? OPTIONS[1];
  }, [locale]);

  useEffect(() => {
    const saved = (getCookie(COOKIE_NAME) as Locale | null) ?? "ar";
    if (saved === "ar" || saved === "en" || saved === "tr") {
      setLocale(saved);
      const opt = OPTIONS.find((o) => o.locale === saved) ?? OPTIONS[1];
      applyHtml(opt.locale, opt.dir);
    } else {
      applyHtml("ar", "rtl");
    }
  }, []);

  function pick(next: Locale) {
    const opt = OPTIONS.find((o) => o.locale === next) ?? OPTIONS[1];
    setLocale(opt.locale);
    setCookie(COOKIE_NAME, opt.locale);
    applyHtml(opt.locale, opt.dir);

    // يخلي Server Components/Layout يعيد قراءة Cookie
    router.refresh();
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {OPTIONS.map((o) => {
        const isActive = o.locale === active.locale;
        return (
          <button
            key={o.locale}
            type="button"
            onClick={() => pick(o.locale)}
            className={[
              "rounded-full px-3 py-1.5 text-sm border transition",
              isActive
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
            ].join(" ")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
