"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";

type ModeratorRow = {
  uid: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  can_delete_posts: boolean;
  can_ban_users: boolean;
  can_manage_reports: boolean;
  created_at: string | null;
};

type SimpleProfile = {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
};

export default function ModeratorsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [moderators, setModerators] = useState<ModeratorRow[]>([]);

  // لإضافة مشرف جديد
  const [searchValue, setSearchValue] = useState("");
  const [searchResult, setSearchResult] = useState<SimpleProfile | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [newCanDeletePosts, setNewCanDeletePosts] = useState(false);
  const [newCanBanUsers, setNewCanBanUsers] = useState(false);
  const [newCanManageReports, setNewCanManageReports] = useState(false);

  const [sessionToken, setSessionToken] = useState<string | null>(null);

  // جلب session و قائمة المشرفين
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setError(null);
        setLoading(true);

        const {
          data: { session },
          error: sessionErr,
        } = await supabase.auth.getSession();

        if (sessionErr) {
          throw new Error(sessionErr.message);
        }

        if (!session) {
          throw new Error("يجب تسجيل الدخول كأدمن للوصول لهذه الصفحة");
        }

        const token = session.access_token;
        if (!alive) return;
        setSessionToken(token);

        const res = await fetch("/api/admin/moderators/roles", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json?.error || "خطأ في جلب المشرفين");
        }

        if (!alive) return;
        setModerators(json.moderators || []);
      } catch (err: any) {
        if (!alive) return;
        setError(err?.message || "حدث خطأ غير متوقع");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function refreshModerators() {
    if (!sessionToken) return;
    try {
      setError(null);
      setLoading(true);

      const res = await fetch("/api/admin/moderators/roles", {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "خطأ في جلب المشرفين");
      }

      setModerators(json.moderators || []);
    } catch (err: any) {
      setError(err?.message || "حدث خطأ غير متوقع أثناء التحديث");
    } finally {
      setLoading(false);
    }
  }

  async function handleTogglePermission(
    row: ModeratorRow,
    field: "can_delete_posts" | "can_ban_users" | "can_manage_reports"
  ) {
    if (!sessionToken) return;
    try {
      setSaving(true);
      setError(null);

      const payload = {
        uid: row.uid,
        can_delete_posts:
          field === "can_delete_posts"
            ? !row.can_delete_posts
            : row.can_delete_posts,
        can_ban_users:
          field === "can_ban_users" ? !row.can_ban_users : row.can_ban_users,
        can_manage_reports:
          field === "can_manage_reports"
            ? !row.can_manage_reports
            : row.can_manage_reports,
      };

      const res = await fetch("/api/admin/moderators/roles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "فشل حفظ التعديلات");
      }

      // تحديث الحالة محليًا
      setModerators((prev) =>
        prev.map((m) =>
          m.uid === row.uid ? { ...m, ...payload } : m
        )
      );
    } catch (err: any) {
      setError(err?.message || "حدث خطأ أثناء حفظ التعديلات");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveModerator(uid: string) {
    if (!sessionToken) return;
    if (!confirm("هل تريد إزالة هذا المشرف؟")) return;

    try {
      setSaving(true);
      setError(null);

      const res = await fetch(
        `/api/admin/moderators/roles?uid=${encodeURIComponent(uid)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        }
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "فشل إزالة المشرف");
      }

      setModerators((prev) => prev.filter((m) => m.uid !== uid));
    } catch (err: any) {
      setError(err?.message || "حدث خطأ أثناء إزالة المشرف");
    } finally {
      setSaving(false);
    }
  }

  async function handleSearchUser(e: React.FormEvent) {
    e.preventDefault();
    setSearchError(null);
    setSearchResult(null);

    if (!searchValue.trim()) {
      setSearchError("أدخل البريد الإلكتروني أو اسم المستخدم");
      return;
    }

    try {
      setSearchLoading(true);

      const identifier = searchValue.trim();

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, username, email")
        .or(
          `email.eq.${identifier},username.eq.${identifier}`
        )
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (!data) {
        setSearchError("لم يتم العثور على مستخدم بهذا المعرف");
        return;
      }

      setSearchResult({
        id: data.id,
        full_name: data.full_name,
        username: data.username,
        email: data.email,
      });
    } catch (err: any) {
      setSearchError(err?.message || "حدث خطأ أثناء البحث عن المستخدم");
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleAddModerator(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionToken) return;

    if (!searchResult) {
      setSearchError("ابحث عن مستخدم أولاً");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        uid: searchResult.id,
        can_delete_posts: newCanDeletePosts,
        can_ban_users: newCanBanUsers,
        can_manage_reports: newCanManageReports,
      };

      const res = await fetch("/api/admin/moderators/roles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "فشل إضافة المشرف");
      }

      // بعد النجاح: إعادة تحميل القائمة حتى تظهر البيانات مع الاسم والبريد
      await refreshModerators();

      // إعادة ضبط الحقول
      setSearchResult(null);
      setSearchValue("");
      setNewCanDeletePosts(false);
      setNewCanBanUsers(false);
      setNewCanManageReports(false);
    } catch (err: any) {
      setError(err?.message || "حدث خطأ أثناء إضافة المشرف");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-bold mb-2">إدارة المشرفين (Moderators)</h1>

      {error && (
        <div className="bg-red-100 text-red-800 border border-red-300 rounded-lg px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {/* قسم إضافة مشرف جديد */}
      <section className="border rounded-xl p-4 bg-white/60 space-y-3">
        <h2 className="font-semibold mb-2">تعيين مستخدم كمشرف جديد</h2>

        <form onSubmit={handleSearchUser} className="space-y-2">
          <label className="block text-sm">
            ابحث بالبريد الإلكتروني أو اسم المستخدم:
          </label>
          <div className="flex gap-2 flex-col sm:flex-row">
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="border rounded-lg px-3 py-2 flex-1 text-sm"
              placeholder="مثال: user@example.com أو username"
            />
            <button
              type="submit"
              disabled={searchLoading}
              className="px-4 py-2 rounded-lg border text-sm"
            >
              {searchLoading ? "يتم البحث..." : "بحث"}
            </button>
          </div>
        </form>

        {searchError && (
          <div className="text-xs text-red-700">{searchError}</div>
        )}

        {searchResult && (
          <form
            onSubmit={handleAddModerator}
            className="mt-3 border-t pt-3 space-y-3"
          >
            <div className="text-sm">
              <div>
                <span className="font-semibold">الاسم:</span>{" "}
                {searchResult.full_name || "—"}
              </div>
              <div>
                <span className="font-semibold">اسم المستخدم:</span>{" "}
                {searchResult.username || "—"}
              </div>
              <div>
                <span className="font-semibold">البريد:</span>{" "}
                {searchResult.email || "—"}
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newCanDeletePosts}
                  onChange={(e) => setNewCanDeletePosts(e.target.checked)}
                />
                حذف منشورات
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newCanBanUsers}
                  onChange={(e) => setNewCanBanUsers(e.target.checked)}
                />
                إيقاف/حظر مستخدمين
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newCanManageReports}
                  onChange={(e) =>
                    setNewCanManageReports(e.target.checked)
                  }
                />
                إدارة البلاغات
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-black text-white text-sm"
            >
              {saving ? "يتم الحفظ..." : "حفظ كمشرف"}
            </button>
          </form>
        )}
      </section>

      {/* جدول المشرفين الحاليين */}
      <section className="border rounded-xl p-4 bg-white/60 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">قائمة المشرفين الحاليين</h2>
          {loading && (
            <span className="text-xs text-gray-500">يتم التحميل...</span>
          )}
        </div>

        {moderators.length === 0 && !loading && (
          <div className="text-sm text-gray-600">
            لا يوجد مشرفون حتى الآن.
          </div>
        )}

        {moderators.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-3 py-2 text-right">الاسم</th>
                  <th className="px-3 py-2 text-right">اسم المستخدم</th>
                  <th className="px-3 py-2 text-right">البريد</th>
                  <th className="px-3 py-2 text-center">حذف منشورات</th>
                  <th className="px-3 py-2 text-center">حظر مستخدمين</th>
                  <th className="px-3 py-2 text-center">إدارة البلاغات</th>
                  <th className="px-3 py-2 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {moderators.map((m) => (
                  <tr key={m.uid} className="border-b">
                    <td className="px-3 py-2">
                      {m.full_name || "—"}
                    </td>
                    <td className="px-3 py-2">
                      {m.username || "—"}
                    </td>
                    <td className="px-3 py-2">
                      {m.email || "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={m.can_delete_posts}
                        onChange={() =>
                          handleTogglePermission(m, "can_delete_posts")
                        }
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={m.can_ban_users}
                        onChange={() =>
                          handleTogglePermission(m, "can_ban_users")
                        }
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={m.can_manage_reports}
                        onChange={() =>
                          handleTogglePermission(m, "can_manage_reports")
                        }
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveModerator(m.uid)}
                        className="text-xs text-red-600 hover:underline"
                        disabled={saving}
                      >
                        إزالة الإشراف
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
