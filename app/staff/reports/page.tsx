import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Coffee,
  Droplets,
  Images,
  LogOut,
  PackageSearch,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { ROLE_LABELS, requireStaff } from "../../lib/staff";
import { logoutStaffReports } from "./actions";
import ReviewDecisionForm from "./ReviewDecisionForm";
import {
  loadBranchDailyOperations,
  loadBranchReports,
  type BeverageEmployeeSummary,
  type ReportStatus,
  type UnifiedReport,
  type WaterQualityCheck,
} from "./report-data";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = new Set([
  "owner",
  "manager",
  "supervisor",
  "shift_manager",
]);

const STATUS_LABELS: Record<ReportStatus, string> = {
  pending: "بانتظار المراجعة",
  confirmed: "مؤكد",
  rejected: "مرفوض",
};

function textValue(report: UnifiedReport, keys: string[]) {
  for (const key of keys) {
    const value = report[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function BooleanFact({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  if (typeof value !== "boolean") return null;
  return (
    <span className={value ? "report-fact is-positive" : "report-fact is-negative"}>
      {value ? <CheckCircle2 /> : <XCircle />}
      {label}: {value ? "نعم" : "لا"}
    </span>
  );
}

function Inventory({ value }: { value: unknown }) {
  if (!value || typeof value !== "object") return null;
  const items: Array<{
    name: string;
    count: unknown;
    category: string | null;
  }> = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      if (typeof record.name !== "string" || !record.name.trim()) continue;
      items.push({
        name: record.name,
        count: record.count ?? 0,
        category: record.category === "dessert" ? "حلويات" : "منتجات",
      });
    }
  } else {
    for (const [groupName, groupValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (Array.isArray(groupValue)) {
        for (const item of groupValue) {
          if (!item || typeof item !== "object") continue;
          const record = item as Record<string, unknown>;
          if (typeof record.name !== "string" || !record.name.trim()) continue;
          items.push({
            name: record.name,
            count: record.count ?? 0,
            category: groupName === "desserts" ? "حلويات" : "منتجات",
          });
        }
      } else {
        items.push({ name: groupName, count: groupValue, category: null });
      }
    }
  }
  if (!items.length) return null;
  return (
    <section className="report-inventory">
      <h3>
        <PackageSearch />
        جرد المنتجات والحلويات
      </h3>
      <dl>
        {items.map(({ name, count, category }) => (
          <div key={`${category ?? "item"}-${name}`}>
            <dt>
              {name}
              {category ? <small>{category}</small> : null}
            </dt>
            <dd>{String(count)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ReportCard({
  report,
  canReview,
}: {
  report: UnifiedReport;
  canReview: boolean;
}) {
  const notes = textValue(report, [
    "notes",
    "cleanliness_notes",
    "handover_notes",
    "report_notes",
  ]);
  const inventory = report.inventory_counts ?? report.inventory_count;

  return (
    <article className={`report-card report-card--${report.type}`}>
      <header className="report-card-header">
        <div>
          <span className="report-kind">{report.title}</span>
          <h2>{report.submitterName}</h2>
          <time dateTime={report.report_date}>
            {new Intl.DateTimeFormat("ar-EG", { dateStyle: "long" }).format(
              new Date(`${report.report_date}T12:00:00`),
            )}
          </time>
        </div>
        <span className={`report-status report-status--${report.status}`}>
          {report.status === "pending" ? (
            <Clock3 />
          ) : report.status === "confirmed" ? (
            <CheckCircle2 />
          ) : (
            <XCircle />
          )}
          {STATUS_LABELS[report.status]}
        </span>
      </header>

      {notes ? (
        <section className="report-notes">
          <h3>ملاحظات الموظف</h3>
          <p>{notes}</p>
        </section>
      ) : null}

      <div className="report-facts">
        <BooleanFact
          label="البار نظيف وجاهز للتسليم"
          value={report.bar_clean_confirmed}
        />
        <BooleanFact
          label="تم تأكيد نظافة الموقع"
          value={report.clean_confirmed ?? report.location_clean_confirmed}
        />
      </div>

      <Inventory value={inventory} />

      {report.signedPhotos.length ? (
        <section className="report-evidence">
          <h3>
            <Images />
            صور الإثبات ({report.signedPhotos.length})
          </h3>
          <div className="report-photo-grid">
            {report.signedPhotos.map(({ path, url }, index) => (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                key={path}
                aria-label={`فتح صورة الإثبات رقم ${index + 1}`}
              >
                <Image
                  src={url}
                  alt={`صورة إثبات ${report.title} رقم ${index + 1}`}
                  width={360}
                  height={240}
                  unoptimized
                />
              </a>
            ))}
          </div>
        </section>
      ) : (
        <p className="report-no-evidence">لا توجد صور إثبات متاحة لهذا التقرير.</p>
      )}

      {report.status !== "pending" ? (
        <section className={`report-review-note report-review-note--${report.status}`}>
          <ShieldCheck />
          <div>
            <strong>
              {report.status === "confirmed" ? report.auto_approved ? "تم الاعتماد تلقائياً" : "تم التأكيد" : "تم الرفض"}
              {report.reviewerName ? ` بواسطة ${report.reviewerName}` : ""}
            </strong>
            {report.review_notes ? <p>{report.review_notes}</p> : null}
            {report.reviewed_at ? (
              <time dateTime={report.reviewed_at}>
                {new Intl.DateTimeFormat("ar-EG", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(report.reviewed_at))}
              </time>
            ) : null}
          </div>
        </section>
      ) : null}

      {canReview && report.status === "pending" ? (
        <ReviewDecisionForm reportId={report.id} reportType={report.type} />
      ) : null}
    </article>
  );
}

function dateInTimeZone(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function WaterQualitySummary({
  checks,
  reportDate,
}: {
  checks: WaterQualityCheck[];
  reportDate: string;
}) {
  return (
    <section className="report-section" aria-labelledby="water-heading">
      <div className="report-section-heading">
        <div>
          <p className="staff-eyebrow">WATER QUALITY</p>
          <h2 id="water-heading">فحوص جودة المياه</h2>
        </div>
        <span>{checks.length}</span>
      </div>
      <div className="report-operation-card">
        {checks.length ? (
          <div className="water-check-list">
            {checks.map((check) => (
              <article key={check.id} className="water-check">
                <div className="water-reading">
                  <Droplets />
                  <strong>{check.saltRatio}</strong>
                  <span>نسبة الملوحة</span>
                </div>
                <div>
                  <strong>{check.recorderName}</strong>
                  <time dateTime={check.createdAt}>
                    {new Intl.DateTimeFormat("ar-EG", {
                      timeStyle: "short",
                    }).format(new Date(check.createdAt))}
                  </time>
                  {check.notes ? <p>{check.notes}</p> : null}
                  {check.signedPhotoUrl ? (
                    <a
                      href={check.signedPhotoUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      فتح صورة قراءة الفحص
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="report-empty-inline">
            لم يُسجّل فحص مياه في {reportDate}.
          </p>
        )}
      </div>
    </section>
  );
}

function BeverageSummary({
  employees,
  reportDate,
}: {
  employees: BeverageEmployeeSummary[];
  reportDate: string;
}) {
  const consumedCount = employees.filter((employee) => employee.consumed).length;
  return (
    <section className="report-section" aria-labelledby="beverage-heading">
      <div className="report-section-heading">
        <div>
          <p className="staff-eyebrow">DAILY BEVERAGES</p>
          <h2 id="beverage-heading">ملخص مشروبات الموظفين</h2>
        </div>
        <span>{consumedCount}</span>
      </div>
      <div className="report-operation-card">
        <div className="beverage-totals">
          <Coffee />
          <div>
            <strong>
              {consumedCount} من {employees.length}
            </strong>
            <span>استهلكوا مشروبهم المخصص في {reportDate}</span>
          </div>
        </div>
        {employees.length ? (
          <ul className="beverage-employee-list">
            {employees.map((employee) => (
              <li key={employee.employeeId}>
                <span>{employee.employeeName}</span>
                <strong
                  data-consumed={employee.consumed}
                  data-recorded={employee.recorded}
                >
                  {!employee.recorded
                    ? "لم يسجّل بعد"
                    : employee.consumed
                      ? "استهلك المشروب"
                      : "لم يستهلكه"}
                </strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="report-empty-inline">
            لم يسجّل أي موظف حالة مشروبه اليوم.
          </p>
        )}
      </div>
    </section>
  );
}

export default async function StaffReportsPage() {
  const { profile, supabase } = await requireStaff();
  const allowed = ALLOWED_ROLES.has(profile.role);
  const canReview = profile.role === "supervisor";

  let branchName = "الفرع";
  let reports: UnifiedReport[] = [];
  let errors: string[] = [];
  let waterChecks: WaterQualityCheck[] = [];
  let beverages: BeverageEmployeeSummary[] = [];
  let reportDate = dateInTimeZone("Africa/Cairo");

  if (profile.role === "owner") {
    const { data: branches } = await supabase.from("branches").select("id").order("name");
    const reportResults = await Promise.all((branches ?? []).map((branch) => loadBranchReports(supabase, branch.id)));
    reports = reportResults.flatMap((result) => result.reports);
    errors = reportResults.flatMap((result) => result.errors);
    branchName = "جميع الفروع";
  } else if (allowed && profile.branch_id) {
    const branchPromise = supabase
      .from("branches")
      .select("name,timezone")
      .eq("id", profile.branch_id)
      .maybeSingle();
    const reportsPromise = loadBranchReports(supabase, profile.branch_id);
    const branchResult = await branchPromise;
    branchName = branchResult.data?.name ?? branchName;
    reportDate = dateInTimeZone(
      branchResult.data?.timezone ?? "Africa/Cairo",
    );
    const [reportsResult, operationsResult] = await Promise.all([
      reportsPromise,
      loadBranchDailyOperations(supabase, profile.branch_id, reportDate),
    ]);
    reports = reportsResult.reports;
    waterChecks = operationsResult.waterChecks;
    beverages = operationsResult.beverages;
    errors = [...reportsResult.errors, ...operationsResult.errors];
  }

  const pending = reports.filter((report) => report.status === "pending");
  const reviewed = reports.filter((report) => report.status !== "pending");

  return (
    <main className="staff-dashboard report-dashboard">
      <header className="staff-topbar">
        <div className="staff-brand">
          <span>T</span>
          <div>
            <strong>تريس</strong>
            <small>مراجعة التقارير</small>
          </div>
        </div>
        <div className="staff-user">
          <div>
            <strong>{profile.full_name}</strong>
            <span>{ROLE_LABELS[profile.role]}</span>
          </div>
          <form action={logoutStaffReports}>
            <button type="submit" aria-label="تسجيل الخروج">
              <LogOut />
            </button>
          </form>
        </div>
      </header>

      <div className="staff-content">
        <Link href="/staff" className="report-back-link">
          <ArrowRight />
          العودة إلى لوحة الموظفين
        </Link>

        <section className="report-hero">
          <div>
            <p className="staff-eyebrow">REPORT VERIFICATION</p>
            <h1>{canReview ? "مراجعة تقارير الفريق" : "تقارير الفرع"}</h1>
            <p>
              {branchName} ·{" "}
              {canReview
                ? "راجع الأدلة ثم أكّد التقرير أو ارفضه مع توضيح السبب."
                : "عرض التقارير ونتائج المراجعة فقط."}
            </p>
          </div>
          <div className="report-count" aria-label={`${pending.length} تقارير معلقة`}>
            <ClipboardCheck />
            <strong>{pending.length}</strong>
            <span>بانتظار المراجعة</span>
          </div>
        </section>

        {!allowed ? (
          <div className="staff-alert staff-alert--error" role="alert">
            ليس لديك صلاحية عرض تقارير الفرع.
          </div>
        ) : !profile.branch_id ? (
          <div className="staff-alert staff-alert--error" role="alert">
            لا يوجد فرع مرتبط بهذا الحساب.
          </div>
        ) : null}

        {errors.length ? (
          <div className="staff-alert staff-alert--error" role="alert">
            تعذّر تحميل بعض التقارير. تأكد من تطبيق تحديثات قاعدة البيانات.
          </div>
        ) : null}

        {allowed && profile.branch_id ? (
          <>
            <section className="report-section" aria-labelledby="pending-heading">
              <div className="report-section-heading">
                <div>
                  <p className="staff-eyebrow">PENDING</p>
                  <h2 id="pending-heading">تقارير جديدة</h2>
                </div>
                <span>{pending.length}</span>
              </div>
              <div className="report-list">
                {pending.length ? (
                  pending.map((report) => (
                    <ReportCard
                      key={`${report.type}-${report.id}`}
                      report={report}
                      canReview={canReview}
                    />
                  ))
                ) : (
                  <div className="report-empty">
                    <CheckCircle2 />
                    <strong>لا توجد تقارير معلّقة</strong>
                    <p>تمت مراجعة كل التقارير المتاحة لهذا الفرع.</p>
                  </div>
                )}
              </div>
            </section>

            <section className="report-section" aria-labelledby="reviewed-heading">
              <div className="report-section-heading">
                <div>
                  <p className="staff-eyebrow">REVIEWED</p>
                  <h2 id="reviewed-heading">سجل المراجعات</h2>
                </div>
                <span>{reviewed.length}</span>
              </div>
              <div className="report-list">
                {reviewed.length ? (
                  reviewed.map((report) => (
                    <ReportCard
                      key={`${report.type}-${report.id}`}
                      report={report}
                      canReview={false}
                    />
                  ))
                ) : (
                  <p className="report-empty-inline">لا توجد مراجعات سابقة بعد.</p>
                )}
              </div>
            </section>

            <div className="report-operations-grid">
              <WaterQualitySummary
                checks={waterChecks}
                reportDate={reportDate}
              />
              <BeverageSummary
                employees={beverages}
                reportDate={reportDate}
              />
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
