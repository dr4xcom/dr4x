"use client";

import { useEffect, useState } from "react";
import type { LibraryCategory } from "./types";
import { fetchCategories, publicLibraryUrl } from "./lib";
import ShelfRow from "./ShelfRow";
import Link from "next/link";

export default function CategoryPageClient({ categoryId }: { categoryId: string }) {
  const [category, setCategory] = useState<LibraryCategory | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const cats = await fetchCategories();
        const c = cats.find((x) => x.id === categoryId) ?? null;
        if (mounted) setCategory(c);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [categoryId]);

  const hero = category?.hero_image_path ?? null;
  const heroUrl = hero
    ? hero.startsWith("http://") || hero.startsWith("https://")
      ? hero
      : publicLibraryUrl(hero)
    : null;

  if (loading) return <div className="p-6 text-sm text-slate-500">…</div>;
  if (!category) return <div className="p-6 text-sm text-slate-500">القسم غير موجود</div>;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-sm text-slate-500">المكتبة</div>
          <h1 className="text-lg font-bold text-slate-900">{category.name}</h1>
        </div>

        <Link
          href="/library"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
        >
          رجوع للمكتبة
        </Link>
      </div>

      <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="relative h-32 sm:h-40 md:h-48">
          {heroUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroUrl} alt="Banner" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
              بانر القسم (اختياري)
            </div>
          )}
        </div>
      </div>

      {/* 3 shelves */}
      <ShelfRow categoryId={category.id} shelf="scientific" />
      <ShelfRow categoryId={category.id} shelf="prophetic" />
      <ShelfRow categoryId={category.id} shelf="folk" />
    </div>
  );
}
