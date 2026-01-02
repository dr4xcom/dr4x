"use client";



import React, { useEffect, useMemo, useRef, useState } from "react";

import { useParams, useRouter } from "next/navigation";

import { supabase } from "@/utils/supabase/client";



import AppShell from "@/components/layout/AppShell";

import ImageLightbox from "@/components/media/ImageLightbox";

import PostCard from "@/components/posts/PostCard";



import { Home, Search, Stethoscope, Mail, Bell, Image as ImageIcon } from "lucide-react";



import {

  EngagementRow,

  FollowRow,

  PostRow,

  ProfileMini,

  ReplyRow,

} from "@/lib/postsFeed/utils";



/* =========================

   Sidebar Button

   ========================= */

function SidebarButton({

  icon,

  label,

  active,

  onClick,

}: {

  icon: React.ReactNode;

  label: string;

  active?: boolean;

  onClick?: () => void;

}) {

  return (

    <button

      type="button"

      onClick={onClick}

      className={[

        "w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-base",

        "hover:bg-slate-50 transition",

        active ? "font-semibold" : "font-medium text-slate-800",

      ].join(" ")}

    >

      <span className="text-xl leading-none">{icon}</span>

      <span className="flex-1 text-start">{label}</span>

    </button>

  );

}



/* =========================

   Types

   ========================= */

type ProfileLite = {

  full_name: string | null;

  username: string | null;

  email: string | null;

};



/* =========================

   Sidebar (مثل الهوم)

   ========================= */

function SidebarDetails({ onOpenComposer }: { onOpenComposer: () => void }) {

  const router = useRouter();

  const menuRef = useRef<HTMLDivElement | null>(null);



  const [profile, setProfile] = useState<ProfileLite>({

    full_name: null,

    username: null,

    email: null,

  });



  const [menuOpen, setMenuOpen] = useState(false);



  useEffect(() => {

    let mounted = true;



    async function loadProfile() {

      const {

        data: { user },

      } = await supabase.auth.getUser();



      if (!mounted) return;



      if (!user) {

        setProfile({ full_name: null, username: null, email: null });

        return;

      }



      const { data } = await supabase

        .from("profiles")

        .select("full_name, username")

        .eq("id", user.id)

        .maybeSingle();



      if (!mounted) return;



      setProfile({

        full_name: data?.full_name ?? null,

        username: data?.username ?? null,

        email: user.email ?? null,

      });

    }



    loadProfile();



    return () => {

      mounted = false;

    };

  }, []);



  useEffect(() => {

    function onClick(e: MouseEvent) {

      if (!menuOpen) return;

      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {

        setMenuOpen(false);

      }

    }

    function onKey(e: KeyboardEvent) {

      if (e.key === "Escape") setMenuOpen(false);

    }



    document.addEventListener("mousedown", onClick);

    document.addEventListener("keydown", onKey);

    return () => {

      document.removeEventListener("mousedown", onClick);

      document.removeEventListener("keydown", onKey);

    };

  }, [menuOpen]);



  const displayName =

    profile.full_name?.trim() ||

    profile.username?.trim() ||

    profile.email?.split("@")[0] ||

    "مستخدم";



  const handle =

    profile.username?.trim() || (profile.email ? profile.email.split("@")[0] : "");



  const initials = (() => {

    const s = displayName.trim();

    return ((s[0] ?? "D") + (s[1] ?? "R")).toUpperCase();

  })();



  async function handleLogout() {

    await supabase.auth.signOut();

    router.push("/auth/login");

  }



  return (

    <nav className="space-y-2">

      <SidebarButton

        icon={<Home className="h-5 w-5" />}

        label="الرئيسية"

        onClick={() => router.push("/home")}

      />

      <SidebarButton icon={<Search className="h-5 w-5" />} label="التخصصات" />

      <SidebarButton icon={<Stethoscope className="h-5 w-5" />} label="الأطباء" />

      <SidebarButton icon={<Bell className="h-5 w-5" />} label="التنبيهات" />

      <SidebarButton icon={<Mail className="h-5 w-5" />} label="الرسائل" />



      <div className="pt-4">

        <button

          onClick={onOpenComposer}

          className="w-full rounded-full bg-slate-900 text-white py-3 font-semibold hover:opacity-95 transition"

        >

          نشر

        </button>



        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl px-2 py-2 hover:bg-slate-50 transition">

          <div className="flex items-center gap-3 min-w-0">

            <div className="h-10 w-10 rounded-full bg-slate-900 text-white grid place-items-center text-sm font-bold">

              {initials}

            </div>



            <div className="min-w-0">

              <div className="text-sm font-semibold truncate">{displayName}</div>

              {handle ? (

                <div className="text-xs text-slate-500 truncate">@{handle}</div>

              ) : null}

            </div>

          </div>



          <div className="relative" ref={menuRef}>

            <button

              type="button"

              onClick={() => setMenuOpen((v) => !v)}

              className="rounded-full px-2 py-1 text-slate-500 hover:bg-slate-100"

            >

              …

            </button>



            {menuOpen ? (

              <div className="absolute end-0 bottom-full mb-2 w-44 rounded-2xl border bg-white shadow-lg overflow-hidden">

                <button

                  type="button"

                  onClick={() => {

                    setMenuOpen(false);

                    router.push("/profile");

                  }}

                  className="w-full text-start px-3 py-3 text-sm hover:bg-slate-50"

                >

                  ملفي الشخصي

                </button>



                <button

                  type="button"

                  onClick={() => {

                    setMenuOpen(false);

                    router.push("/settings");

                  }}

                  className="w-full text-start px-4 py-3 text-sm hover:bg-slate-50"

                >

                  الإعدادات

                </button>



                <button

                  type="button"

                  onClick={() => {

                    setMenuOpen(false);

                    handleLogout();

                  }}

                  className="w-full text-start px-4 py-3 text-sm text-red-600 hover:bg-slate-50"

                >

                  خروج

                </button>

              </div>

            ) : null}

          </div>

        </div>

      </div>

    </nav>

  );

}



