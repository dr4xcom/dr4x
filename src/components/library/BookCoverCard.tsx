"use client";

import Link from "next/link";
import type { LibraryBook } from "./types";
import { lt, getLibraryLocale } from "./i18n";
import { publicLibraryUrl } from "./lib";
import { useMemo } from "react";

function isSafeHttpUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default function BookCoverCard({ book }: { book: LibraryBook }) {
  const locale = useMemo(() => getLibraryLocale(), []);

  // ✅ يدعم:
  // 1) رابط خارجي مباشر: https://...
  // 2) مسار داخلي في Storage: patient_files/... (clinic bucket)
  const coverUrl = useMemo(() => {
    const p = (book.cover_path || "").trim();
    if (!p) return null;
    if (isSafeHttpUrl(p)) return p; // external
    return publicLibraryUrl(p); // internal path -> public url
  }, [book.cover_path]);

  return (
    <Link
      href={`/library/${book.id}`}
      className="group relative block w-28 shrink-0"
    >
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/90">
        <div className="aspect-[3/4] w-full">
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl}
              alt={book.title}
              className="h-full w-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => {
                // لو فشل الرابط الخارجي/الداخلي: نخفي الصورة ونُظهر placeholder
                const img = e.currentTarget as HTMLImageElement;
                img.style.display = "none";
                const parent = img.parentElement;
                if (parent) parent.setAttribute("data-img-error", "1");
              }}
            />
          ) : null}

          {/* Placeholder (يظهر إذا ما في صورة أو فشل تحميلها) */}
          <div
            className={[
              "flex h-full w-full items-center justify-center text-xs",
              "text-slate-300",
              coverUrl ? "hidden" : "",
            ].join(" ")}
          >
            {lt("cover", locale)}
          </div>

          {/* في حالة onError أخفينا img، نحتاج placeholder يظهر */}
          <style jsx>{`
            [data-img-error="1"] > div {
              display: flex !important;
            }
          `}</style>
        </div>

        {/* Hover details */}
        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
          <div className="absolute bottom-0 w-full p-2">
            <div className="line-clamp-2 text-xs font-extrabold text-white">
              {book.title}
            </div>

            {book.author_name ? (
              <div className="mt-1 line-clamp-1 text-[11px] text-white/80">
                {book.author_name}
              </div>
            ) : null}

            <div className="mt-1 text-[11px] text-white/90">
              {book.is_paid ? lt("paid", locale) : lt("free", locale)}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
