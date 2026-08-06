"use client";

import { useActionState, useState } from "react";
import {
  Beaker,
  Check,
  ChefHat,
  Coffee,
  Minus,
  Plus,
  Send,
  Sparkles,
} from "lucide-react";
import type { StaffRole } from "../lib/staff-shared";
import { t, type Lang } from "../lib/staff-i18n";
import {
  BARISTA_CHECKS,
  CLEANING_CHECKS,
  INVENTORY_PRESET,
  KITCHEN_CHECKS,
  type CheckItem,
} from "../lib/staff-checks";
import PhotoCapture from "./PhotoCapture";
import { submitStaffModule, type SubmissionActionState } from "./submissions/actions";

export type ReportStatus = {
  status: "pending" | "confirmed" | "rejected";
  review_notes: string | null;
  revision: number;
} | null;

type Props = {
  role: StaffRole;
  lang: Lang;
  reports: { cleaning: ReportStatus; barista: ReportStatus; kitchen: ReportStatus };
  latestWater: { salt_ratio: number } | null;
  beverageConsumed: boolean | null;
};

const WATER_ROLES: StaffRole[] = ["owner", "manager", "supervisor", "kitchen_manager"];
const BEVERAGE_ROLES: StaffRole[] = [
  "supervisor",
  "employee",
  "cleaning_staff",
  "barista",
  "kitchen_manager",
];

/** Tap-to-answer grid. Each selected item emits a hidden `checks` input, so the
 *  action reads the whole selection with `formData.getAll("checks")`. */
function ChipGrid({ items, lang }: { items: CheckItem[]; lang: Lang }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  return (
    <>
      <div className="staff-chips">
        {items.map((item) => {
          const on = picked.has(item.key);
          return (
            <button
              key={item.key}
              type="button"
              className="staff-chip"
              data-on={on}
              aria-pressed={on}
              onClick={() => toggle(item.key)}
            >
              <span className="staff-chip-mark">{on ? <Check /> : null}</span>
              {item[lang]}
            </button>
          );
        })}
      </div>
      {[...picked].map((key) => (
        <input key={key} type="hidden" name="checks" value={key} />
      ))}
    </>
  );
}

function NoteField({ lang, name = "note" }: { lang: Lang; name?: string }) {
  return (
    <label className="staff-note-field">
      <span>{t("report_note_label", lang)}</span>
      <textarea name={name} rows={2} maxLength={1000} placeholder={t("report_note_hint", lang)} />
    </label>
  );
}

function StatusChip({ report, lang }: { report: ReportStatus; lang: Lang }) {
  if (!report) return null;
  return (
    <div className="staff-report-state" data-status={report.status}>
      <strong>{t(`report_state_${report.status}`, lang)}</strong>
      {report.status === "rejected" && report.review_notes ? (
        <p>
          <span>{t("report_supervisor_notes", lang)}:</span> {report.review_notes}
        </p>
      ) : null}
    </div>
  );
}

function Feedback({ state, operation }: { state: SubmissionActionState | undefined; operation: string }) {
  if (state?.operation !== operation) return null;
  return (
    <p className={state.error ? "staff-form-error" : "staff-form-success"} role={state.error ? "alert" : "status"}>
      {state.error ?? state.message}
    </p>
  );
}

function SendButton({ lang, pending, resend }: { lang: Lang; pending: boolean; resend: boolean }) {
  return (
    <button className="staff-big-submit" type="submit" disabled={pending}>
      <Send />
      {pending ? t("report_sending", lang) : resend ? t("report_resend", lang) : t("report_send", lang)}
    </button>
  );
}

/** Cleaning, bar handover, and kitchen share one shape: tap the areas, add a
 *  photo, optionally write a note. Only the extras differ. */
function ChecklistReport({
  operation,
  title,
  icon,
  items,
  report,
  lang,
  photoRequired,
  children,
}: {
  operation: "cleaning" | "barista" | "kitchen";
  title: string;
  icon: React.ReactNode;
  items: CheckItem[];
  report: ReportStatus;
  lang: Lang;
  photoRequired: boolean;
  children?: React.ReactNode;
}) {
  const [state, action, pending] = useActionState(submitStaffModule, undefined);
  const locked = report?.status === "pending" || report?.status === "confirmed";

  return (
    <section className="staff-block-card" id={`report-${operation}`}>
      <h2 className="staff-block-title">
        {icon} {title}
      </h2>
      <StatusChip report={report} lang={lang} />
      {locked ? null : (
        <form action={action} className="staff-tap-form">
          <input type="hidden" name="operation" value={operation} />
          <p className="staff-tap-hint">{t("report_pick_hint", lang)}</p>
          <ChipGrid items={items} lang={lang} />
          {children}
          <PhotoCapture
            lang={lang}
            multiple
            required={photoRequired}
            label={photoRequired ? undefined : t("photo_optional", lang)}
          />
          <NoteField lang={lang} />
          <Feedback state={state} operation={operation} />
          <SendButton lang={lang} pending={pending} resend={report?.status === "rejected"} />
        </form>
      )}
    </section>
  );
}

