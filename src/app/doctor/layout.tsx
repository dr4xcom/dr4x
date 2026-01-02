// src/app/doctor/layout.tsx
import React from "react";
import AppShell from "@/components/layout/AppShell";
import DoctorSidebar from "@/components/doctor/DoctorSidebar";

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      sidebar={<DoctorSidebar />}
      header="لوحة الطبيب"
      rightPanel={
        <div className="space-y-2">
          <div className="text-sm font-extrabold">ملاحظة</div>
          <div className="text-sm text-slate-600">
            هنا لاحقًا: تنبيهات الطبيب / أشياء سريعة.
          </div>
        </div>
      }
    >
      {children}
    </AppShell>
  );
}
