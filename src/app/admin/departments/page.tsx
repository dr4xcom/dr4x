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

export default function AdminDepartmentsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);

  const [q, setQ] = useState("");

  // إضافة قسم
  const [newNameAr, setNewNameAr] = useState("");
  const [newNameEn, setNewNameEn] = useState("");

  // تعديل قسم
  const [editId, setEditId] = useState<number | null>(null);
  const [editNameAr, setEditNameAr] = useState("");
  const [editNameEn, setEditNameEn] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setErr(null);
        setLoading(true);

        // ✅ departments عندك: id,name_ar,name_en فقط
        const depRes = await supabase
          .from("departments")
          .select("id,name_ar,name_en")
          .order("id", { ascending: true });

        if (depRes.error) throw depRes.error;

        // ✅ specialties للعرض فقط (لو RLS تمنعها ما نكسر الصفحة)
        const specRes = await supabase
          .from("specialties")
          .select("id,department_id,name_ar,name_en")
          .order("id", { ascending: true });

        if (!alive) return;

        setDepartments((depRes.data ?? []) as Department[]);
        if (!specRes.error) setSpecialties((specRes.data ?? []) as Specialty[]);
        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "تعذر جلب الأقسام. (قد تكون صلاحيات RLS لا تسمح للأدمن).");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return departments;

    return departments.filter((d) => {
      const ar = (d.name_ar ?? "").toLowerCase();
      const en = (d.name_en ?? "").toLowerCase();
      const id = String(d.id).toLowerCase();
      return ar.includes(needle) || en.includes(needle) || id.includes(needle);
    });
  }, [q, departments]);

  const specialtiesByDept = useMemo(() => {
    const map = new Map<number, Specialty[]>();
    for (const s of specialties) {
      if (typeof s.department_id !== "number") continue;
      if (!map.has(s.department_id)) map.set(s.department_id, []);
      map.get(s.department_id)!.push(s);
    }
    return map;
  }, [specialties]);

  function startEdit(d: Department) {
    setEditId(d.id);
    setEditNameAr(d.name_ar ?? "");
    setEditNameEn(d.name_en ?? "");
  }

  function cancelEdit() {
    setEditId(null);
    setEditNameAr("");
    setEditNameEn("");
  }

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

      setDepartments((depRes.data ?? []) as Department[]);
      if (!specRes.error) setSpecialties((specRes.data ?? []) as Specialty[]);
      setLoading(false);
    } catch (e: any) {
      setErr(e?.message ?? "تعذر تحديث الأقسام.");
      setLoading(false);
    }
  }

  async function addDepartment() {
    try {
      setErr(null);
      setSaving(true);

      const payload: any = {
        name_ar: newNameAr.trim() || null,
        name_en: newNameEn.trim() || null,
      };

      if (!payload.name_ar && !payload.name_en) {
        setErr("لازم تكتب اسم عربي أو إنجليزي على الأقل.");
        return;
      }

      const { error } = await supabase.from("departments").insert(payload);
      if (error) throw error;

      setNewNameAr("");
      setNewNameEn("");
      await refresh();
    } catch (e: any) {
      setErr(
        e?.message ??
          "تعذر إضافة القسم. (إذا RLS تمنع INSERT للأدمن، نحلها لاحقًا بـ RPC بأقل تعديل ممكن)."
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

      const payload: any = {
        name_ar: editNameAr.trim() || null,
        name_en: editNameEn.trim() || null,
      };

      if (!payload.name_ar && !payload.name_en) {
        setErr("لازم تكتب اسم عربي أو إنجليزي على الأقل.");
        return;
      }

      const { error } = await supabase.from("departments").update(payload).eq("id", editId);
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

  async function deleteDepartment(id: number) {
    try {
      setErr(null);
      setDeletingId(id);

      const linkedCount = specialties.filter((s) => s.department_id === id).length;
      if (linkedCount > 0) {
        setErr(`لا يمكن حذف القسم لأن هناك ${linkedCount} تخصص/تخصصات مرتبطة به. احذف/انقل التخصصات أولاً.`);
        return;
      }

      const { error } = await supabase.from("departments").delete().eq("id", id);
      if (error) throw error;

      await refresh();
    } catch (e: any) {
      setErr(
        e?.message ??
          "تعذر حذف القسم. (إذا RLS تمنع DELETE للأدمن، نحلها لاحقًا بـ RPC بأقل تعديل ممكن)."
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
          <h2 className="text-lg font-extrabold">الأقسام</h2>
          <div className="text-sm text-slate-300">
            إدارة الأقسام (إضافة/تعديل/حذف) + عرض التخصصات المرتبطة — بدون أي تعديل DB/RLS.
          </div>
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="بحث (اسم/ID)…"
          className="w-full sm:w-72 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none"
        />
      </div>

      {err ? (
        <div className="rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">{err}</div>
      ) : null}

      {/* Add */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
        <div className="text-sm font-semibold mb-2">إضافة قسم</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
            onClick={addDepartment}
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
          <div className="text-sm font-semibold">قائمة الأقسام</div>
          <div className="text-xs text-slate-400">{loading ? "جارٍ التحميل…" : `العدد: ${filtered.length}`}</div>
        </div>

        {loading && departments.length === 0 ? <div className="p-4 text-sm text-slate-300">جارٍ جلب الأقسام…</div> : null}
        {!loading && filtered.length === 0 ? <div className="p-4 text-sm text-slate-300">لا توجد أقسام.</div> : null}

        <div className="divide-y divide-slate-800">
          {filtered.map((d) => {
            const isEditing = editId === d.id;
            const linked = specialtiesByDept.get(d.id) ?? [];

            return (
              <div key={d.id} className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-extrabold">قسم #{d.id}</div>
                      {linked.length ? (
                        <span className="text-xs font-bold rounded-full px-2 py-1 border border-slate-800 bg-slate-950/40 text-slate-200">
                          تخصصات: {linked.length}
                        </span>
                      ) : null}
                    </div>

                    {!isEditing ? (
                      <div className="mt-2 text-sm text-slate-200">
                        <div>
                          <span className="text-slate-500">AR:</span>{" "}
                          <span className="font-semibold">{safeText(d.name_ar)}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">EN:</span>{" "}
                          <span className="font-semibold">{safeText(d.name_en)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
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

                    {linked.length ? (
                      <div className="mt-3 text-xs text-slate-400">
                        <div className="mb-1">التخصصات المرتبطة:</div>
                        <div className="flex flex-wrap gap-2">
                          {linked.slice(0, 12).map((s) => (
                            <span
                              key={s.id}
                              className="rounded-full border border-slate-800 bg-slate-950/40 px-2 py-1 text-slate-200"
                              title={`Specialty #${s.id}`}
                            >
                              {safeText(s.name_ar) !== "—" ? safeText(s.name_ar) : safeText(s.name_en)}{" "}
                              <span className="text-slate-500">#{s.id}</span>
                            </span>
                          ))}
                          {linked.length > 12 ? <span className="text-slate-500">+{linked.length - 12} أخرى</span> : null}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2 justify-start lg:justify-end">
                    {!isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(d)}
                          className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm font-extrabold text-slate-200 hover:bg-slate-900"
                        >
                          تعديل
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteDepartment(d.id)}
                          disabled={deletingId === d.id}
                          className={[
                            "rounded-xl border px-3 py-2 text-sm font-extrabold transition",
                            deletingId === d.id
                              ? "border-slate-900 bg-slate-950/40 text-slate-600 cursor-not-allowed"
                              : "border-red-900/60 bg-red-950/30 text-red-200 hover:bg-red-950/50",
                          ].join(" ")}
                        >
                          {deletingId === d.id ? "…" : "حذف"}
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
