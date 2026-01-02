// src/app/u/[username]/following/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

type FollowingProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
};

export default function FollowingPage() {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const username = params.username;

  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState<FollowingProfile[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!username) return;

    const loadFollowing = async () => {
      setLoading(true);
      setError(null);

      // المستخدم الحالي
      const { data: uRes } = await supabase.auth.getUser();
      const meId = uRes?.user?.id ?? null;

      // صاحب الحساب مع إعداد الخصوصية
      const { data: owner, error: ownerError } = await supabase
        .from("profiles")
        .select("id, show_following_list")
        .eq("username", username)
        .single();

      if (ownerError || !owner) {
        setError("المستخدم غير موجود");
        setLoading(false);
        return;
      }

      const isOwner = meId && meId === owner.id;
      const hidden = owner.show_following_list === false;

      // لو القائمة خاصة والزائر مو صاحب الحساب → نوقف هنا
      if (hidden && !isOwner) {
        setError("صاحب هذا الحساب جعل قائمة الذين يتابعهم خاصة.");
        setLoading(false);
        return;
      }

      // باقي الخطوات نفسها
      const { data: list, error: listError } = await supabase
        .from("followers")
        .select("followed_id")
        .eq("follower_id", owner.id);

      if (listError) {
        console.error("followers list error:", listError);
        setError("فشل تحميل قائمة الذين يتابعهم المستخدم");
        setLoading(false);
        return;
      }

      const ids: string[] =
        list?.map((row: any) => row.followed_id).filter(Boolean) ?? [];

      if (ids.length === 0) {
        setFollowing([]);
        setLoading(false);
        return;
      }

      const result: FollowingProfile[] = [];

      for (const id of ids) {
        const { data: prof, error: profErr } = await supabase
          .from("profiles")
          .select("id, username, full_name")
          .eq("id", id)
          .maybeSingle();

        if (profErr) {
          console.error("profile load error for following:", profErr);
          continue;
        }
        if (prof) {
          result.push(prof as FollowingProfile);
        }
      }

      setFollowing(result);
      setLoading(false);
    };

    loadFollowing();
  }, [username]);

  return (
    <div className="min-h-screen bg-slate-950 text-emerald-300">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="text-xs sm:text-sm px-4 py-2 rounded-full border border-emerald-500/70 bg-slate-900 hover:bg-slate-900/80 hover:border-emerald-400 transition"
          >
            ← رجوع
          </button>

          <div className="text-[10px] sm:text-xs font-mono text-emerald-400/80">
            DR4X // FOLLOWING_VIEW
          </div>
        </div>

        <div className="mb-6 border border-emerald-500/40 rounded-2xl bg-slate-950/70 px-5 py-4 shadow-[0_0_25px_rgba(16,185,129,0.25)]">
          <div className="text-xs font-mono text-emerald-400/80 mb-1">
            &gt; PROFILE / @{username}
          </div>
          <h1 className="text-2xl font-extrabold text-emerald-300">
            الذين يتابعهم
          </h1>
        </div>

        {loading && (
          <div className="text-center text-sm text-emerald-300/70 py-10 font-mono">
            LOADING_FOLLOWING...
          </div>
        )}

        {error && (
          <div className="text-center text-sm text-red-400 py-10 font-mono">
            ERROR: {error}
          </div>
        )}

        {!loading && !error && following.length === 0 && (
          <div className="text-center text-sm text-emerald-300/60 py-10 font-mono">
            NO_FOLLOWING_FOUND
          </div>
        )}

        <ul className="space-y-4">
          {following.map((user) => (
            <li
              key={user.id}
              className="relative overflow-hidden rounded-2xl border border-emerald-500/40 bg-slate-950/80 hover:bg-slate-900/80 transition shadow-[0_0_18px_rgba(16,185,129,0.15)]"
            >
              <div className="absolute inset-y-0 right-0 w-[2px] bg-gradient-to-b from-emerald-400 via-emerald-500 to-transparent" />

              <div className="flex items-center gap-4 px-4 py-3">
                <div className="w-12 h-12 rounded-full bg-slate-900 border border-emerald-500/60 flex items-center justify-center text-xs text-emerald-300 font-mono shadow-[0_0_15px_rgba(16,185,129,0.35)]">
                  {(user.full_name ?? user.username ?? "?")
                    .toString()
                    .slice(0, 2)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate text-emerald-100">
                    {user.full_name || "بدون اسم"}
                  </div>
                  <div className="text-xs text-emerald-400/80 truncate font-mono">
                    @{user.username}
                  </div>
                </div>

                <button
                  onClick={() => router.push(`/u/${user.username}`)}
                  className="text-xs sm:text-sm font-mono px-3 py-1.5 rounded-full border border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/10 transition"
                >
                  OPEN_PROFILE
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
