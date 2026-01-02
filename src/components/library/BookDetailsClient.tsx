// src/components/library/BookDetailsClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { LibraryBook, LibraryCounts } from "./types";
import {
  fetchApprovedBook,
  fetchCounts,
  logEvent,
  publicLibraryUrl,
  getSessionKey,
} from "./lib";
import { lt, getLibraryLocale } from "./i18n";

function isSafeHttpUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function resolveAssetUrl(pathOrUrl?: string | null) {
  const v = (pathOrUrl || "").trim();
  if (!v) return null;
  if (isSafeHttpUrl(v)) return v; // external URL
  return publicLibraryUrl(v); // internal storage path
}

export default function BookDetailsClient({ id }: { id: string }) {
  const locale = useMemo(() => getLibraryLocale(), []);
  const [book, setBook] = useState<LibraryBook | null>(null);
  const [counts, setCounts] = useState<LibraryCounts | null>(null);
  const [loading, setLoading] = useState(true);

  const coverUrl = resolveAssetUrl(book?.cover_path);
  const previewUrl = resolveAssetUrl(book?.preview_file_path);
  const fullUrl = resolveAssetUrl(book?.full_file_path);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        const b = await fetchApprovedBook(id);
        if (!mounted) return;
        setBook(b);
        if (b) {
          const c = await fetchCounts(b.id);
          if (mounted) setCounts(c);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id]);

  const canPreview =
    !!book &&
    book.status === "approved" &&
    book.preview_enabled &&
    !!book.preview_file_path;

  const isPaid = !!book?.is_paid;

  async function onPreviewOpenOncePerSession() {
    if (!book) return;

    const key = `library_preview_viewed_${book.id}`;
    if (typeof window !== "undefined" && sessionStorage.getItem(key)) return;
    if (typeof window !== "undefined") sessionStorage.setItem(key, "1");

    getSessionKey();
    await logEvent(book.id, "view_preview");
    const c = await fetchCounts(book.id);
    setCounts(c);
  }

  async function onDownloadClick() {
    if (!book) return;

    getSessionKey();
    await logEvent(book.id, "download_click");
    const c = await fetchCounts(book.id);
    setCounts(c);

    if (!isPaid && fullUrl) {
      window.open(fullUrl, "_blank", "noopener,noreferrer");

      await logEvent(book.id, "download_success");
      const c2 = await fetchCounts(book.id);
      setCounts(c2);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen w-full" style={{ backgroundColor: "#454545" }}>
        <div className="mx-auto w-full max-w-5xl px-4 py-6 text-sm text-white/70">
          …
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen w-full" style={{ backgroundColor: "#454545" }}>
        <div className="mx-auto w-full max-w-5xl px-4 py-6 text-sm text-white/70">
          —
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: "#454545" }}>
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <div className="flex flex-col gap-6 md:flex-row">
          <div className="w-full md:w-72">
            <div className="overflow-hidden rounded-2xl border border-white/15 bg-black/20">
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
                      const img = e.currentTarget as HTMLImageElement;
                      img.style.display = "none";
                      const parent = img.parentElement;
                      if (parent) parent.setAttribute("data-img-error", "1");
                    }}
                  />
                ) : null}

                <div
                  className={[
                    "flex h-full w-full items-center justify-center text-sm text-white/70",
                    coverUrl ? "hidden" : "",
                  ].join(" ")}
                >
                  {lt("cover", locale)}
                </div>

                <style jsx>{`
                  [data-img-error="1"] > div {
                    display: flex !important;
                  }
                `}</style>
              </div>
            </div>

            {/* صندوق الإحصائيات + الأزرار */}
            <div className="mt-4 rounded-2xl border border-white/15 bg-black/20 p-4">
              <div className="text-sm text-white/90">
                {book.is_paid ? lt("paid", locale) : lt("free", locale)}
                {book.is_paid && book.price != null ? (
                  <span className="ml-2 text-white/70">
                    {book.price} {book.currency ?? ""}
                  </span>
                ) : null}
              </div>

              <div className="mt-3 grid gap-2 text-sm text-white/80">
                <div>
                  {lt("previewViews", locale)}:{" "}
                  <span className="text-white">{counts?.view_preview_count ?? 0}</span>
                </div>
                <div>
                  {lt("downloadClicks", locale)}:{" "}
                  <span className="text-white">{counts?.download_click_count ?? 0}</span>
                </div>
                <div>
                  {lt("downloadSuccess", locale)}:{" "}
                  <span className="text-white">{counts?.download_success_count ?? 0}</span>
                </div>
              </div>

              {/* ✅ أزرار أكبر + لون #454545 */}
              <div className="mt-4 flex flex-col gap-3">
                {canPreview ? (
                  <button
                    onClick={async () => {
                      await onPreviewOpenOncePerSession();
                      if (previewUrl)
                        window.open(previewUrl, "_blank", "noopener,noreferrer");
                    }}
                    className="rounded-2xl border border-white/15 px-4 py-3 text-base font-semibold text-white hover:opacity-90"
                    style={{ backgroundColor: "#454545" }}
                  >
                    {lt("preview", locale)}
                  </button>
                ) : null}

                <button
                  onClick={onDownloadClick}
                  className="rounded-2xl border border-white/15 px-4 py-3 text-base font-semibold text-white hover:opacity-90"
                  style={{ backgroundColor: "#454545" }}
                >
                  {book.is_paid ? lt("requiresPurchase", locale) : lt("download", locale)}
                </button>

                {/* ✅ زر تحميل PDF الكامل باستخدام fullUrl */}
                {fullUrl ? (
                  <a
                    href={fullUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-2xl border border-white/15 px-4 py-3 text-center text-base font-semibold text-white hover:opacity-90"
                    style={{ backgroundColor: "#454545" }}
                  >
                    تحميل PDF الكامل
                  </a>
                ) : null}
              </div>
            </div>
          </div>

          {/* محتوى التفاصيل */}
          <div className="flex-1">
            <div className="rounded-2xl border border-white/15 bg-black/20 p-5">
              <h1 className="text-xl font-extrabold text-white">{book.title}</h1>
              {book.author_name ? (
                <div className="mt-2 text-sm text-white/75">{book.author_name}</div>
              ) : null}

              {book.description ? (
                <div className="mt-4 rounded-2xl border border-white/15 bg-black/15 p-4 text-sm text-white/85 whitespace-pre-wrap">
                  {book.description}
                </div>
              ) : null}

              {book.toc ? (
                <div className="mt-4 rounded-2xl border border-white/15 bg-black/15 p-4">
                  <div className="mb-2 text-sm font-semibold text-white/90">
                    {lt("toc", locale)}
                  </div>
                  <div className="text-sm text-white/85 whitespace-pre-wrap">
                    {book.toc}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