/* =========================

   Right Panel (مثل الهوم)

   ========================= */

function RightPanelMock() {

  return (

    <div className="space-y-4">

      <div className="dr4x-card p-3 bg-white">

        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2">

          <Search className="h-5 w-5 text-slate-400" />

          <input

            type="text"

            placeholder="بحث"

            className="w-full bg-transparent outline-none text-sm placeholder:text-slate-400"

          />

        </div>

      </div>



      <div className="dr4x-card p-4">

        <div className="font-semibold mb-2">ماذا تقدم DR4X؟</div>

        <p className="text-sm text-slate-600">

          منصة طبية مستوحاة من تويتر لكنها مخصصة للاستشارات الطبية ومتابعة المرضى.

        </p>

      </div>



      <div className="dr4x-card p-4">

        <div className="font-semibold mb-2">أقسام شائعة</div>

        <ul className="text-sm text-slate-700 space-y-2">

          <li className="text-blue-600 cursor-pointer">استشارات نفسية</li>

          <li className="text-blue-600 cursor-pointer">أمراض الباطنة</li>

          <li className="text-blue-600 cursor-pointer">طب الأسرة</li>

          <li className="text-blue-600 cursor-pointer">جلدية وتجميل</li>

        </ul>

      </div>

    </div>

  );

}



