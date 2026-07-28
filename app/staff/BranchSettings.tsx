"use client";

import { startTransition, useActionState, useState } from "react";
import { LocateFixed, Save } from "lucide-react";
import type { Branch } from "../lib/staff-shared";
import { updateOwnBranch } from "./actions";

export default function BranchSettings({ branch }: { branch: Branch }) {
  const [state, action, pending] = useActionState(updateOwnBranch, undefined);
  const [coords, setCoords] = useState({
    latitude: String(branch.latitude),
    longitude: String(branch.longitude),
  });
  const [locating, setLocating] = useState(false);

  function useCurrentLocation() {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords: next }) => {
        setCoords({
          latitude: String(next.latitude),
          longitude: String(next.longitude),
        });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  return (
    <section className="staff-card staff-branch">
      <div className="staff-card-head">
        <div>
          <p className="staff-eyebrow">BRANCH AREA</p>
          <h2>نطاق تسجيل الحضور</h2>
        </div>
        <button type="button" className="staff-icon-button" onClick={useCurrentLocation}>
          <LocateFixed />
          <span>{locating ? "جارٍ التحديد…" : "موقعي الحالي"}</span>
        </button>
      </div>
      <form
        className="staff-form staff-branch-form"
        action={(form) => startTransition(() => action(form))}
      >
        <label className="staff-field-wide">
          <span>اسم الفرع</span>
          <input name="name" defaultValue={branch.name} required />
        </label>
        <label>
          <span>خط العرض</span>
          <input
            name="latitude"
            type="number"
            step="any"
            value={coords.latitude}
            onChange={(event) => setCoords((current) => ({ ...current, latitude: event.target.value }))}
            required
          />
        </label>
        <label>
          <span>خط الطول</span>
          <input
            name="longitude"
            type="number"
            step="any"
            value={coords.longitude}
            onChange={(event) => setCoords((current) => ({ ...current, longitude: event.target.value }))}
            required
          />
        </label>
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
