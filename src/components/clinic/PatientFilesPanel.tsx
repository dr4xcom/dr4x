// src/components/clinic/PatientFilesPanel.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";

type FileRow = {
  id: string;
  patient_id: string;
  consultation_id: number | string | null;
  kind: string | null;
  title: string | null;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  public_url: string | null;
  created_at: string | null;
};

function fmtBytes(n: number | null | undefined) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

function fmtDate(dt: string | null | undefined) {
  if (!dt) return "—";
  try {
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return dt;
    return d.toLocaleString();
  } catch {
    return dt;
  }
}

export default function PatientFilesPanel({
  patientId,
  consultationId,
  disabled,
}: {
  patientId: string;
  consultationId?: number | string | null;
  disabled?: boolean;
}) {
  const [rows, setRows] = useState<FileRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (disabled) return;

    let alive = true;

    async function loadOnce() {
      try {
        setErr(null);
        setLoading(true);

        const { data, error } = await supabase
          .from("patient_files")
          .select(
            "id,patient_id,consultation_id,kind,title,storage_path,mime_type,file_size,public_url,created_at"
          )
          .eq("patient_id", patientId)
          .order("created_at", { ascending: false })
          .limit(20);

        if (error) throw error;
        if (!alive) return;
        setRows((data as any) ?? []);
        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "تعذر تحميل ملفات المريض.");
        setLoading(false);
      }
    }

    loadOnce();

    return () => {
      alive = false;
    };
  }, [patientId, disabled]);

  if (disabled) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
        <div className="font-bold mb-1">ملفات المريض</div>
        <div className="text-sm text-slate-300">
          عرض ملفات المريض متوقف من إعدادات غرفة الكشف.
        </div>
        <div className="text-xs text-slate-500 mt-2">يمكن تفعيلها من: /admin/settings</div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="font-bold">ملفات المريض (تحاليل / تقارير / صور)</div>
        {typeof consultationId !== "undefined" && consultationId !== null && (
          <div className="text-[11px] text-slate-400">
            ترتب حسب الأحدث، مع إمكانية ربط بعض الملفات بهذه الجلسة لاحقًا.
          </div>
        )}
      </div>

      {err ? (
        <div className="rounded-xl border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      {loading && rows.length === 0 ? (
        <div className="text-sm text-slate-400">جارٍ تحميل الملفات…</div>
      ) : null}

      {!loading && rows.length === 0 ? (
        <div className="text-sm text-slate-400">لا توجد ملفات محفوظة لهذا المريض حتى الآن.</div>
      ) : null}

      {rows.length > 0 && (
        <div className="space-y-2 mt-1">
          {rows.map((f) => {
            const title =
              (f.title && f.title.trim()) ||
              (f.kind && f.kind.trim()) ||
              f.storage_path.split("/").pop() ||
              "ملف";

            const inThisConsult =
              consultationId != null &&
              String(f.consultation_id ?? "") === String(consultationId ?? "");

            return (
              <div
                key={f.id}
                className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-200 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold truncate">{title}</div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    {f.mime_type && <span>{f.mime_type}</span>}
                    {f.file_size != null && <span>{fmtBytes(f.file_size)}</span>}
                    {inThisConsult && (
                      <span className="rounded-full border border-emerald-600/60 bg-emerald-900/40 px-2 py-[1px] text-[10px] text-emerald-100">
                        مرتبطة بالجلسة الحالية
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[11px] text-slate-400">
                    <span className="text-slate-500">التاريخ:</span>{" "}
                    <span>{fmtDate(f.created_at)}</span>
                  </div>

                  {f.public_url ? (
                    <a
                      href={f.public_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center rounded-full border border-sky-500/70 bg-sky-900/30 px-3 py-1 text-[11px] font-semibold text-sky-100 hover:bg-sky-900/60"
                    >
                      فتح الملف
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-[11px] text-slate-400 cursor-not-allowed"
                      title="لا يوجد رابط عام محفوظ لهذا الملف (public_url فارغ)."
                    >
                      لا يوجد رابط متاح
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
