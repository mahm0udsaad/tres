import Link from "next/link";
import { CupSoda, EyeOff, MessageSquareText, Megaphone, Plus, ArrowLeft, Layers } from "lucide-react";
import { overview, listFeedback } from "../../lib/admin-data";

export const dynamic = "force-dynamic";

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.round(d / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `قبل ${m} د`;
  const h = Math.round(m / 60);
  if (h < 24) return `قبل ${h} س`;
  return `قبل ${Math.round(h / 24)} ي`;
}

export default async function OverviewPage() {
  let stats = { categories: 0, items: 0, soldOut: 0, newFeedback: 0, announcementActive: false };
  let recent: Awaited<ReturnType<typeof listFeedback>> = [];
  let dbError = false;
  try {
    [stats, recent] = await Promise.all([overview(), listFeedback("new")]);
  } catch {
    dbError = true;
  }

  return (
    <>
      <div className="admin-page-head">
        <h1>أهلاً 👋</h1>
        <p>نظرة سريعة على متجرك. كل التعديلات تظهر مباشرة في الموقع.</p>
      </div>

      {dbError && (
        <div className="a-card a-card--pad" style={{ marginBottom: 18, borderColor: "var(--amber)", background: "var(--amber-soft)", color: "var(--amber)" }}>
          لم يتم الاتصال بقاعدة البيانات بعد. شغّل ترحيل قاعدة البيانات لإكمال الإعداد.
        </div>
      )}

      <div className="a-stats">
        <div className="a-stat">
          <span className="ico tone-burgundy"><Layers strokeWidth={2} /></span>
          <div className="num">{stats.categories}</div>
          <div className="lbl">قسم</div>
        </div>
        <div className="a-stat">
          <span className="ico tone-burgundy"><CupSoda strokeWidth={2} /></span>
          <div className="num">{stats.items}</div>
          <div className="lbl">صنف</div>
        </div>
        <div className="a-stat">
          <span className="ico tone-amber"><EyeOff strokeWidth={2} /></span>
          <div className="num">{stats.soldOut}</div>
          <div className="lbl">غير متوفر</div>
        </div>
        <div className="a-stat">
          <span className="ico tone-green"><MessageSquareText strokeWidth={2} /></span>
          <div className="num">{stats.newFeedback}</div>
          <div className="lbl">ملاحظة جديدة</div>
        </div>
      </div>

      <div className="a-section-title"><h2>إجراءات سريعة</h2></div>
      <div className="a-quick">
        <Link href="/admin/menu" className="a-btn a-btn--primary"><Plus strokeWidth={2.2} /> أضف صنفاً</Link>
        <Link href="/admin/feedback" className="a-btn a-btn--ghost"><MessageSquareText strokeWidth={2} /> الملاحظات</Link>
      </div>

      <div className="a-card a-card--pad" style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12 }}>
        <span className="ico tone-burgundy" style={{ width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center" }}>
          <Megaphone strokeWidth={2} style={{ width: 19, height: 19 }} />
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>شريط الإعلان</div>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            {stats.announcementActive ? "ظاهر حالياً في الموقع" : "غير مفعّل"}
          </div>
        </div>
        <Link href="/admin/settings" className="a-btn a-btn--ghost a-btn--sm">إدارة</Link>
      </div>

      {recent.length > 0 && (
        <>
          <div className="a-section-title">
            <h2>أحدث الملاحظات</h2>
            <Link href="/admin/feedback" className="a-btn a-btn--ghost a-btn--sm">الكل <ArrowLeft strokeWidth={2} /></Link>
          </div>
          <div className="a-fb">
            {recent.slice(0, 3).map((f) => (
              <div key={f.id} className="a-fb-card" data-status="new">
                <div className="a-fb-top">
                  <span className="a-pill a-pill--new">جديد</span>
                  <span className="who">{f.name || "زائر"}</span>
                  <span className="when">{timeAgo(f.created_at)}</span>
                </div>
                <p className="a-fb-msg">{f.message}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
