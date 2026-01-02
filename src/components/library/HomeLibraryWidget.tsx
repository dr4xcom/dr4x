"use client";

import { useEffect, useState } from "react";
import type { LibraryCategory } from "./types";
import { fetchCategories } from "./lib";
import BookSpineButton from "./BookSpineButton";

export default function HomeLibraryWidget() {
  const [cats, setCats] = useState<LibraryCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await fetchCategories();
        if (mounted) setCats(data);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="dr4x-card p-4">
      <div className="font-semibold mb-3">المكتبة</div>

      {loading ? (
        <div className="text-sm text-slate-500">…</div>
      ) : cats.length ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {cats.slice(0, 12).map((c, i) => (
            <BookSpineButton key={c.id} category={c} index={i} />
          ))}
        </div>
      ) : (
        <div className="text-sm text-slate-500">لا توجد أقسام بعد</div>
      )}
    </div>
  );
}
