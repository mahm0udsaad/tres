"use client";

import { useActionState, useRef, useState } from "react";
import {
  Beaker,
  Camera,
  Check,
  ChefHat,
  Coffee,
  Plus,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { StaffRole } from "../../lib/staff-shared";
import {
  submitStaffModule,
  type SubmissionActionState,
} from "./actions";

type ReportStatus = {
  status: "pending" | "confirmed" | "rejected";
  review_notes: string | null;
  revision: number;
} | null;

type InventoryRow = {
  id: number;
  name: string;
  category: "product" | "dessert";
  count: string;
};

type Props = {
  role: StaffRole;
  reports: {
    cleaning: ReportStatus;
    barista: ReportStatus;
    kitchen: ReportStatus;
  };
  latestWater: { salt_ratio: number; created_at: string } | null;
  beverageConsumed: boolean | null;
};

const STATUS_LABELS = {
  pending: "بانتظار المراجعة",
  confirmed: "مؤكد",
  rejected: "مرفوض — يحتاج تعديل",
} as const;

function SubmitButton({ label, disabled }: { label: string; disabled: boolean }) {
  return (
    <button className="staff-primary staff-submit-button" type="submit" disabled={disabled}>
      <Send />
      {label}
    </button>
  );
}

function Result({
  state,
  operation,
}: {
  state: SubmissionActionState | undefined;
  operation: string;
}) {
  if (state?.operation !== operation) return <span className="staff-submit-spacer" />;
  return (
    <p
      className={state.error ? "staff-form-error" : "staff-form-success"}
      role={state.error ? "alert" : "status"}
    >
      {state.error ?? state.message}
    </p>
  );
}

function Status({ report }: { report: ReportStatus }) {
  if (!report) return null;
  return (
    <div className="staff-report-current">
      <span data-status={report.status}>{STATUS_LABELS[report.status]}</span>
      <small>الإصدار {report.revision}</small>
      {report.status === "rejected" && report.review_notes ? (
        <p><strong>ملاحظات المشرف:</strong> {report.review_notes}</p>
      ) : null}
    </div>
  );
}

function EvidenceInput({
  multiple = false,
  required = false,
  name = "photos",
}: {
  multiple?: boolean;
  required?: boolean;
  name?: string;
}) {
  return (
    <label className="staff-evidence-input">
      <Camera />
      <span>
        <strong>{multiple ? "إرفاق صور الإثبات" : "إرفاق صورة القراءة"}</strong>
        <small>JPG أو PNG أو WebP أو HEIC · حتى 3MB للصورة</small>
      </span>
      <input
        name={name}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        capture="environment"
        multiple={multiple}
        required={required}
      />
    </label>
  );
}

function CleaningForm({ report }: { report: ReportStatus }) {
  const [state, action, pending] = useActionState(submitStaffModule, undefined);
  const locked = report?.status === "pending" || report?.status === "confirmed";
  return (
    <section className="staff-card staff-submission-card">
      <div className="staff-card-head">
        <div>
          <p className="staff-eyebrow">CLEANING REPORT</p>
          <h2>تقرير النظافة اليومي</h2>
        </div>
        <Sparkles />
      </div>
      <Status report={report} />
      {locked ? (
        <p className="staff-empty">تم إرسال تقرير اليوم. ستظهر هنا نتيجة مراجعة المشرف.</p>
      ) : (
        <form action={action} className="staff-form staff-module-form">
          <input type="hidden" name="operation" value="cleaning" />
          <label>
            <span>ملاحظات النظافة</span>
            <textarea
              name="notes"
              minLength={10}
              maxLength={3000}
              rows={5}
              placeholder="اذكر المناطق التي تم تنظيفها وأي ملاحظات مهمة…"
              required
            />
          </label>
          <EvidenceInput multiple required />
          <Result state={state} operation="cleaning" />
          <SubmitButton
            disabled={pending}
            label={pending ? "جارٍ الإرسال…" : report ? "إعادة الإرسال" : "إرسال التقرير"}
          />
        </form>
      )}
    </section>
  );
}

function BaristaForm({ report }: { report: ReportStatus }) {
  const [state, action, pending] = useActionState(submitStaffModule, undefined);
  const locked = report?.status === "pending" || report?.status === "confirmed";
  return (
    <section className="staff-card staff-submission-card">
      <div className="staff-card-head">
        <div>
          <p className="staff-eyebrow">BAR HANDOVER</p>
          <h2>تقرير البار اليومي</h2>
        </div>
        <Coffee />
      </div>
      <Status report={report} />
      {locked ? (
        <p className="staff-empty">تم إرسال تقرير اليوم. ستظهر هنا نتيجة مراجعة المشرف.</p>
      ) : (
        <form action={action} className="staff-form staff-module-form">
          <input type="hidden" name="operation" value="barista" />
          <label>
            <span>ملاحظات التسليم</span>
            <textarea
              name="notes"
              minLength={10}
              maxLength={3000}
              rows={5}
              placeholder="سجّل حالة البار والتجهيزات وملاحظات الوردية التالية…"
              required
            />
          </label>
          <label className="staff-confirm-check">
            <input name="bar_clean_confirmed" type="checkbox" required />
            <span><Check /> أؤكد أن البار نظيف وجاهز للتسليم</span>
          </label>
          <EvidenceInput multiple />
          <Result state={state} operation="barista" />
          <SubmitButton
            disabled={pending}
            label={pending ? "جارٍ الإرسال…" : report ? "إعادة الإرسال" : "إرسال التقرير"}
          />
        </form>
      )}
    </section>
  );
}

function KitchenForm({ report }: { report: ReportStatus }) {
  const [state, action, pending] = useActionState(submitStaffModule, undefined);
  const nextId = useRef(2);
  const [inventory, setInventory] = useState<InventoryRow[]>([
    { id: 0, name: "", category: "product", count: "0" },
    { id: 1, name: "", category: "dessert", count: "0" },
  ]);
  const locked = report?.status === "pending" || report?.status === "confirmed";

  function update(id: number, patch: Partial<InventoryRow>) {
    setInventory((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function addItem() {
    const id = nextId.current++;
    setInventory((current) => [
      ...current,
      { id, name: "", category: "product", count: "0" },
    ]);
  }

  return (
    <section className="staff-card staff-submission-card">
      <div className="staff-card-head">
        <div>
          <p className="staff-eyebrow">KITCHEN & INVENTORY</p>
          <h2>تقرير المطبخ والجرد</h2>
        </div>
        <ChefHat />
      </div>
      <Status report={report} />
      {locked ? (
        <p className="staff-empty">تم إرسال تقرير اليوم. ستظهر هنا نتيجة مراجعة المشرف.</p>
      ) : (
        <form action={action} className="staff-form staff-module-form">
          <input type="hidden" name="operation" value="kitchen" />
          <input
            type="hidden"
            name="inventory_json"
            value={JSON.stringify(
              inventory.map(({ name, category, count }) => ({
                name,
                category,
                count: Number(count),
              })),
            )}
          />
          <label>
            <span>ملاحظات نظافة المطبخ</span>
            <textarea
              name="cleanliness_notes"
              minLength={10}
              maxLength={3000}
              rows={5}
              placeholder="سجّل حالة الأسطح والمعدات ومناطق التحضير…"
              required
            />
          </label>
          <EvidenceInput multiple required />

          <fieldset className="staff-inventory">
            <legend>جرد المنتجات والحلويات</legend>
            <div className="staff-inventory-list">
              {inventory.map((item) => (
                <div className="staff-inventory-row" key={item.id}>
                  <label>
                    <span>الصنف</span>
                    <input
                      value={item.name}
                      onChange={(event) => update(item.id, { name: event.target.value })}
                      maxLength={120}
                      required
                    />
                  </label>
                  <label>
                    <span>الفئة</span>
                    <select
                      value={item.category}
                      onChange={(event) =>
                        update(item.id, {
                          category: event.target.value as InventoryRow["category"],
                        })
                      }
                    >
                      <option value="product">منتج</option>
                      <option value="dessert">حلوى</option>
                    </select>
                  </label>
                  <label>
                    <span>العدد</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="100000"
                      step="1"
                      value={item.count}
                      onChange={(event) => update(item.id, { count: event.target.value })}
                      required
                    />
                  </label>
                  <button
                    type="button"
                    className="staff-remove-row"
                    aria-label={`حذف ${item.name || "الصنف"}`}
                    onClick={() =>
                      setInventory((current) =>
                        current.length > 2
                          ? current.filter((candidate) => candidate.id !== item.id)
                          : current
                      )
                    }
                    disabled={inventory.length <= 2}
                  >
                    <Trash2 />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="staff-secondary" onClick={addItem}>
              <Plus /> إضافة صنف
            </button>
          </fieldset>

          <Result state={state} operation="kitchen" />
          <SubmitButton
            disabled={pending}
            label={pending ? "جارٍ الإرسال…" : report ? "إعادة الإرسال" : "إرسال التقرير"}
          />
        </form>
      )}
    </section>
  );
}

function WaterForm({ latest }: { latest: Props["latestWater"] }) {
  const [state, action, pending] = useActionState(submitStaffModule, undefined);
  return (
    <section className="staff-card staff-submission-card">
      <div className="staff-card-head">
        <div>
          <p className="staff-eyebrow">WATER QUALITY</p>
          <h2>فحص جودة المياه</h2>
        </div>
        <Beaker />
      </div>
      {latest ? (
        <p className="staff-latest-reading">
          آخر قراءة اليوم: <strong>{latest.salt_ratio}</strong>
        </p>
      ) : null}
      <form action={action} className="staff-form staff-module-form">
        <input type="hidden" name="operation" value="water" />
        <label>
          <span>نسبة الملوحة</span>
          <input
            name="salt_ratio"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="0.00"
            required
          />
        </label>
        <label>
          <span>ملاحظات (اختياري)</span>
          <textarea
            name="notes"
            maxLength={1000}
            rows={3}
            placeholder="حالة الفلتر أو أي ملاحظة على القراءة…"
          />
        </label>
        <EvidenceInput name="photo" required />
        <Result state={state} operation="water" />
        <SubmitButton disabled={pending} label={pending ? "جارٍ التسجيل…" : "تسجيل الفحص"} />
      </form>
    </section>
  );
}

function BeverageForm({ consumed }: { consumed: boolean | null }) {
  const [state, action, pending] = useActionState(submitStaffModule, undefined);
  return (
    <section className="staff-card staff-submission-card staff-beverage-card">
      <div>
        <p className="staff-eyebrow">DAILY BEVERAGE</p>
        <h2>مشروب الموظف اليومي</h2>
        <p>
          {consumed == null
            ? "لم تسجّل حالتك اليوم."
            : consumed
              ? "تم تسجيل استهلاك مشروبك اليوم."
              : "تم تسجيل أنك لم تستهلك مشروباً اليوم."}
        </p>
      </div>
      <form action={action} className="staff-beverage-actions">
        <input type="hidden" name="operation" value="beverage" />
        <button
          className="staff-primary"
          name="consumed"
          value="true"
          type="submit"
          disabled={pending}
        >
          <Coffee /> استهلكت المشروب
        </button>
        <button
          className="staff-secondary"
          name="consumed"
          value="false"
          type="submit"
          disabled={pending}
        >
          لم أستهلكه
        </button>
        <Result state={state} operation="beverage" />
      </form>
    </section>
  );
}

export default function SubmissionForms({
  role,
  reports,
  latestWater,
  beverageConsumed,
}: Props) {
  const canCheckWater = ["owner", "manager", "supervisor", "kitchen_manager"].includes(role);
  const canLogBeverage = [
    "supervisor",
    "employee",
    "cleaning_staff",
    "barista",
    "kitchen_manager",
  ].includes(role);

  return (
    <div className="staff-submission-grid">
      {role === "cleaning_staff" ? <CleaningForm report={reports.cleaning} /> : null}
      {role === "barista" ? <BaristaForm report={reports.barista} /> : null}
      {role === "kitchen_manager" ? <KitchenForm report={reports.kitchen} /> : null}
      {canCheckWater ? <WaterForm latest={latestWater} /> : null}
      {canLogBeverage ? <BeverageForm consumed={beverageConsumed} /> : null}
    </div>
  );
}
