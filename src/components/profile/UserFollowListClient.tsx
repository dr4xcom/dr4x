// src/components/profile/UserFollowListClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabase/client";

type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  is_doctor: boolean | null;
  avatar_path: string | null;
};

function getPublicUrlFromClinic(path: string | null) {
  if (!path) return null;
  const { data } = supabase.storage.from("clinic").getPublicUrl(path);
  return data?.publicUrl ?? null;
}

export default function UserFollowListClient({
  username,
  mode,
}: {
  username: string;
  mode: "followers" | "following";
}) {
  const cleanUsername = useMemo(() => {
    try {
      return decodeURIComponent(username).trim();
    } catch {
      return username.trim();
    }
  }, [username]);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [targetId, setTargetId] = useState<string | null>(null);
  const [targetUsername, setTargetUsername] = useState<string | null>(null);
  const [list, setList] = useState<ProfileRow[]>([]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setErrorMsg("");
      setList([]);

      if (!cleanUsername) {
        setErrorMsg("username غير صالح.");
        setLoading(false);
        return;
      }

      // 1️⃣ جلب المستخدم الهدف
      const { data: target, error: targetErr } = await supabase
        .from("profiles")
        .select("id,username")
        .eq("username", cleanUsername)
        .maybeSingle();

      if (!mounted) return;

      if (targetErr || !target) {
        setErrorMsg("المستخدم غير موجود.");
        setLoading(false);
        return;
      }

      setTargetId(target.id);
      setTargetUsername(target.username);

      // 2️⃣ جلب العلاقات من followers
      const rel =
        mode === "followers"
          ? await supabase
              .from("followers")
              .select("follower_id")
              .eq("followed_id", target.id)
          : await supabase
              .from("followers")
              .select("followed_id")
              .eq("follower_id", target.id);

      if (!mounted) return;

      if (rel.error) {
        setErrorMsg("لا يمكن قراءة جدول المتابعين (RLS).");
        setLoading(false);
        return;
      }

      const ids =
        mode === "followers"
          ? (rel.data ?? []).map((r: any) => r.follower_id)
          : (rel.data ?? []).map((r: any) => r.followed_id);

      if (ids.length === 0) {
        setList([]);
        setLoading(false);
        return;
      }

      // 3️⃣ جلب بروفايلات المستخدمين
      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("id,username,full_name,is_doctor,avatar_path")
        .in("id", ids);

      if (!mounted) return;

      if (profErr) {
        setErrorMsg("لا يمكن قراءة ملفات المستخدمين.");
        setLoading(false);
        return;
      }

      // الحفاظ على نفس ترتيب ids
      const map = new Map<string, ProfileRow>();
      (profiles ?? []).forEach((p) => map.set(p.id, p));
      const ordered = ids.map((id) => map.get(id)).filter(Boolean) as ProfileRow[];

      setList(ordered);
      setLoading(false);
    }

    load();
    return () => {
      mounted = false;
    };
  }, [cleanUsername, mode]);

  const title = mode === "followers" ? "متابعون" : "المتابَعون";
  const backHref = targetUsername ? `/u/${targetUsername}` : "/home";

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6">
      <div className="rounded-2xl border bg-white p-4 flex items-center justify-between">
        <div>
          <div className="text-lg font-bold">{title}</div>
          {targetUsername ? (
            <div className="text-sm text-slate-600">@{targetUsername}</div>
          ) : null}
        </div>

        <Link
          href={backHref}
          className="rounded-2xl px-4 py-2 text-sm font-semibold bg-slate-100 hover:bg-slate-200"
        >
          رجوع
        </Link>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="text-slate-600">جارٍ التحميل...</div>
        ) : errorMsg ? (
          <div className="rounded-2xl border bg-white p-4 text-slate-700">
            {errorMsg}
          </div>
        ) : list.length === 0 ? (
          <div className="rounded-2xl border bg-white p-4 text-slate-600">
            لا يوجد مستخدمون.
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((p) => {
              const avatarUrl = getPublicUrlFromClinic(p.avatar_path);
              return (
                <Link
                  key={p.id}
                  href={`/u/${p.username}`}
                  className="block rounded-2xl border bg-white p-4 hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full overflow-hidden bg-slate-200">
                      {avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatarUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : null}
                    </div>

                    <div>
                      <div className="text-sm font-semibold">
                        {p.full_name || "بدون اسم"}
                      </div>
                      <div className="text-xs text-slate-500">
                        @{p.username} {p.is_doctor ? "• طبيب" : "• مريض"}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
