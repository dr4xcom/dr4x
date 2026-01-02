"use client";

import Link from "next/link";
import type { LibraryCategory } from "./types";

export default function CategoryBlock({ c }: { c: LibraryCategory }) {
  return (
    <Link
      href={`/library/category/${c.id}`}
      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 hover:bg-white/10"
      title={c.name}
    >
      {c.name}
    </Link>
  );
}