export default function PostDetailsClient({ postId }: { postId?: string }) {

  const router = useRouter();



  // ✅ التقط البراميتر بأي اسم (id أو postId) حسب اسم مجلد الراوت عندك

  const params = useParams() as Record<string, string | string[] | undefined>;

  const paramId =

    (typeof params?.id === "string" ? params.id : "") ||

    (typeof params?.postId === "string" ? params.postId : "") ||

    (typeof params?.post_id === "string" ? params.post_id : "");



  const effectiveId = String(postId ?? paramId ?? "").trim();



  const numericPostId = useMemo(() => {

    const n = Number(effectiveId);

    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;

  }, [effectiveId]);



  const [post, setPost] = useState<PostRow | null>(null);

  const [profilesById, setProfilesById] = useState<Record<string, ProfileMini>>({});

  const [loading, setLoading] = useState(true);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);



  const [openReplyFor, setOpenReplyFor] = useState<number | null>(null);

  const [repliesByPostId, setRepliesByPostId] = useState<Record<number, ReplyRow[]>>({});

  const [loadingRepliesFor, setLoadingRepliesFor] = useState<number | null>(null);



  const [meId, setMeId] = useState<string | null>(null);



  const [likeCountByPost, setLikeCountByPost] = useState<Record<number, number>>({});

  const [retweetCountByPost, setRetweetCountByPost] = useState<Record<number, number>>({});

  const [iLiked, setILiked] = useState<Record<number, boolean>>({});

  const [iRetweeted, setIRetweeted] = useState<Record<number, boolean>>({});

  const [iBookmarked, setIBookmarked] = useState<Record<number, boolean>>({});



  const [replyCountByPost, setReplyCountByPost] = useState<Record<number, number>>({});



  const [iFollow, setIFollow] = useState<Record<string, boolean>>({});

  const [followBusy, setFollowBusy] = useState<Record<string, boolean>>({});



  const [shareOpen, setShareOpen] = useState<Record<number, boolean>>({});

  const [menuOpen, setMenuOpen] = useState<Record<number, boolean>>({});

  const [replyMenuOpen, setReplyMenuOpen] = useState<Record<number, boolean>>({});



  // ✅ Lightbox

  const [lbOpen, setLbOpen] = useState(false);

  const [lbImages, setLbImages] = useState<string[]>([]);

  const [lbIndex, setLbIndex] = useState(0);



  function openLightbox(images: string[], index: number) {

    const safe = (images || []).filter((x) => typeof x === "string" && x.trim());

    if (safe.length === 0) return;

    setLbImages(safe);

    setLbIndex(Math.max(0, Math.min(index, safe.length - 1)));

    setLbOpen(true);

  }



  async function loadMe(): Promise<string | null> {

    const { data: { user } } = await supabase.auth.getUser();

    const id = user?.id ?? null;

    setMeId(id);

    return id;

  }



  async function ensureProfilesLoaded(userIds: string[]) {

    const missing = userIds.filter((id) => id && !profilesById[id]);

    if (missing.length === 0) return;



    const { data: profData } = await supabase.from("profiles").select("*").in("id", missing);



    if (profData?.length) {

      setProfilesById((prev) => {

        const next = { ...prev };

        profData.forEach((p: any) => {

          next[p.id] = {

            id: p.id,

            full_name: p.full_name ?? null,

            username: p.username ?? null,

            avatar_url: p.avatar_url ?? null,

            avatar: p.avatar ?? null,

            avatar_path: p.avatar_path ?? null,

            is_verified: p.is_verified ?? null,

            verified: p.verified ?? null,

          };

        });

        return next;

      });

    }

  }



  async function loadReplies(pid: number) {

    setLoadingRepliesFor(pid);



    const { data, error } = await supabase

      .from("replies")

      .select("id, post_id, user_id, content, created_at, image_urls, youtube_url")

      .eq("post_id", pid)

      .order("created_at", { ascending: false })

      .limit(200);



    setLoadingRepliesFor(null);



    if (error) {

      console.error(error);

      alert(`فشل تحميل الردود: ${error.message}`);

      return;

    }



    const rows = (data ?? []) as ReplyRow[];



    setRepliesByPostId((prev) => ({ ...prev, [pid]: rows }));

    setReplyCountByPost((prev) => ({ ...prev, [pid]: rows.length }));



    const ids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));

    await ensureProfilesLoaded(ids);

  }



  function toggleReply(pid: number) {

    setOpenReplyFor((cur) => (cur === pid ? null : pid));

    if (!repliesByPostId[pid]) void loadReplies(pid);

  }



  async function loadReplyCountsForPost(pid: number) {

    const { data } = await supabase.from("replies").select("post_id").eq("post_id", pid);

    const count = (data ?? []).length;

    setReplyCountByPost({ [pid]: count });

  }



  async function loadEngagementsForPost(pid: number, currentMeId: string | null) {

    const { data, error } = await supabase

      .from("engagements")

      .select("id, post_id, user_id, type, created_at")

      .eq("post_id", pid);



    if (error) return;



    const rows = (data ?? []) as EngagementRow[];



    const likeCounts: Record<number, number> = {};

    const rtCounts: Record<number, number> = {};

    const likedByMe: Record<number, boolean> = {};

    const rtByMe: Record<number, boolean> = {};

    const bookmarkedByMe: Record<number, boolean> = {};



    rows.forEach((r) => {

      const t = (r.type || "").toLowerCase();

      if (t === "like") likeCounts[pid] = (likeCounts[pid] ?? 0) + 1;

      if (t === "retweet") rtCounts[pid] = (rtCounts[pid] ?? 0) + 1;



      if (currentMeId && r.user_id === currentMeId) {

        if (t === "like") likedByMe[pid] = true;

        if (t === "retweet") rtByMe[pid] = true;

        if (t === "bookmark") bookmarkedByMe[pid] = true;

      }

    });



    setLikeCountByPost(likeCounts);

    setRetweetCountByPost(rtCounts);

    setILiked(likedByMe);

    setIRetweeted(rtByMe);

    setIBookmarked(bookmarkedByMe);

  }



  async function loadFollowStateForAuthor(authorId: string, currentMeId: string | null) {

    if (!currentMeId) return;

    if (!authorId || authorId === currentMeId) return;



    const { data, error } = await supabase

      .from("followers")

      .select("follower_id, followed_id, created_at")

      .eq("follower_id", currentMeId)

      .eq("followed_id", authorId);



    if (error) return;



    const map: Record<string, boolean> = {};

    (data ?? []).forEach((r: any) => (map[r.followed_id] = true));

    setIFollow(map);

  }



  async function toggleLike(pid: number) {

    if (!meId) return alert("يجب تسجيل الدخول");

    const already = !!iLiked[pid];



    if (already) {

      const { error } = await supabase

        .from("engagements")

        .delete()

        .eq("post_id", pid)

        .eq("user_id", meId)

        .eq("type", "like");



      if (error) return alert(error.message);



      setILiked((prev) => ({ ...prev, [pid]: false }));

      setLikeCountByPost((prev) => ({ ...prev, [pid]: Math.max(0, (prev[pid] ?? 0) - 1) }));

      return;

    }



    const { error } = await supabase.from("engagements").insert({

      post_id: pid,

      user_id: meId,

      type: "like",

    });



    if (error) return alert(error.message);



    setILiked((prev) => ({ ...prev, [pid]: true }));

    setLikeCountByPost((prev) => ({ ...prev, [pid]: (prev[pid] ?? 0) + 1 }));

  }



  async function toggleRetweet(pid: number) {

    if (!meId) return alert("يجب تسجيل الدخول");

    const already = !!iRetweeted[pid];



    if (already) {

      const { error } = await supabase

        .from("engagements")

        .delete()

        .eq("post_id", pid)

        .eq("user_id", meId)

        .eq("type", "retweet");



      if (error) return alert(error.message);



      setIRetweeted((prev) => ({ ...prev, [pid]: false }));

      setRetweetCountByPost((prev) => ({ ...prev, [pid]: Math.max(0, (prev[pid] ?? 0) - 1) }));

      return;

    }



    const { error } = await supabase.from("engagements").insert({

      post_id: pid,

      user_id: meId,

      type: "retweet",

    });



    if (error) return alert(error.message);



    setIRetweeted((prev) => ({ ...prev, [pid]: true }));

    setRetweetCountByPost((prev) => ({ ...prev, [pid]: (prev[pid] ?? 0) + 1 }));

  }



  async function toggleBookmark(pid: number) {

    if (!meId) return alert("يجب تسجيل الدخول");

    const already = !!iBookmarked[pid];



    if (already) {

      const { error } = await supabase

        .from("engagements")

        .delete()

        .eq("post_id", pid)

        .eq("user_id", meId)

        .eq("type", "bookmark");



      if (error) return alert(error.message);



      setIBookmarked((p) => ({ ...p, [pid]: false }));

      return;

    }



    const { error } = await supabase.from("engagements").insert({

      post_id: pid,

      user_id: meId,

      type: "bookmark",

    });



    if (error) return alert(error.message);



    setIBookmarked((p) => ({ ...p, [pid]: true }));

  }



  async function toggleFollow(authorId: string) {

    if (!meId) return alert("يجب تسجيل الدخول");

    if (!authorId || authorId === meId) return;



    setFollowBusy((p) => ({ ...p, [authorId]: true }));

    const already = !!iFollow[authorId];



    if (already) {

      const { error } = await supabase

        .from("followers")

        .delete()

        .eq("follower_id", meId)

        .eq("followed_id", authorId);



      setFollowBusy((p) => ({ ...p, [authorId]: false }));

      if (error) return alert(error.message);



      setIFollow((p) => ({ ...p, [authorId]: false }));

      return;

    }



    const { error } = await supabase.from("followers").insert({

      follower_id: meId,

      followed_id: authorId,

    });



    setFollowBusy((p) => ({ ...p, [authorId]: false }));

    if (error) return alert(error.message);



    setIFollow((p) => ({ ...p, [authorId]: true }));

  }



  function getPostLink(pid: number) {

    if (typeof window === "undefined") return `/post/${pid}`;

    return `${window.location.origin}/post/${pid}`;

  }



  async function copyLink(pid: number) {

    const link = getPostLink(pid);

    try {

      await navigator.clipboard.writeText(link);

      alert("تم نسخ الرابط ✅");

    } catch {

      window.prompt("انسخ الرابط:", link);

    }

  }



  function shareWhatsApp(pid: number) {

    const link = getPostLink(pid);

    window.open(`https://wa.me/?text=${encodeURIComponent(link)}`, "_blank", "noopener,noreferrer");

  }



  function shareEmail(pid: number) {

    const link = getPostLink(pid);

    window.location.href = `mailto:?subject=${encodeURIComponent("DR4X Post")}&body=${encodeURIComponent(link)}`;

  }



  async function deletePost(pid: number) {

    if (!meId) return alert("يجب تسجيل الدخول");

    const ok = confirm("هل تريد حذف التغريدة؟");

    if (!ok) return;



    const res = await fetch(`/api/posts/${pid}/delete`, { method: "DELETE" });

    const body = await res.json().catch(() => ({} as any));

    if (!res.ok) return alert(body?.error ?? "فشل الحذف");



    router.back();

  }



  async function editPost(pid: number, current: string | null) {

    if (!meId) return alert("يجب تسجيل الدخول");



    const next = window.prompt("تعديل التغريدة:", current ?? "");

    if (next === null) return;



    const text = next.trim();

    if (!text) return alert("لا يمكن حفظ تغريدة فارغة");



    const { error } = await supabase.from("posts").update({ content: text }).eq("id", pid);

    if (error) return alert(error.message);



    setPost((prev) => (prev ? { ...prev, content: text } : prev));

  }



  async function deleteReply(replyId: number, pid: number) {

    if (!meId) return alert("يجب تسجيل الدخول");



    const ok = confirm("هل تريد حذف الرد؟");

    if (!ok) return;



    const { error } = await supabase.from("replies").delete().eq("id", replyId);

    if (error) return alert(error.message);



    setRepliesByPostId((prev) => {

      const rows = prev[pid] ?? [];

      return { ...prev, [pid]: rows.filter((r) => r.id !== replyId) };

    });



    setReplyCountByPost((prev) => ({ ...prev, [pid]: Math.max(0, (prev[pid] ?? 0) - 1) }));

  }



  async function editReply(replyId: number, pid: number, current: string | null) {

    if (!meId) return alert("يجب تسجيل الدخول");



    const next = window.prompt("تعديل الرد:", current ?? "");

    if (next === null) return;



    const text = next.trim();

    if (!text) return alert("لا يمكن حفظ رد فارغ");



    const { error } = await supabase.from("replies").update({ content: text }).eq("id", replyId);

    if (error) return alert(error.message);



    setRepliesByPostId((prev) => {

      const rows = prev[pid] ?? [];

      return {

        ...prev,

        [pid]: rows.map((r) => (r.id === replyId ? { ...r, content: text } : r)),

      };

    });

  }



  // ✅ تحميل البيانات + زيادة المشاهدات

  useEffect(() => {

    let mounted = true;



    (async () => {

      if (!mounted) return;



      if (!numericPostId) {

        setLoading(false);

        setErrorMsg("معرّف التغريدة غير صحيح");

        return;

      }



      setLoading(true);

      setErrorMsg(null);



      const currentMeId = await loadMe();

      if (!mounted) return;



      const { data: postData, error: postErr } = await supabase

        .from("posts")

        .select("id, author_id, content, image_paths, video_urls, is_retweet, original_post_id, view_count, created_at")

        .eq("id", numericPostId)

        .maybeSingle();



      if (!mounted) return;



      if (postErr || !postData) {

        setLoading(false);

        setErrorMsg("لم يتم العثور على التغريدة");

        return;

      }



      const p = postData as PostRow;

      setPost(p);



      // ✅ زيادة المشاهدات عبر API (مرة لكل 30 دقيقة)

      try {

        const key = `dr4x_viewed_post_${p.id}`;

        const now = Date.now();

        const last = Number(localStorage.getItem(key) || "0");

        const thirtyMin = 30 * 60 * 1000;



        if (!last || now - last > thirtyMin) {

          localStorage.setItem(key, String(now));



          const res = await fetch(`/api/posts/${p.id}/view`, { method: "POST" });

          const body = await res.json().catch(() => ({} as any));



          if (res.ok && typeof body.view_count === "number") {

            setPost((prev) => (prev ? { ...prev, view_count: body.view_count } : prev));

          }

        }

      } catch {}



      const { data: profData } = await supabase

        .from("profiles")

        .select("*")

        .eq("id", p.author_id)

        .maybeSingle();



      if (!mounted) return;



      if (profData) {

        setProfilesById({

          [profData.id]: {

            id: profData.id,

            full_name: profData.full_name ?? null,

            username: profData.username ?? null,

            avatar_url: profData.avatar_url ?? null,

            avatar: profData.avatar ?? null,

            avatar_path: profData.avatar_path ?? null,

            is_verified: profData.is_verified ?? null,

            verified: profData.verified ?? null,

          },

        });

      }



      await loadEngagementsForPost(p.id, currentMeId);

      await loadFollowStateForAuthor(p.author_id, currentMeId);

      await loadReplyCountsForPost(p.id);



      setOpenReplyFor(p.id);

      await loadReplies(p.id);



      setLoading(false);

    })();



    return () => {

      mounted = false;

    };

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [numericPostId]);



  // ✅ Composer Dummy

  const [composerOpen, setComposerOpen] = useState(false);

  function ComposerDummy() {

    const [content, setContent] = useState("");

    const [busy, setBusy] = useState(false);



    async function handlePost() {

      if (!content.trim() || busy) return;

      setBusy(true);



      const { data } = await supabase.auth.getUser();

      if (!data?.user) {

        setBusy(false);

        alert("يجب تسجيل الدخول");

        return;

      }



      const { error } = await supabase.from("posts").insert({

        author_id: data.user.id,

        content: content.trim(),

        image_paths: [],

        video_urls: [],

        is_retweet: false,

        original_post_id: null,

        view_count: 0,

      });



      setBusy(false);



      if (error) return alert(error.message);

      setContent("");

      setComposerOpen(false);

      router.push("/home");

    }



    if (!composerOpen) return null;

    return (

      <div className="mb-3 dr4x-card p-4">

        <textarea

          value={content}

          onChange={(e) => setContent(e.target.value)}

          placeholder="ماذا يحدث؟"

          className="w-full resize-none outline-none text-sm min-h-[80px]"

        />

        <div className="flex justify-between mt-3">

          <ImageIcon className="h-5 w-5 text-slate-500" />

          <button

            onClick={handlePost}

            className="rounded-full bg-slate-900 text-white px-4 py-2 text-sm font-semibold"

          >

            {busy ? "جارٍ النشر..." : "نشر"}

          </button>

        </div>

      </div>

    );

  }



  return (

    <AppShell

      sidebar={<SidebarDetails onOpenComposer={() => setComposerOpen(true)} />}

      header={

        <div className="flex items-center gap-2">

          <button

            type="button"

            onClick={() => router.back()}

            className="inline-flex items-center justify-center rounded-full w-9 h-9 hover:bg-slate-100"

            title="رجوع"

          >

            ←

          </button>

          <div>التغريدة</div>

        </div>

      }

      rightPanel={<RightPanelMock />}

    >

      <div className="space-y-3">

        <ImageLightbox

          open={lbOpen}

          images={lbImages}

          index={lbIndex}

          onClose={() => setLbOpen(false)}

          onIndexChange={(n) => setLbIndex(n)}

        />



        <ComposerDummy />



        {loading ? <div className="text-sm text-slate-600">جاري تحميل التغريدة...</div> : null}

        {errorMsg ? <div className="text-sm text-red-600">{errorMsg}</div> : null}



        {post ? (

          <PostCard

            post={post}

            prof={profilesById[post.author_id]}

            meId={meId}

            isOpen={openReplyFor === post.id}

            replies={repliesByPostId[post.id] ?? []}

            likeCount={likeCountByPost[post.id] ?? 0}

            retweetCount={retweetCountByPost[post.id] ?? 0}

            liked={!!iLiked[post.id]}

            retweeted={!!iRetweeted[post.id]}

            replyCount={replyCountByPost[post.id] ?? 0}

            following={!!iFollow[post.author_id]}

            busyFollow={!!followBusy[post.author_id]}

            menuOpen={menuOpen}

            setMenuOpen={setMenuOpen}

            shareOpen={shareOpen}

            setShareOpen={setShareOpen}

            replyMenuOpen={replyMenuOpen}

            setReplyMenuOpen={setReplyMenuOpen}

            iBookmarked={iBookmarked}

            toggleReply={toggleReply}

            toggleFollow={toggleFollow}

            toggleRetweet={toggleRetweet}

            toggleLike={toggleLike}

            toggleBookmark={toggleBookmark}

            shareWhatsApp={shareWhatsApp}

            shareEmail={shareEmail}

            copyLink={copyLink}

            editPost={editPost}

            deletePost={deletePost}

            editReply={(replyId, pid, current) => void editReply(replyId, pid, current)}

            deleteReply={(replyId, pid) => deleteReply(replyId, pid)}

            loadReplies={loadReplies}

            onPostedReply={async (pid) => {

              await loadReplies(pid);

              setOpenReplyFor(null);

              setReplyCountByPost((prev) => ({ ...prev, [pid]: (prev[pid] ?? 0) + 1 }));

            }}

            openLightbox={openLightbox}

            profilesById={profilesById}

            loadingRepliesFor={loadingRepliesFor}

            setOpenReplyFor={setOpenReplyFor}

            onOpenDetails={() => {}}

            mode="details"

          />

        ) : null}

      </div>

    </AppShell>

  );

} 