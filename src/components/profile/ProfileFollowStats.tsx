"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";

type Props = {
  username: string;
};

type CountsState = {
  followers: number;
  following: number;
};

export default function ProfileFollowStats({ username }: Props) {
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<CountsState>({
    followers: 0,
    following: 0,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!username) return;

    const loadCounts = async () => {
      setLoading(true);
      setError(null);

      // 1) جلب صاحب الحساب
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .single();

      if (profileError || !profile) {
        setError("لم يتم العثور على المستخدم");
        setLoading(false);
        return;
      }

      const profileId = profile.id;

      // 2) عدد المتابعين
      const { count: followersCount, error: followersError } = await supabase
        .from("followers")
        .select("*", { count: "exact", head: true })
        .eq("followed_id", profileId);

      if (followersError) {
        setError("تعذر تحميل عدد المتابعين");
        setLoading(false);
        return;
      }

      // 3) عدد الذين يتابعهم
      const { count: followingCount, error: followingError } = await supabase
        .from("followers")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", profileId);

      if (followingError) {
        setError("تعذر تحميل عدد الذين يتابعهم المستخدم");
        setLoading(false);
        return;
      }

      setCounts({
        followers: followersCount ?? 0,
        following: followingCount ?? 0,
      });

      setLoading(false);
    };

    loadCounts();
  }, [username]);

  if (error) {
    return (
      <div className="mt-4 text-xs text-red-600 text-center">
        {error}
      </div>
    );
  }

  return (
    <div className="mt-4 flex items-center gap-4 text-sm">
      {/* المتابعون */}
      <a
        href={`/u/${username}/followers`}
        className="flex items-center gap-1 hover:underline cursor-pointer"
      >
        <span className="font-semibold">
          {loading ? "…" : counts.followers}
        </span>
        <span className="text-slate-200">المتابعون</span>
      </a>

      {/* الذين يتابعهم */}
      <a
        href={`/u/${username}/following`}
        className="flex items-center gap-1 hover:underline cursor-pointer"
      >
        <span className="font-semibold">
          {loading ? "…" : counts.following}
        </span>
        <span className="text-slate-200">الذين يتابعهم</span>
      </a>
    </div>
  );
}
