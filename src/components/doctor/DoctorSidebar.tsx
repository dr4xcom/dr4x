// src/components/doctor/DoctorSidebar.tsx
"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function NavItem({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={[
        "w-full block rounded-2xl px-4 py-3 text-base font-extrabold transition",
        active
          ? "bg-slate-900 text-white"
          : "text-slate-900 hover:bg-slate-100",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

export default function DoctorSidebar() {
  return (
    <div className="space-y-2">
      <div className="text-xs text-slate-500 px-1">Doctor</div>

      {/* ✅ الربط المطلوب */}
      <NavItem href="/doctor/queue" label="الطابور" />

      {/* روابط إضافية (اختيارية) — ما تضر لو ما عندك صفحاتها */}
      {/* <NavItem href="/doctor/consultations" label="استشاراتي" /> */}
      {/* <NavItem href="/doctor/profile" label="الملف الشخصي" /> */}
    </div>
  );
}
