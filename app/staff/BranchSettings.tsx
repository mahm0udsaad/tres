"use client";

import { startTransition, useActionState } from "react";
import { Save } from "lucide-react";
import type { Branch } from "../lib/staff-shared";
import LocationPicker from "../components/LocationPicker";
import { resolveOwnBranchLocation, updateOwnBranch } from "./actions";

export default function BranchSettings({ branch }: { branch: Branch }) {
  const [state, action, pending] = useActionState(updateOwnBranch, undefined);

  return (
    <section className="staff-card staff-branch">
      <div className="staff-card-head">
        <div>
          <h2>نطاق تسجيل الحضور</h2>
        </div>
      </div>
      <form
        className="staff-form staff-branch-form"
        action={(form) => startTransition(() => action(form))}
      >
        <label className="staff-field-wide">
          <span>اسم الفرع</span>
          <input name="name" defaultValue={branch.name} required />
        </label>
        <div className="staff-field-wide">
          <LocationPicker
            latitude={branch.latitude}
            longitude={branch.longitude}
            resolveShare={resolveOwnBranchLocation}
          />
        </div>
        <label className="staff-field-wide">
          <span>نصف القطر المسموح (متر)</span>
          <input
            name="radius_meters"
            type="number"
            min="10"
            max="5000"
            defaultValue={branch.radius_meters}
            required
          />
        </label>
        <div className="staff-field-wide">
          {state?.error ? <p className="staff-form-error">{state.error}</p> : null}
          {state?.message ? <p className="staff-form-success">{state.message}</p> : null}
          <button type="submit" className="staff-primary" disabled={pending}>
            <Save /> {pending ? "جارٍ الحفظ…" : "حفظ نطاق الفرع"}
          </button>
        </div>
      </form>
    </section>
  );
}
