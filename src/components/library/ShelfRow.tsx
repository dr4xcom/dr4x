"use client";

import { useEffect, useState } from "react";
import type { LibraryBook } from "./types";
import { fetchApprovedBooksByCategoryAndShelf } from "./lib";
import BookCoverCard from "./BookCoverCard";
import { lt, getLibraryLocale } from "./i18n";

export default function ShelfRow({
  categoryId,
  shelf,
}: {
  categoryId: string;
  shelf: "scientific" | "prophetic" | "folk";
}) {
  const locale = getLibraryLocale();
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await fetchApprovedBooksByCategoryAndShelf(
          categoryId,
          shelf,
          14,
          0
        );
        if (mounted) setBooks(data);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [categoryId, shelf]);

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-slate-100">
          {lt(shelf, locale)}
        </h3>
      </div>

      {/* ✅ غلاف الرف داكن */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-3">
        <div className="flex gap-3 overflow-x-auto pb-2">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="w-28 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5"
              >
                <div className="aspect-[3/4] w-full animate-pulse bg-white/10" />
              </div>
            ))
          ) : books.length ? (
            books.map((b) => <BookCoverCard key={b.id} book={b} />)
          ) : (
            <div className="text-sm text-slate-300">لا توجد كتب</div>
          )}
        </div>
      </div>
    </section>
  );
}
