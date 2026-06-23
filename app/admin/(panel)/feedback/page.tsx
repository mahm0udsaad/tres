import Link from "next/link";
import { MessageSquareText, Check, Eye, Phone, MessageCircle, Mail } from "lucide-react";
import { listFeedback } from "../../../lib/admin-data";
import { setFeedbackStatus } from "../../actions";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = { service: "الخدمة", product: "المنتج", place: "المكان", other: "أخرى" };
const STATUS_LABEL: Record<string, string> = { new: "جديد", read: "مقروء", resolved: "تم الحل" };
const FILTERS = [
  { key: "all", label: "الكل" },
  { key: "new", label: "جديد" },
  { key: "read", label: "مقروء" },
  { key: "resolved", label: "محلولة" },
];

function fmt(iso: string) {
  return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

function contactLink(contact: string) {
  const digits = contact.replace(/[^\d+]/g, "");
  if (contact.includes("@")) return { href: `mailto:${contact}`, icon: Mail, label: contact };
  if (digits.length >= 7) {
    const wa = digits.replace(/^\+/, "").replace(/^0/, "966");
    return { href: `https://wa.me/${wa}`, icon: MessageCircle, label: contact, tel: `tel:${digits}` };
  }
  return null;
}

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = "all" } = await searchParams;
  let items: Awaited<ReturnType<typeof listFeedback>> = [];
  let dbError = false;
  try {
    items = await listFeedback(status);
  } catch {
    dbError = true;
  }

  return (
    <>
      <div className="admin-page-head">
        <h1>الملاحظات</h1>
        <p>شكاوى ومقترحات الزبائن. تواصل معهم مباشرة عند الحاجة.</p>
      </div>

      <div className="a-seg" style={{ marginBottom: 18 }}>
        {FILTERS.map((f) => (
          <Link key={f.key} href={`/admin/feedback?status=${f.key}`} data-active={status === f.key}>{f.label}</Link>
        ))}
      </div>

      {dbError ? (
        <div className="a-card a-card--pad" style={{ background: "var(--amber-soft)", color: "var(--amber)", borderColor: "var(--amber)" }}>
          لم يتم الاتصال بقاعدة البيانات بعد.
        </div>
      ) : items.length === 0 ? (
        <div className="a-empty">
          <span className="ico"><MessageSquareText strokeWidth={1.6} /></span>
          <h3>لا توجد ملاحظات</h3>
          <p>عند وصول ملاحظة جديدة ستظهر هنا.</p>
        </div>
      ) : (
        <div className="a-fb">
          {items.map((f) => {
            const c = f.contact ? contactLink(f.contact) : null;
            return (
              <div key={f.id} className="a-fb-card" data-status={f.status}>
                <div className="a-fb-top">
                  <span className={`a-pill a-pill--${f.status}`}>{STATUS_LABEL[f.status]}</span>
                  {f.type && <span className="a-pill a-pill--read">{TYPE_LABEL[f.type] ?? f.type}</span>}
                  <span className="who">{f.name || "زائر"}</span>
                  <span className="when">{fmt(f.created_at)}</span>
                </div>
                <p className="a-fb-msg">{f.message}</p>
                <div className="a-fb-foot">
                  {c && (
                    <>
                      <a href={c.href} target="_blank" rel="noreferrer" className="a-btn a-btn--ghost a-btn--sm">
                        <c.icon strokeWidth={2} /> {c.label}
                      </a>
                      {c.tel && <a href={c.tel} className="a-iconbtn" aria-label="اتصال"><Phone strokeWidth={2} /></a>}
                    </>
                  )}
                  <span style={{ flex: 1 }} />
                  {f.status !== "read" && f.status !== "resolved" && (
                    <form action={setFeedbackStatus}>
                      <input type="hidden" name="id" value={f.id} />
                      <input type="hidden" name="status" value="read" />
                      <button className="a-btn a-btn--ghost a-btn--sm" type="submit"><Eye strokeWidth={2} /> مقروء</button>
                    </form>
                  )}
                  {f.status !== "resolved" && (
                    <form action={setFeedbackStatus}>
                      <input type="hidden" name="id" value={f.id} />
                      <input type="hidden" name="status" value="resolved" />
                      <button className="a-btn a-btn--primary a-btn--sm" type="submit"><Check strokeWidth={2} /> تم الحل</button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
