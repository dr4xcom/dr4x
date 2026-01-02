// src/app/notifications/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";

type NotificationRow = {
  id: string;
  type: string;
  title: string | null;
  body: string | null;
  ref_table: string | null;
  ref_id: string | null;
  created_at: string;
  is_read: boolean;
};

export default function NotificationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [rows, setRows] = useState<NotificationRow[]>([]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr("");

        const { data: sData, error: sErr } = await supabase.auth.getSession();
        if (sErr) throw sErr;
        const uid = sData?.session?.user?.id ?? null;
        if (!uid) {
          router.push("/auth/login");
          return;
        }
        if (!alive) return;

        const { data, error } = await supabase.rpc(
          "user_list_notifications",
          {
            p_limit: 50,
            p_offset: 0,
          }
        );

        if (error) {
          console.error("user_list_notifications error", error);
          setErr(error.message || "تعذر تحميل التنبيهات.");
          setLoading(false);
          return;
        }

        if (!alive) return;
        setRows((data as NotificationRow[]) || []);
        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        console.error("notifications load error", e);
        setErr(e?.message ?? "تعذر تحميل التنبيهات.");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  async function markRead(id: string) {
    try {
      const { error } = await supabase.rpc("user_mark_notification_read", {
        p_id: id,
      });
      if (error) {
        console.error("user_mark_notification_read error", error);
        return;
      }
      setRows((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (e) {
      console.error("mark read error", e);
    }
  }

  function handleNotificationClick(n: NotificationRow) {
    if (
      n.type === "dm_message" &&
      n.ref_table === "dm_conversations" &&
      n.ref_id
    ) {
      router.push(`/messages/${n.ref_id}`);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* الهيدر */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-emerald-400" />
            <h1 className="text-xl font-extrabold">التنبيهات</h1>
          </div>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-full px-4 py-2 bg-slate-900 text-slate-100 border border-slate-700 hover:bg-slate-800 text-sm"
          >
            الرجوع
          </button>
        </div>

        {err ? (
          <div className="rounded-2xl border border-red-500 bg-red-900/40 p-3 text-sm">
            {err}
          </div>
        ) : null}

        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
          {loading ? (
            <div className="text-sm text-slate-400">
              جاري تحميل التنبيهات…
            </div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-slate-400">
              لا توجد تنبيهات حتى الآن.
            </div>
          ) : (
            rows.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  markRead(n.id);
                  handleNotificationClick(n);
                }}
                className={[
                  "w-full text-right rounded-2xl px-3 py-3 text-sm border",
                  n.is_read
                    ? "border-slate-800 bg-slate-900/60"
                    : "border-emerald-500/60 bg-slate-900",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-semibold">
                    {n.title ||
                      (n.type === "dm_message"
                        ? "رسالة خاصة جديدة"
                        : "تنبيه")}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(n.created_at).toLocaleString()}
                  </span>
                </div>
                {n.body ? (
                  <div className="text-xs text-slate-300 whitespace-pre-wrap">
                    {n.body}
                  </div>
                ) : null}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
