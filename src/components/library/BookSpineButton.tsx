"use client";

import Link from "next/link";
import type { LibraryCategory } from "./types";

export default function BookSpineButton({
  category,
}: {
  category: LibraryCategory;
  index: number;
}) {
  // نفتح المكتبة في نافذة/تبويب جديد مع فلترة القسم
  const href = `/library?category=${encodeURIComponent(category.id)}`;

  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={category.name}
      style={{
        width: 36,
        height: 140,
        borderRadius: 15,
        border: "2px solid rgba(2,6,23,0.25)",
        background: "#f6f6f6",
        position: "relative",
        overflow: "hidden",
        textDecoration: "none",
        display: "grid",
        placeItems: "center",
        boxShadow: "0 10px 20px rgba(2,6,23,0.08)",
      }}
    >
      {/* Pencil sketch shading */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "repeating-linear-gradient(135deg, rgba(2,6,23,0.06) 0px, rgba(2,6,23,0.06) 1px, transparent 1px, transparent 7px)",
          opacity: 0.55,
        }}
      />

      {/* Soft highlight center */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 40%, rgba(255,255,255,0.65), rgba(255,255,255,0) 55%)",
        }}
      />

      {/* Top band */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 6,
          left: 6,
          right: 6,
          height: 6,
          borderRadius: 666,
          border: "2px solid rgba(2,6,23,0.22)",
          background: "rgba(255,255,255,0.35)",
        }}
      />

      {/* Bottom band */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          bottom: 6,
          left: 6,
          right: 6,
          height: 6,
          borderRadius: 666,
          border: "2px solid rgba(2,6,23,0.22)",
          background: "rgba(255,255,255,0.35)",
        }}
      />

      {/* Inner border to mimic hand-drawn outline */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 6,
          borderRadius: 18,
          border: "1px solid rgba(2,6,23,0.12)",
        }}
      />

      {/* Vertical label */}
      <div
        style={{
          writingMode: "vertical-rl",
          transform: "rotate(180deg)",
          fontSize: 20,
          fontWeight: 900,
          color: "rgba(2,6,23,0.85)",
          letterSpacing: "0.6px",
          textAlign: "center",
          paddingInline: 8,
          lineHeight: 1.05,
          userSelect: "none",
          textShadow: "0 1px 0 rgba(255,255,255,0.8)",
          position: "relative",
        }}
      >
        {category.name}
      </div>
    </Link>
  );
}
