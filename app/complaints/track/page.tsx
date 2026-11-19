import type { Metadata } from "next";
import Link from "next/link";
import { trackFeedback } from "../../lib/data";

export const metadata: Metadata = {
  title: "متابعة شكوى",
  description: "تابع حالة شكواك والرد عليها برقم التتبع.",
  alternates: { canonical: "/complaints/track" },
  robots: { index: false, follow: true },
};

const STATUS: Record<string, { label: string; note: string }> = {
  new: { label: "وصلتنا", note: "شكواك مسجّلة وفي الدور للمراجعة." },
  read: { label: "تحت المتابعة", note: "فريقنا اطّلع عليها ويشتغل عليها الآن." },
  resolved: { label: "تم الحل", note: "أغلقنا الشكوى — إذا ما زال عندك ملاحظة افتح واحدة جديدة." },
};

const TYPE: Record<string, string> = {
  service: "الخدمة",
  product: "المنتج أو الطلب",
  place: "المكان والأجواء",
  other: "أخرى",
};

function fmt(iso: string) {
  return new Intl.DateTimeFormat("ar-SA", { dateStyle: "long" }).format(new Date(iso));
}

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code = "" } = await searchParams;
  const query = code.trim();
  // Looked up through a security-definer function: anon still cannot read the
  // feedback table, and the lookup returns the status and our reply only —
  // never the name, the phone number or the original message.
  const result = query ? await trackFeedback(query) : null;
  const status = result ? STATUS[result.status] ?? STATUS.new : null;

  return (
    <div className="complaints-page">
      <section className="complaints-hero">
        <div className="wrap narrow">
          <div className="section-kicker">TRACK · متابعة</div>
          <h1>وين وصلت شكواك؟</h1>
          <p>اكتب رقم التتبع اللي وصلك عند إرسال الشكوى، ونوريك آخر تحديث والرد عليها.</p>
        </div>
      </section>

      <section className="complaints-body">
        <div className="wrap narrow">
          <form className="track-form" method="get">
            <label htmlFor="code">رقم التتبع</label>
            <div className="track-row">
              <input
                id="code"
                name="code"
                dir="ltr"
                required
                maxLength={12}
                defaultValue={query}
                placeholder="4K7QX9"
                autoComplete="off"
              />
              <button type="submit" className="btn btn-cta-primary">متابعة</button>
            </div>
          </form>

          {query && !result && (
            <div className="track-card track-card--empty">
              <h2>ما لقينا هذا الرقم</h2>
              <p>
                تأكد من الرقم كما وصلك عند الإرسال. إذا ضاع منك الرقم، أرسل شكوى
                جديدة أو كلّمنا مباشرة.
              </p>
              <Link href="/complaints" className="btn btn-cta-ghost">إرسال شكوى</Link>
            </div>
          )}

          {result && status && (
            <div className="track-card" data-status={result.status}>
              <div className="track-head">
                <span className="track-code" dir="ltr">{result.ticket}</span>
                <span className="track-state">{status.label}</span>
              </div>
              <dl className="track-meta">
                <div>
                  <dt>نوع الشكوى</dt>
                  <dd>{TYPE[result.type] ?? TYPE.other}</dd>
                </div>
                <div>
                  <dt>تاريخ الإرسال</dt>
                  <dd>{fmt(result.created_at)}</dd>
                </div>
              </dl>
              <p className="track-note">{status.note}</p>

              {result.reply ? (
                <div className="track-reply">
                  <span className="track-reply-label">ردّ تريس</span>
                  <p>{result.reply}</p>
                  {result.replied_at && <span className="track-reply-date">{fmt(result.replied_at)}</span>}
                </div>
              ) : (
                <p className="track-pending">ما كتبنا ردًا بعد — بنحدّث الصفحة أول ما نرد.</p>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
