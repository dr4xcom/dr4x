"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { LibraryCategory } from "./types";
import { fetchCategories, fetchGlobalBannerUrl } from "./lib";
import ShelfRow from "./ShelfRow";
import CategoryBlock from "./CategoryBlock";
import LibraryHeader from "./LibraryHeader";
import { lt, getLibraryLocale } from "./i18n";

export default function LibraryHomeClient() {
  const locale = useMemo(() => getLibraryLocale(), []);
  const searchParams = useSearchParams();
  const categoryFilter = searchParams.get("category");

  const [categories, setCategories] = useState<LibraryCategory[]>([]);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        const [cats, banner] = await Promise.all([
          fetchCategories(),
          fetchGlobalBannerUrl(),
        ]);
        if (mounted) {
          setCategories(cats);
          setBannerUrl(banner);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const visibleCategories = categoryFilter
    ? categories.filter((c) => c.id === categoryFilter)
    : categories;

  return (
    // ✅ خلفية المكتبة كاملة داكنة
    <div className="min-h-screen w-full bg-slate-900">
      {/* ✅ مساحة المحتوى 80% على الديسكتوب */}
      <div className="mx-auto w-[95%] md:w-[80%] max-w-6xl px-4 py-6">
        <LibraryHeader
          title={lt("library", locale)}
          subtitle="DR4X"
          rightActionHref="/library/submit"
          rightActionLabel={lt("submitBook", locale)}
        />

        {/* Banner (Dark) */}
        <div className="mb-6 overflow-hidden rounded-3xl border border-white/10 bg-slate-900/90 p-0">
          <div className="relative h-44">
            {bannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={bannerUrl}
                alt="Library Banner"
                className="h-full w-full object-cover"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="h-full w-full bg-slate-900" />
            )}

            {/* ✅ Overlay مناسب للوضع الداكن */}
            <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/30 to-slate-900/90" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-slate-100 font-extrabold text-xl">
                  {lt("library", locale)}
                </div>
                <div className="text-slate-300 text-sm mt-1">
                  مكتبة طبية داخل DR4X
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Category buttons */}
        {!categoryFilter ? (
          <div className="mb-6 rounded-3xl border border-white/10 bg-slate-900/90 p-4">
            <div className="font-semibold mb-3 text-slate-100">
              {lt("categories", locale)}
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <CategoryBlock key={c.id} c={c} />
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-4">
            <Link
              href="/library"
              className="text-sm text-slate-300 hover:text-slate-100"
            >
              ← {lt("categories", locale)}
            </Link>
          </div>
        )}

        {loading ? (
          <div className="text-sm text-slate-400">…</div>
        ) : (
          visibleCategories.map((c) => (
            <section key={c.id} className="mb-10">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-extrabold text-slate-100">
                  {c.name}
                </h2>
              </div>

              {/* ✅ وضعنا سطور الرفوف داخل كرت داكن ليتناسق */}
              <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-4">
                <ShelfRow categoryId={c.id} shelf="scientific" />
                <div className="h-4" />
                <ShelfRow categoryId={c.id} shelf="prophetic" />
                <div className="h-4" />
                <ShelfRow categoryId={c.id} shelf="folk" />
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
