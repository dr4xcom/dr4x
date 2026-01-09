// src/app/settings/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
    // نحاول نقرأ اللغة من dr4x_lang أولاً (لو فيه نظام ترجمة يستخدمه)
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
        // نحفظ اللغة تحت مفتاح عام يستخدمه باقي المشروع
        window.localStorage.setItem(LANG_KEY, lang);
      } catch {
        // نتجاهل لو صار خطأ
      }
      // نعيد تحميل الصفحة عشان كل المكونات تقرأ اللغة الجديدة
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

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-8">
      <div className="max-w-3xl mx-auto">
        {/* زر الرجوع */}
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-6 inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition"
        >
          الرجوع
        </button>

        {/* العنوان */}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-center text-slate-900 mb-6">
          الإعدادات
        </h1>

        {/* وصف */}
        <p className="text-center text-sm text-slate-600 mb-6">
          صفحة إعدادات بسيطة الآن (لاحقًا نضيف: الخصوصية، اللغة، التنبيهات،
          إعدادات الحساب…).
        </p>

        {/* بطاقة الإعدادات */}
        <div className="rounded-3xl bg-white shadow-sm border border-slate-200 p-5 sm:p-6 space-y-8">
          {/* حالة الحفظ */}
          {saving ? (
            <div className="text-xs text-amber-600 mb-2">
              جاري حفظ الإعدادات في متصفحك…
            </div>
          ) : (
            <div className="text-xs text-emerald-600 mb-2">
              تم حفظ الإعدادات محليًا على جهازك (لا يتم تعديل أي بيانات في
              قاعدة DR4X حاليًا).
            </div>
          )}

          {/* === اللغة === */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-900">
              اللغة (واجهة الموقع)
            </h2>
            <p className="text-xs text-slate-500 mb-1">
              اختيار لغة العرض في الواجهة. هذا الإعداد يُحفظ محليًا في متصفحك،
              ويمكن ربطه بنظام الترجمة i18n في DR4X.
            </p>

            <div className="mt-2">
              <select
                value={settings.language}
                onChange={(e) => updateLanguage(e.target.value as Language)}
                className="w-full max-w-sm rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                <option value="ar">العربية</option>
                <option value="en">English</option>
                <option value="tr">Türkçe</option>
              </select>
            </div>
          </section>

          <hr className="border-slate-200" />

          {/* === الخصوصية وظهور الحساب === */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">
              الخصوصية وظهور الحساب
            </h2>

            {/* حالة الحساب */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
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
                className="mt-1 w-full max-w-sm rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                <option value="public">عام (يظهر للجميع)</option>
                <option value="private">
                  خاص (يظهر فقط للجهات المسموح لها لاحقًا)
                </option>
              </select>
            </div>

            {/* ظهور البروفايل */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                ظهور البروفايل في الموقع
              </label>
              <p className="text-[11px] text-slate-500 mb-1">
                التحكم في إظهار صفحة البروفايل العامة في نتائج البحث وقوائم
                الأعضاء (إعداد واجهة فقط حاليًا).
              </p>
              <select
                value={settings.profileVisibility === "public" ? "show" : "hide"}
                onChange={(e) =>
                  updateProfileVisibility(
                    e.target.value === "show" ? "public" : "private"
                  )
                }
                className="mt-1 w-full max-w-sm rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                <option value="show">إظهار البروفايل</option>
                <option value="hide">إخفاء البروفايل</option>
              </select>
            </div>

            {/* إظهار/إخفاء البريد */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
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
                className="mt-1 w-full max-w-sm rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                <option value="show">إظهار البريد في البروفايل</option>
                <option value="hide">إخفاء البريد عن الآخرين</option>
              </select>
            </div>

            {/* من يمكنه مراسلتي */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
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
                className="mt-1 w-full max-w-sm rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                <option value="everyone">
                  السماح للمستخدمين والأطباء بمراسلتي
                </option>
                <option value="doctors">السماح للأطباء فقط بمراسلتي</option>
                <option value="none">منع الرسائل تمامًا</option>
              </select>
            </div>
          </section>

          <hr className="border-slate-200" />

          {/* التنبيهات داخل الموقع */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-900">
              التنبيهات داخل الموقع
            </h2>
            <p className="text-xs text-slate-500">
              هذا الخيار يتحكم فقط في عرض التنبيهات داخل واجهة DR4X حالياً.
            </p>

            <button
              type="button"
              onClick={toggleInAppNotifications}
              className="mt-2 inline-flex items-center justify-between w-full max-w-xs rounded-full border border-slate-300 bg-slate-50 px-4 py-2 text-sm text-slate-800 hover:bg-slate-100 transition"
            >
              <span>إظهار التنبيهات داخل الموقع</span>
              <span
                className={[
                  "inline-flex h-6 w-11 items-center rounded-full p-0.5 transition",
                  settings.inAppNotifications
                    ? "bg-emerald-500"
                    : "bg-slate-300",
                ].join(" ")}
              >
                <span
                  className={[
                    "h-5 w-5 rounded-full bg-white shadow transition",
                    settings.inAppNotifications ? "translate-x-5" : "translate-x-0",
                  ].join(" ")}
                />
              </span>
            </button>
          </section>

          <hr className="border-slate-200" />

          {/* التنبيهات عبر البريد */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-900">
              التنبيهات عبر البريد الإلكتروني
            </h2>
            <p className="text-xs text-slate-500">
              تفعيل أو إيقاف إرسال تنبيهات إلى بريدك (إعداد واجهة فقط حاليًا).
            </p>

            <button
              type="button"
              onClick={toggleEmailNotifications}
              className="mt-2 inline-flex items-center justify-between w-full max-w-xs rounded-full border border-slate-300 bg-slate-50 px-4 py-2 text-sm text-slate-800 hover:bg-slate-100 transition"
            >
              <span>السماح بالتنبيهات على البريد</span>
              <span
                className={[
                  "inline-flex h-6 w-11 items-center rounded-full p-0.5 transition",
                  settings.emailNotifications ? "bg-emerald-500" : "bg-slate-300",
                ].join(" ")}
              >
                <span
                  className={[
                    "h-5 w-5 rounded-full bg-white shadow transition",
                    settings.emailNotifications ? "translate-x-5" : "translate-x-0",
                  ].join(" ")}
                />
              </span>
            </button>
          </section>

          <p className="mt-4 text-[11px] text-slate-500 leading-relaxed">
            * ملاحظة: كل الإعدادات الحالية تُحفظ محليًا في متصفحك فقط، ولا يتم
            تعديل أي جداول أو أعمدة أو سياسات في Supabase. لاحقًا، إذا حبيت،
            نربط هذه الخيارات فعليًا بظهور البروفايل، البريد، والمراسلة بين
            الأعضاء والأطباء في نظام DR4X.
          </p>
        </div>
      </div>
    </div>
  );
}
