// src/app/admin/layout.tsx
import AdminGate from "@/components/admin/AdminGate";
import AdminShell from "@/components/admin/AdminShell";

export const metadata = {
  title: "Admin | DR4X",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGate>
      <AdminShell>{children}</AdminShell>
    </AdminGate>
  );
}
