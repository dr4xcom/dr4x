// src/components/clinic/ClinicAttachments.tsx
"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabase/client";

export default function ClinicAttachments({
  consultationId,
  me,
  role,
  patientId,
  doctorId,
  prescriptionsEnabled,
  attachmentsEnabled,
}: {
  consultationId: string;
  me: string;
  role: string;
  patientId: string;
  doctorId: string;
  prescriptionsEnabled: boolean;
  attachmentsEnabled?: boolean;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastUrl, setLastUrl] = useState<string | null>(null);

  const disabledByAdmin = attachmentsEnabled === false;

  async function upload(kind: "lab_result" | "prescription", file: File) {
    setErr(null);
    setOk(null);
    setLastUrl(null);

    // ✅ قفل عام من الإدارة
    if (disabledByAdmin) {
      setErr("المرفقات متوقفة من الإدارة.");
      return;
    }

    // ✅ قفل الوصفات من الإدارة
    if (kind === "prescription" && !prescriptionsEnabled) {
      setErr("الوصفات متوقفة من الإدارة.");
      return;
    }

    // قواعد واجهة (زيادة أمان + UX)
    if (role === "patient" && kind !== "lab_result") {
      setErr("المريض يمكنه رفع نتائج التحاليل فقط.");
      return;
    }
    if (role === "doctor" && kind !== "prescription") {
      setErr("الطبيب يمكنه رفع الوصفات فقط.");
      return;
    }

    setBusy(true);
    try {
      const { data: s, error: sErr } = await supabase.auth.getSession();
      if (sErr) throw sErr;
      const token = s.session?.access_token;
      if (!token) throw new Error("ليس لديك جلسة دخول صالحة.");

      const fd = new FormData();
      fd.append("consultationId", consultationId);
      fd.append("kind", kind);
      fd.append("file", file);

      const res = await fetch("/api/clinic/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Upload failed");
      }

      setOk("تم رفع الملف ✅");
      if (json?.signedUrl) setLastUrl(json.signedUrl);
    } catch (e: any) {
      setErr(e?.message ?? "Upload error");
    } finally {
      setBusy(false);
    }
  }

  if (disabledByAdmin) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
        <div className="font-bold">المرفقات</div>
        <div className="text-sm text-slate-300 mt-1">المرفقات متوقفة من الإدارة.</div>
        <div className="text-xs text-slate-500 mt-2">يمكن تفعيلها من: /admin/settings</div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
      <div className="font-bold">المرفقات</div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FileBox
          title="رفع نتيجة تحليل"
          desc="المريض يرفع للطبيب"
          disabled={busy || role !== "patient"}
          onPick={(f) => upload("lab_result", f)}
        />
        <FileBox
          title="رفع وصفة (PDF/صورة)"
          desc="الطبيب يرفع للمريض"
          disabled={busy || role !== "doctor" || !prescriptionsEnabled}
          onPick={(f) => upload("prescription", f)}
        />
      </div>

      {err ? (
        <div className="rounded-xl border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-200">{err}</div>
      ) : null}

      {ok ? (
        <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/30 p-3 text-sm text-emerald-200">
          {ok}
        </div>
      ) : null}

      {lastUrl ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/25 p-3 text-sm text-slate-200 break-words">
          رابط تحميل مؤقت (10 دقائق):{" "}
          <a className="underline" href={lastUrl} target="_blank" rel="noreferrer">
            فتح الملف
          </a>
        </div>
      ) : null}

      <div className="text-xs text-slate-500">
        * الرفع يتم عبر Server API فقط (صفر سياسات على Storage + bucket clinic private).
      </div>
    </div>
  );
}

function FileBox({
  title,
  desc,
  disabled,
  onPick,
}: {
  title: string;
  desc: string;
  disabled: boolean;
  onPick: (f: File) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/25 p-4">
      <div className="font-extrabold">{title}</div>
      <div className="text-sm text-slate-400 mt-1">{desc}</div>

      <label
        className={[
          "mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm font-extrabold text-slate-200 hover:bg-slate-900",
          disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
        ].join(" ")}
      >
        <input
          type="file"
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
            e.currentTarget.value = "";
          }}
        />
        اختيار ملف…
      </label>

      {disabled ? <div className="text-xs text-slate-500 mt-2">غير متاح لهذا الدور/أو متوقف.</div> : null}
    </div>
  );
}
