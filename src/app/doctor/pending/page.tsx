// src/app/doctor/pending/page.tsx
import Link from "next/link";

export const metadata = {
  title: "طلب الطبيب تحت المراجعة | DR4X",
};

export default function DoctorPendingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900/30 p-6">
        <div className="text-xs text-slate-400">DR4X</div>
        <h1 className="mt-1 text-xl font-extrabold tracking-wide">تم استلام طلبك ✅</h1>

        <div className="mt-3 space-y-2 text-sm text-slate-300 leading-6">
          <p>
            شكرًا لك. تم إرسال طلب تسجيل الطبيب بنجاح، وطلبك الآن{" "}
            <span className="font-bold">تحت المراجعة</span>.
          </p>
          <p>سيتم تفعيل حساب الطبيب بعد اعتماد الطلب من الإدارة.</p>
        </div>

        <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="text-sm font-semibold mb-1">ملاحظة</div>
          <div className="text-xs text-slate-300">
            يمكنك تسجيل الدخول لاحقًا. إذا لم يتم التفعيل بعد، فهذا يعني أن الطلب لا يزال تحت المراجعة.
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-2">
          <Link
            href="/home"
            className="inline-flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-2 text-sm font-extrabold text-slate-200 hover:bg-slate-900"
          >
            الرجوع للموقع ➜
          </Link>

          <Link
            href="/auth/login"
            className="inline-flex items-center justify-center rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900/40"
          >
            تسجيل الدخول
          </Link>
        </div>
      </div>
    </div>
  );
}