function KitchenInventory({ lang }: { lang: Lang }) {
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(INVENTORY_PRESET.map((item) => [item.key, 0])),
  );

  function step(key: string, delta: number) {
    setCounts((current) => ({
      ...current,
      [key]: Math.min(9999, Math.max(0, (current[key] ?? 0) + delta)),
    }));
  }

  return (
    <div className="staff-stock">
      <p className="staff-tap-hint">
        {t("inventory_title", lang)} — {t("inventory_hint", lang)}
      </p>
      <input
        type="hidden"
        name="inventory_json"
        value={JSON.stringify(
          INVENTORY_PRESET.map((item) => ({
            name: item.ar,
            category: item.category,
            count: counts[item.key] ?? 0,
          })),
        )}
      />
      <ul>
        {INVENTORY_PRESET.map((item) => {
          const name = item[lang];
          return (
            <li key={item.key}>
              <span className="staff-stock-name">
                {name}
                <small>{t(`inventory_${item.category}`, lang)}</small>
              </span>
              <span className="staff-stepper">
                <button
                  type="button"
                  onClick={() => step(item.key, -1)}
                  aria-label={t("inventory_decrease", lang, { name })}
                >
                  <Minus />
                </button>
                <strong>{counts[item.key] ?? 0}</strong>
                <button
                  type="button"
                  onClick={() => step(item.key, 1)}
                  aria-label={t("inventory_increase", lang, { name })}
                >
                  <Plus />
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function BarConfirm({ lang }: { lang: Lang }) {
  const [on, setOn] = useState(false);
  return (
    <>
      <button
        type="button"
        className="staff-confirm-toggle"
        data-on={on}
        aria-pressed={on}
        onClick={() => setOn((current) => !current)}
      >
        <span className="staff-chip-mark">{on ? <Check /> : null}</span>
        {t("bar_clean_confirm", lang)}
      </button>
      {on ? <input type="hidden" name="bar_clean_confirmed" value="on" /> : null}
    </>
  );
}

function WaterCheck({ lang, latest }: { lang: Lang; latest: Props["latestWater"] }) {
  const [state, action, pending] = useActionState(submitStaffModule, undefined);
  return (
    <section className="staff-block-card" id="report-water">
      <h2 className="staff-block-title">
        <Beaker /> {t("water_title", lang)}
      </h2>
      {latest ? (
        <p className="staff-tap-hint">
          {t("water_latest", lang)}: <strong>{latest.salt_ratio}</strong>
        </p>
      ) : null}
      <form action={action} className="staff-tap-form">
        <input type="hidden" name="operation" value="water" />
        <label className="staff-note-field">
          <span>{t("water_salt", lang)}</span>
          <input name="salt_ratio" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00" required />
        </label>
        <PhotoCapture lang={lang} name="photo" required />
        <NoteField lang={lang} />
        <Feedback state={state} operation="water" />
        <button className="staff-big-submit" type="submit" disabled={pending}>
          <Send />
          {pending ? t("water_sending", lang) : t("water_send", lang)}
        </button>
      </form>
    </section>
  );
}

function BeverageRow({ lang, consumed }: { lang: Lang; consumed: boolean | null }) {
  const [state, action, pending] = useActionState(submitStaffModule, undefined);
  return (
    <section className="staff-block-card staff-beverage">
      <h2 className="staff-block-title">
        <Coffee /> {t("beverage_title", lang)}
      </h2>
      <form action={action} className="staff-two-up">
        <input type="hidden" name="operation" value="beverage" />
        <button
          className="staff-choice"
          data-on={consumed === true}
          name="consumed"
          value="true"
          type="submit"
          disabled={pending}
        >
          <Check /> {t("beverage_yes", lang)}
        </button>
        <button
          className="staff-choice"
          data-on={consumed === false}
          name="consumed"
          value="false"
          type="submit"
          disabled={pending}
        >
          {t("beverage_no", lang)}
        </button>
      </form>
      <Feedback state={state} operation="beverage" />
    </section>
  );
}

export default function DailyReport({ role, lang, reports, latestWater, beverageConsumed }: Props) {
  return (
    <>
      {role === "cleaning_staff" ? (
        <ChecklistReport
          operation="cleaning"
          title={t("report_cleaning", lang)}
          icon={<Sparkles />}
          items={CLEANING_CHECKS}
          report={reports.cleaning}
          lang={lang}
          photoRequired
        />
      ) : null}

      {role === "barista" ? (
        <ChecklistReport
          operation="barista"
          title={t("report_barista", lang)}
          icon={<Coffee />}
          items={BARISTA_CHECKS}
          report={reports.barista}
          lang={lang}
          photoRequired={false}
        >
          <BarConfirm lang={lang} />
        </ChecklistReport>
      ) : null}

      {role === "kitchen_manager" ? (
        <ChecklistReport
          operation="kitchen"
          title={t("report_kitchen", lang)}
          icon={<ChefHat />}
          items={KITCHEN_CHECKS}
          report={reports.kitchen}
          lang={lang}
          photoRequired
        >
          <KitchenInventory lang={lang} />
        </ChecklistReport>
      ) : null}

      {WATER_ROLES.includes(role) ? <WaterCheck lang={lang} latest={latestWater} /> : null}
      {BEVERAGE_ROLES.includes(role) ? <BeverageRow lang={lang} consumed={beverageConsumed} /> : null}
    </>
  );
}
