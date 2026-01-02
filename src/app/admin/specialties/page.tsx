"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabase/client";

type Department = {
  id: number;
  name_ar: string | null;
  name_en: string | null;
};

type Specialty = {
  id: number;
  department_id: number | null;
  name_ar: string | null;
  name_en: string | null;
};

function safeText(v: any) {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : "—";
}

export default function AdminSpecialtiesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);

  const [q, setQ] = useState("");
  const [deptFilter, setDeptFilter] = useState<number | "all">("all");

  // إضافة تخصص
  const [newDeptId, setNewDeptId] = useState<number | "">("");
  const [newNameAr, setNewNameAr] = useState("");
  const [newNameEn, setNewNameEn] = useState("");

  // تعديل تخصص
  const [editId, setEditId] = useState<number | null>(null);
  const [editDeptId, setEditDeptId] = useState<number | "">("");
  const [editNameAr, setEditNameAr] = useState("");
  const [editNameEn, setEditNameEn] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setErr(null);
        setLoading(true);

        // ✅ مهم: departments عندك ما فيها sort_order ولا created_at
        const depRes = await supabase
          .from("departments")
          .select("id,name_ar,name_en")
          .order("id", { ascending: true });

        if (depRes.error) throw depRes.error;

        // ✅ specialties عندك نجيب فقط الأعمدة الموجودة
        const specRes = await supabase
          .from("specialties")
          .select("id,department_id,name_ar,name_en")
          .order("id", { ascending: true });

        if (specRes.error) throw specRes.error;

        if (!alive) return;
        setDepartments((depRes.data ?? []) as Department[]);
        setSpecialties((specRes.data ?? []) as Specialty[]);
        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "تعذر جلب التخصصات/الأقسام. (قد تكون صلاحيات RLS لا تسمح للأدمن).");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function refresh() {
    try {
      setErr(null);
      setLoading(true);

      const depRes = await supabase
        .from("departments")
        .select("id,name_ar,name_en")
        .order("id", { ascending: true });

      if (depRes.error) throw depRes.error;

      const specRes = await supabase
        .from("specialties")
        .select("id,department_id,name_ar,name_en")
        .order("id", { ascending: true });

      if (specRes.error) throw specRes.error;

      setDepartments((depRes.data ?? []) as Department[]);
      setSpecialties((specRes.data ?? []) as Specialty[]);
      setLoading(false);
    } catch (e: any) {
      setErr(e?.message ?? "تعذر تحديث البيانات.");
      setLoading(false);
    }
  }

  const deptName = useMemo(() => {
    const map = new Map<number, string>();
    departments.forEach((d) => {
      map.set(d.id, (d.name_ar ?? d.name_en ?? `قسم #${d.id}`).toString());
    });
    return map;
  }, [departments]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return specialties.filter((s) => {
      if (deptFilter !== "all" && s.department_id !== deptFilter) return false;

      if (!needle) return true;

      const id = String(s.id).toLowerCase();
      const ar = (s.name_ar ?? "").toLowerCase();
      const en = (s.name_en ?? "").toLowerCase();
      const dep = s.department_id ? String(deptName.get(s.department_id) ?? "").toLowerCase() : "";
      return id.includes(needle) || ar.includes(needle) || en.includes(needle) || dep.includes(needle);
    });
  }, [q, specialties, deptFilter, deptName]);

  function startEdit(s: Specialty) {
    setEditId(s.id);
    setEditDeptId(typeof s.department_id === "number" ? s.department_id : "");
    setEditNameAr(s.name_ar ?? "");
    setEditNameEn(s.name_en ?? "");
  }

  function cancelEdit() {
    setEditId(null);
    setEditDeptId("");
    setEditNameAr("");
    setEditNameEn("");
  }

  async function addSpecialty() {
    try {
      setErr(null);
      setSaving(true);

      if (!newDeptId) {
        setErr("اختر القسم أولاً.");
        return;
      }

      const payload: any = {
        department_id: Number(newDeptId),
        name_ar: newNameAr.trim() || null,
        name_en: newNameEn.trim() || null,
      };

      if (!payload.name_ar && !payload.name_en) {
        setErr("لازم تكتب اسم عربي أو إنجليزي على الأقل.");
        return;
      }

      const { error } = await supabase.from("specialties").insert(payload);
      if (error) throw error;

      setNewDeptId("");
      setNewNameAr("");
      setNewNameEn("");
      await refresh();
    } catch (e: any) {
      setErr(
        e?.message ??
          "تعذر إضافة التخصص. (إذا RLS تمنع INSERT للأدمن، نحلها لاحقًا بـ RPC بأقل تعديل ممكن)."
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (editId == null) return;

    try {
      setErr(null);
      setSaving(true);

      if (!editDeptId) {
        setErr("اختر القسم للتخصص.");
        return;
      }

      const payload: any = {
        department_id: Number(editDeptId),
        name_ar: editNameAr.trim() || null,
        name_en: editNameEn.trim() || null,
      };

      if (!payload.name_ar && !payload.name_en) {
        setErr("لازم تكتب اسم عربي أو إنجليزي على الأقل.");
        return;
      }

      const { error } = await supabase.from("specialties").update(payload).eq("id", editId);
      if (error) throw error;

      cancelEdit();
      await refresh();
    } catch (e: any) {
      setErr(
        e?.message ??
          "تعذر حفظ التعديل. (إذا RLS تمنع UPDATE للأدمن، نحلها لاحقًا بـ RPC بأقل تعديل ممكن)."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteSpecialty(id: number) {
    try {
      setErr(null);
      setDeletingId(id);

      const { error } = await supabase.from("specialties").delete().eq("id", id);
      if (error) throw error;

      await refresh();
    } catch (e: any) {
      setErr(
        e?.message ??
          "تعذر حذف التخصص. (إذا RLS تمنع DELETE للأدمن، نحلها لاحقًا بـ RPC بأقل تعديل ممكن)."
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="text-xs text-slate-400">Admin</div>
          <h2 className="text-lg font-extrabold">التخصصات</h2>
          <div className="text-sm text-slate-300">
            إدارة التخصصات (specialties) وربطها بالأقسام — بدون أي تعديل DB/RLS.
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none"
            title="فلترة حسب القسم"
          >
            <option value="all">كل الأقسام</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name_ar || d.name_en || `قسم #${d.id}`}
              </option>
            ))}
          </select>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="بحث (اسم/قسم/ID)…"
            className="w-full sm:w-72 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none"
          />
        </div>
      </div>

      {err ? (
        <div className="rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      {/* Add */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
        <div className="text-sm font-semibold mb-2">إضافة تخصص</div>

        {/* ✅ لاحظ: ما عاد فيه sort_order نهائيًا */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select
            value={newDeptId}
            onChange={(e) => setNewDeptId(e.target.value ? Number(e.target.value) : "")}
            className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none"
          >
            <option value="">القسم *</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name_ar || d.name_en || `قسم #${d.id}`}
              </option>
            ))}
          </select>

          <input
            value={newNameAr}
            onChange={(e) => setNewNameAr(e.target.value)}
            placeholder="الاسم بالعربي"
            className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none"
          />
          <input
            value={newNameEn}
            onChange={(e) => setNewNameEn(e.target.value)}
            placeholder="الاسم بالإنجليزي"
            className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none"
          />
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={addSpecialty}
            disabled={saving}
            className={[
              "rounded-xl border px-3 py-2 text-sm font-extrabold transition",
              saving
                ? "border-slate-900 bg-slate-950/40 text-slate-600 cursor-not-allowed"
                : "border-slate-800 bg-slate-900/40 text-slate-200 hover:bg-slate-900",
            ].join(" ")}
          >
            {saving ? "…" : "إضافة"}
          </button>

          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className={[
              "rounded-xl border px-3 py-2 text-sm font-semibold transition",
              loading
                ? "border-slate-900 bg-slate-950/40 text-slate-600 cursor-not-allowed"
                : "border-slate-800 bg-slate-950/40 text-slate-200 hover:bg-slate-900/40",
            ].join(" ")}
          >
            تحديث
          </button>
        </div>
      </div>

      {/* List */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="text-sm font-semibold">قائمة التخصصات</div>
          <div className="text-xs text-slate-400">
            {loading ? "جارٍ التحميل…" : `العدد: ${filtered.length}`}
          </div>
        </div>

        {loading && specialties.length === 0 ? (
          <div className="p-4 text-sm text-slate-300">جارٍ جلب التخصصات…</div>
        ) : null}

        {!loading && filtered.length === 0 ? (
          <div className="p-4 text-sm text-slate-300">لا توجد تخصصات.</div>
        ) : null}

        <div className="divide-y divide-slate-800">
          {filtered.map((s) => {
            const isEditing = editId === s.id;

            return (
              <div key={s.id} className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-extrabold">تخصص #{s.id}</div>
                      <span className="text-xs text-slate-500">
                        القسم:{" "}
                        {typeof s.department_id === "number"
                          ? deptName.get(s.department_id) ?? `قسم #${s.department_id}`
                          : "—"}
                      </span>
                    </div>

                    {!isEditing ? (
                      <div className="mt-2 text-sm text-slate-200">
                        <div>
                          <span className="text-slate-500">AR:</span>{" "}
                          <span className="font-semibold">{safeText(s.name_ar)}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">EN:</span>{" "}
                          <span className="font-semibold">{safeText(s.name_en)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <select
                          value={editDeptId}
                          onChange={(e) => setEditDeptId(e.target.value ? Number(e.target.value) : "")}
                          className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none"
                        >
                          <option value="">القسم *</option>
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name_ar || d.name_en || `قسم #${d.id}`}
                            </option>
                          ))}
                        </select>

                        <input
                          value={editNameAr}
                          onChange={(e) => setEditNameAr(e.target.value)}
                          placeholder="الاسم بالعربي"
                          className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none"
                        />
                        <input
                          value={editNameEn}
                          onChange={(e) => setEditNameEn(e.target.value)}
                          placeholder="الاسم بالإنجليزي"
                          className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 justify-start lg:justify-end">
                    {!isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(s)}
                          className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm font-extrabold text-slate-200 hover:bg-slate-900"
                        >
                          تعديل
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteSpecialty(s.id)}
                          disabled={deletingId === s.id}
                          className={[
                            "rounded-xl border px-3 py-2 text-sm font-extrabold transition",
                            deletingId === s.id
                              ? "border-slate-900 bg-slate-950/40 text-slate-600 cursor-not-allowed"
                              : "border-red-900/60 bg-red-950/30 text-red-200 hover:bg-red-950/50",
                          ].join(" ")}
                        >
                          {deletingId === s.id ? "…" : "حذف"}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={saveEdit}
                          disabled={saving}
                          className={[
                            "rounded-xl border px-3 py-2 text-sm font-extrabold transition",
                            saving
                              ? "border-slate-900 bg-slate-950/40 text-slate-600 cursor-not-allowed"
                              : "border-emerald-900/60 bg-emerald-950/40 text-emerald-200 hover:bg-emerald-950/60",
                          ].join(" ")}
                        >
                          {saving ? "…" : "حفظ"}
                        </button>

                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={saving}
                          className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900/40"
                        >
                          إلغاء
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-4 py-3 border-t border-slate-800 text-xs text-slate-400">
          ملاحظة: عمليات (إضافة/تعديل/حذف) قد تفشل إذا سياسات RLS لا تسمح للأدمن. وقتها نثبت ذلك ثم نستخدم RPC بأقل تعديل ممكن.
        </div>
      </div>
    </div>
  );
}
