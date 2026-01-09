"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";

const COUNTRIES = [
  "السعودية",
  "الإمارات",
  "الكويت",
  "قطر",
  "البحرين",
  "عُمان",
  "مصر",
  "الأردن",
  "فلسطين",
  "لبنان",
  "سوريا",
  "العراق",
  "اليمن",
  "السودان",
  "المغرب",
  "الجزائر",
  "تونس",
  "ليبيا",
  "تركيا",
  "أخرى",
] as const;

const SITE_ASSETS_BUCKET = "site_assets";
const PROFILE_CENTER_GIF_PATH = "profile-center/global.gif";

export default function PatientRegisterPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [country, setCountry] =
    useState<(typeof COUNTRIES)[number]>("السعودية");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [whatsappNumber, setWhatsappNumber] = useState("");

  const [gifUrl, setGifUrl] = useState<string>("");

  useEffect(() => {
    const { data } = supabase.storage
      .from(SITE_ASSETS_BUCKET)
      .getPublicUrl(PROFILE_CENTER_GIF_PATH);
    setGifUrl(data?.publicUrl || "");
  }, []);

  function validate() {
    if (!fullName.trim()) return "اكتب الاسم الكامل.";
    if (!username.trim()) return "اكتب اسم المستخدم.";
    if (!email.trim()) return "اكتب البريد الإلكتروني.";
    if (!password || password.length < 6)
      return "كلمة المرور يجب أن تكون 6 أحرف على الأقل.";
    return null;
  }

  async function onSubmit() {
    setErr(null);
    setMsg(null);

    const v = validate();
    if (v) return setErr(v);

    setLoading(true);
    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/confirm`
          : undefined;

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            full_name: fullName.trim(),
            username: username.trim(),
            role: "patient",
          },
        },
      });

      if (error) throw error;

      const uid = data.user?.id;
      if (!uid) throw new Error("لم يتم إنشاء المستخدم.");

      const payload: any = {
        uid,
        mode: "patient",
        profile: {
          id: uid,
          full_name: fullName.trim(),
          username: username.trim(),
          email: email.trim(),
          is_doctor: false,
          whatsapp_number: whatsappNumber.trim() || null,
          country,
        },
        patient: {
          nationality: country,
          gender,
        },
      };

      const res = await fetch("/api/auth/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok)
        throw new Error(json?.error || "فشل إنشاء الحساب.");

      setMsg("تم إنشاء الحساب ✅ راجع بريدك للتفعيل.");
      setTimeout(() => router.push("/auth/login"), 900);
    } catch (e: any) {
      setErr(e?.message || "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  const hackerBg = useMemo(
    () =>
      "relative min-h-[100dvh] bg-slate-950 text-slate-100 flex items-center justify-center px-4 py-10",
    []
  );

  return (
    <div className={hackerBg}>
      <div className="relative w-full max-w-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs tracking-[0.3em] text-emerald-300 font-mono">
              DR4X SECURE REGISTER
            </div>
            <div className="text-2xl font-extrabold">إنشاء حساب مريض</div>
          </div>

          <Link
            href="/auth/login"
            className="rounded-full border border-emerald-500/60 bg-slate-900/80 px-4 py-2 text-sm font-bold text-emerald-200"
          >
            دخول
          </Link>
        </div>

        <div className="rounded-3xl border border-emerald-500/50 bg-slate-900/70">
          <div className="p-4 space-y-4">
            {gifUrl && (
              <img
                src={gifUrl}
                alt="Profile"
                className="mx-auto h-32 w-full max-w-sm rounded-xl object-cover border border-emerald-500/40"
              />
            )}

            {err && (
              <div className="rounded-xl border border-red-500/50 bg-red-950/40 p-3 text-sm text-red-200">
                {err}
              </div>
            )}

            {msg && (
              <div className="rounded-xl border border-emerald-500/50 bg-emerald-950/40 p-3 text-sm text-emerald-200">
                {msg}
              </div>
            )}

            <Field
              label="الاسم الكامل"
              value={fullName}
              onChange={setFullName}
            />
            <Field
              label="اسم المستخدم"
              value={username}
              onChange={setUsername}
            />
            <Field
              label="البريد الإلكتروني"
              value={email}
              onChange={setEmail}
            />
            <Select
              label="الدولة"
              value={country}
              onChange={setCountry}
              options={COUNTRIES}
            />
            <Select
              label="الجنس"
              value={gender}
              onChange={setGender}
              options={[
                { value: "male", label: "ذكر" },
                { value: "female", label: "أنثى" },
              ]}
            />
            <Field
              label="كلمة المرور"
              value={password}
              onChange={setPassword}
              type="password"
            />
            <Field
              label="واتساب (اختياري)"
              value={whatsappNumber}
              onChange={setWhatsappNumber}
            />

            <button
              onClick={onSubmit}
              disabled={loading}
              className="w-full rounded-2xl bg-emerald-400 px-4 py-3 text-lg font-extrabold text-slate-950 hover:bg-emerald-300"
            >
              {loading ? "جارٍ التسجيل..." : "تسجيل"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-sm font-bold text-emerald-300">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="
          w-full rounded-xl
          border-2 border-emerald-500/60
          bg-slate-800/70
          px-4 py-3
          text-base text-slate-100
          shadow-inner
          outline-none
          focus:border-emerald-400
          focus:ring-2 focus:ring-emerald-400/40
        "
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: any;
  onChange: (v: any) => void;
  options: readonly string[] | { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <div className="mb-1 text-sm font-bold text-emerald-300">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="
          w-full rounded-xl
          border-2 border-emerald-500/60
          bg-slate-800/70
          px-4 py-3
          text-base text-slate-100
          shadow-inner
          outline-none
          focus:border-emerald-400
          focus:ring-2 focus:ring-emerald-400/40
        "
      >
        {options.map((o: any) =>
          typeof o === "string" ? (
            <option key={o} value={o}>
              {o}
            </option>
          ) : (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          )
        )}
      </select>
    </label>
  );
}
