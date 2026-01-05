// src/app/settings/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/utils/supabase/client";

type Language = "ar" | "en" | "tr";
type ProfileVisibility = "public" | "private";
type EmailVisibility = "show" | "hide";
type MessagingPreference = "everyone" | "doctors" | "none";

type SettingsState = {
  language: Language;
  inAppNotifications: boolean;
  emailNotifications: boolean;
  profileVisibility: ProfileVisibility;
  emailVisibility: EmailVisibility;
  messagingPreference: MessagingPreference;
};

const STORAGE_KEY = "dr4x_user_settings";
const LANG_KEY = "dr4x_lang";

function loadInitialSettings(): SettingsState {
  if (typeof window === "undefined") {
    return {
      language: "ar",
      inAppNotifications: true,
      emailNotifications: false,
      profileVisibility: "public",
      emailVisibility: "hide",
      messagingPreference: "everyone",
    };
  }

  try {
    const langRaw = window.localStorage.getItem(LANG_KEY);
    const langFromGlobal =
      langRaw === "ar" || langRaw === "en" || langRaw === "tr"
        ? (langRaw as Language)
        : "ar";

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        language: langFromGlobal,
        inAppNotifications: true,
        emailNotifications: false,
        profileVisibility: "public",
        emailVisibility: "hide",
        messagingPreference: "everyone",
      };
    }

    const parsed = JSON.parse(raw) as Partial<SettingsState>;
    return {
      language: parsed.language ?? langFromGlobal,
      inAppNotifications:
        typeof parsed.inAppNotifications === "boolean"
          ? parsed.inAppNotifications
          : true,
      emailNotifications:
        typeof parsed.emailNotifications === "boolean"
          ? parsed.emailNotifications
          : false,
      profileVisibility: parsed.profileVisibility ?? "public",
      emailVisibility: parsed.emailVisibility ?? "hide",
      messagingPreference: parsed.messagingPreference ?? "everyone",
    };
  } catch {
    return {
      language: "ar",
      inAppNotifications: true,
      emailNotifications: false,
      profileVisibility: "public",
      emailVisibility: "hide",
      messagingPreference: "everyone",
    };
  }
}

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<SettingsState>(() =>
    loadInitialSettings()
  );
  const [saving, setSaving] = useState(false);

  // 🔐 حالة تغيير كلمة المرور
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);

  // حفظ كل الإعدادات في localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // تجاهل أي خطأ في التخزين
    }
  }, [settings]);

  function markSavingShort() {
    setSaving(true);
    setTimeout(() => setSaving(false), 300);
  }

  function updateLanguage(lang: Language) {
    setSettings((prev) => ({ ...prev, language: lang }));
    markSavingShort();

    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(LANG_KEY, lang);
      } catch {
        // نتجاهل لو صار خطأ
      }
      window.location.reload();
    }
  }

  function toggleInAppNotifications() {
    setSettings((prev) => ({
      ...prev,
      inAppNotifications: !prev.inAppNotifications,
    }));
    markSavingShort();
  }

  function toggleEmailNotifications() {
    setSettings((prev) => ({
      ...prev,
      emailNotifications: !prev.emailNotifications,
    }));
    markSavingShort();
  }

  function updateProfileVisibility(value: ProfileVisibility) {
    setSettings((prev) => ({ ...prev, profileVisibility: value }));
    markSavingShort();
  }

  function updateEmailVisibility(value: EmailVisibility) {
    setSettings((prev) => ({ ...prev, emailVisibility: value }));
    markSavingShort();
  }

  function updateMessagingPreference(value: MessagingPreference) {
    setSettings((prev) => ({ ...prev, messagingPreference: value }));
    markSavingShort();
  }

  // 🔐 تغيير كلمة المرور عبر Supabase Auth (بدون جداول جديدة)
  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (pwdSaving) return;

    setPwdError(null);
    setPwdSuccess(null);

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPwdError("الرجاء تعبئة جميع حقول كلمة المرور.");
      return;
    }

    if (newPassword.length < 8) {
      setPwdError("كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPwdError("تأكيد كلمة المرور لا يطابق الجديدة.");
      return;
    }

    setPwdSaving(true);
    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr || !user) {
        setPwdError("يجب تسجيل الدخول أولاً.");
        return;
      }

      const email = user.email;
      if (!email) {
        setPwdError("لا يمكن العثور على البريد الإلكتروني للحساب.");
        return;
      }

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

      if (signInErr) {
        setPwdError("كلمة المرور الحالية غير صحيحة.");
        return;
      }

      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateErr) {
        console.error("update password error", updateErr);
        setPwdError("حدث خطأ أثناء تغيير كلمة المرور.");
        return;
      }

      setPwdSuccess("تم تغيير كلمة المرور بنجاح ✅");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err: any) {
      console.error(err);
      setPwdError("حدث خطأ غير متوقع أثناء تغيير كلمة المرور.");
    } finally {
      setPwdSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 py-8 px-4 sm:px-8 text-slate-100">
      <div className="max-w-3xl mx-auto">
        {/* زر الرجوع (يبقى كما هو تقريباً مع نفس الطابع) */}
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-6 inline-flex items-center rounded-full border border-slate-600 bg-slate-900/80 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800 transition"
        >
          الرجوع
        </button>

        {/* العنوان */}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-center text-slate-50 mb-2">
          الإعدادات
        </h1>
        <p className="text-center text-xs uppercase tracking-[0.25em] text-pink-300 mb-6">
          dr4x // system settings
        </p>

        {/* بطاقة الإعدادات داخل إطار نيون بمبي رفيع جداً */}
        <div className="rounded-3xl p-[1px] bg-pink-400/70 shadow-[0_0_35px_rgba(244,114,182,0.35)]">
          <div className="rounded-3xl bg-slate-950/95 border border-slate-800/80 p-5 sm:p-6 space-y-8">
            {/* أعلى الكارت: شعار + وصف */}
            <div className="flex flex-col items-center mb-2">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-9 w-9 rounded-xl border border-pink-400/60 bg-slate-900/80 grid place-items-center overflow-hidden">
                  <Image
                    src="/dr4x-logo.png"
                    alt="DR4X"
                    width={32}
                    height={32}
                    className="h-7 w-7 object-contain"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-50">
                    DR4X
                  </span>
                  <span className="text-[11px] text-slate-400">
                    لوحة إعدادات الحساب
                  </span>
                </div>
              </div>

              {saving ? (
                <div className="text-[11px] text-amber-300">
                  جاري حفظ الإعدادات في متصفحك…
                </div>
              ) : (
                <div className="text-[11px] text-emerald-300">
                  تم حفظ إعدادات الواجهة والخصوصية والتنبيهات محليًا. تغيير كلمة
                  المرور يتم عبر Supabase Auth فقط.
                </div>
              )}
            </div>

            {/* === اللغة === */}
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-50">
                اللغة (واجهة الموقع)
              </h2>
              <p className="text-[11px] text-slate-400 mb-1">
                اختيار لغة العرض في الواجهة. هذا الإعداد يُحفظ محليًا في متصفحك،
                ويمكن ربطه بنظام الترجمة i18n في DR4X.
              </p>

              <div className="mt-2">
                <select
                  value={settings.language}
                  onChange={(e) => updateLanguage(e.target.value as Language)}
                  className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-400"
                >
                  <option value="ar">العربية</option>
                  <option value="en">English</option>
                  <option value="tr">Türkçe</option>
                </select>
              </div>
            </section>

            <hr className="border-slate-800" />

            {/* === الخصوصية وظهور الحساب === */}
            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-slate-50">
                الخصوصية وظهور الحساب
              </h2>

              {/* حالة الحساب */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-200">
                  حالة الحساب
                </label>
                <p className="text-[11px] text-slate-500 mb-1">
                  عام أو خاص. (إعداد واجهة حالياً، ممكن نربطه لاحقًا بسياسات
                  البروفايل).
                </p>
                <select
                  value={settings.profileVisibility}
                  onChange={(e) =>
                    updateProfileVisibility(e.target.value as ProfileVisibility)
                  }
                  className="mt-1 w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-pink-400"
                >
                  <option value="public">عام (يظهر للجميع)</option>
                  <option value="private">
                    خاص (يظهر فقط للجهات المسموح لها لاحقًا)
                  </option>
                </select>
              </div>

              {/* ظهور البروفايل */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-200">
                  ظهور البروفايل في الموقع
                </label>
                <p className="text-[11px] text-slate-500 mb-1">
                  التحكم في إظهار صفحة البروفايل العامة في نتائج البحث وقوائم
                  الأعضاء (إعداد واجهة فقط حاليًا).
                </p>
                <select
                  value={
                    settings.profileVisibility === "public" ? "show" : "hide"
                  }
                  onChange={(e) =>
                    updateProfileVisibility(
                      e.target.value === "show" ? "public" : "private"
                    )
                  }
                  className="mt-1 w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-pink-400"
                >
                  <option value="show">إظهار البروفايل</option>
                  <option value="hide">إخفاء البروفايل</option>
                </select>
              </div>

              {/* إظهار/إخفاء البريد */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-200">
                  البريد الإلكتروني في صفحة البروفايل
                </label>
                <p className="text-[11px] text-slate-500 mb-1">
                  اختيار ما إذا كان بريدك يظهر للآخرين في صفحة البروفايل أم لا.
                </p>
                <select
                  value={settings.emailVisibility}
                  onChange={(e) =>
                    updateEmailVisibility(e.target.value as EmailVisibility)
                  }
                  className="mt-1 w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-pink-400"
                >
                  <option value="show">إظهار البريد في البروفايل</option>
                  <option value="hide">إخفاء البريد عن الآخرين</option>
                </select>
              </div>

              {/* من يمكنه مراسلتي */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-200">
                  من يمكنه مراسلتك؟
                </label>
                <p className="text-[11px] text-slate-500 mb-1">
                  السماح للجميع، أو الأطباء فقط، أو منع الرسائل. (إعداد واجهة
                  حالياً، نربطه لاحقًا بنظام الرسائل).
                </p>
                <select
                  value={settings.messagingPreference}
                  onChange={(e) =>
                    updateMessagingPreference(
                      e.target.value as MessagingPreference
                    )
                  }
                  className="mt-1 w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-pink-400"
                >
                  <option value="everyone">
                    السماح للمستخدمين والأطباء بمراسلتي
                  </option>
                  <option value="doctors">السماح للأطباء فقط بمراسلتي</option>
                  <option value="none">منع الرسائل تمامًا</option>
                </select>
              </div>
            </section>

            <hr className="border-slate-800" />

            {/* التنبيهات داخل الموقع */}
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-50">
                التنبيهات داخل الموقع
              </h2>
              <p className="text-xs text-slate-400">
                هذا الخيار يتحكم فقط في عرض التنبيهات داخل واجهة DR4X حالياً.
              </p>

              <button
                type="button"
                onClick={toggleInAppNotifications}
                className="mt-2 inline-flex items-center justify-between w-full max-w-xs rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800 transition"
              >
                <span>إظهار التنبيهات داخل الموقع</span>
                <span
                  className={[
                    "inline-flex h-6 w-11 items-center rounded-full p-0.5 transition",
                    settings.inAppNotifications
                      ? "bg-emerald-500"
                      : "bg-slate-600",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "h-5 w-5 rounded-full bg-slate-950 shadow transition",
                      settings.inAppNotifications
                        ? "translate-x-5"
                        : "translate-x-0",
                    ].join(" ")}
                  />
                </span>
              </button>
            </section>

            <hr className="border-slate-800" />

            {/* التنبيهات عبر البريد */}
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-50">
                التنبيهات عبر البريد الإلكتروني
              </h2>
              <p className="text-xs text-slate-400">
                تفعيل أو إيقاف إرسال تنبيهات إلى بريدك (إعداد واجهة فقط حاليًا).
              </p>

              <button
                type="button"
                onClick={toggleEmailNotifications}
                className="mt-2 inline-flex items-center justify-between w-full max-w-xs rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800 transition"
              >
                <span>السماح بالتنبيهات على البريد</span>
                <span
                  className={[
                    "inline-flex h-6 w-11 items-center rounded-full p-0.5 transition",
                    settings.emailNotifications
                      ? "bg-emerald-500"
                      : "bg-slate-600",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "h-5 w-5 rounded-full bg-slate-950 shadow transition",
                      settings.emailNotifications
                        ? "translate-x-5"
                        : "translate-x-0",
                    ].join(" ")}
                  />
                </span>
              </button>
            </section>

            <hr className="border-slate-800" />

            {/* 🔐 تغيير كلمة المرور */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-50">
                تغيير كلمة المرور
              </h2>
              <p className="text-xs text-slate-400">
                يمكنك تغيير كلمة المرور الخاصة بحسابك في DR4X. يتم التغيير عبر
                نظام Supabase Auth بدون إضافة أي جداول أو أعمدة جديدة في قاعدة
                البيانات.
              </p>

              <form
                onSubmit={handlePasswordChange}
                className="mt-2 grid gap-3 max-w-md"
                dir="rtl"
              >
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-200">
                    كلمة المرور الحالية
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-400"
                    placeholder="أدخل كلمة المرور الحالية"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-200">
                    كلمة المرور الجديدة
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-400"
                    placeholder="كلمة مرور قوية"
                  />
                  <p className="text-[11px] text-slate-500">
                    يفضّل أن تحتوي على حروف كبيرة وصغيرة وأرقام ورموز.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-200">
                    تأكيد كلمة المرور الجديدة
                  </label>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-400"
                    placeholder="أعد إدخال كلمة المرور الجديدة"
                  />
                </div>

                {pwdError ? (
                  <div className="text-xs text-pink-300">{pwdError}</div>
                ) : null}
                {pwdSuccess ? (
                  <div className="text-xs text-emerald-300">{pwdSuccess}</div>
                ) : null}

                <div>
                  <button
                    type="submit"
                    disabled={pwdSaving}
                    className="rounded-full bg-pink-500 text-slate-950 px-4 py-2 text-sm font-semibold hover:bg-pink-400 transition disabled:opacity-50"
                  >
                    {pwdSaving
                      ? "جارٍ تغيير كلمة المرور..."
                      : "حفظ كلمة المرور"}
                  </button>
                </div>
              </form>
            </section>

            <p className="mt-2 text-[11px] text-slate-500 leading-relaxed">
              * إعدادات اللغة والخصوصية والتنبيهات تُحفظ محليًا في متصفحك فقط.
              تغيير كلمة المرور يتم عبر Supabase Auth؛ لا نضيف أي جداول أو أعمدة
              أو سياسات جديدة في قاعدة البيانات.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
