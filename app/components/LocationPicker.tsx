"use client";

import { useState, useTransition } from "react";
import { LocateFixed, MapPin, ExternalLink } from "lucide-react";
import { isShareLink, parseLatLng } from "../lib/geo-link";
import "./location-picker.css";

type Resolved = { latitude: number; longitude: number };
type ResolveAction = (link: string) => Promise<Resolved | { error: string }>;

const MESSAGES = {
  hint: "الصق رابط الموقع من خرائط قوقل، أو اضغط «موقعي الحالي» وأنت في الفرع.",
  placeholder: "https://maps.app.goo.gl/… أو 21.277932, 40.4348957",
  extract: "قراءة الموقع",
  reading: "جارٍ القراءة…",
  here: "موقعي الحالي",
  locating: "جارٍ التحديد…",
  manual: "إدخال الإحداثيات يدويًا",
  empty: "لم يُحدَّد موقع بعد.",
  unreadable: "لم نتعرّف على موقع في هذا النص — انسخ الرابط من زر «مشاركة» في خرائط قوقل.",
  denied: "تعذّر الوصول إلى موقعك — اسمح بالوصول للموقع في المتصفح أو الصق رابط الخريطة.",
  verify: "تحقّق على الخريطة",
};

export default function LocationPicker({
  latitude,
  longitude,
  resolveShare,
}: {
  latitude?: number | null;
  longitude?: number | null;
  /** Server action used only for short share links, which carry no coordinates. */
  resolveShare: ResolveAction;
}) {
  const [coords, setCoords] = useState({
    latitude: latitude == null ? "" : String(latitude),
    longitude: longitude == null ? "" : String(longitude),
  });
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);
  const [reading, startReading] = useTransition();

  function apply(found: Resolved) {
    setCoords({ latitude: String(found.latitude), longitude: String(found.longitude) });
    setError("");
  }

  function readLink(value: string) {
    const text = value.trim();
    if (!text) return;
    // Full URLs and pasted coordinates never leave the browser.
    const local = parseLatLng(text);
    if (local) {
      apply(local);
      return;
    }
    if (!isShareLink(text)) {
      setError(MESSAGES.unreadable);
      return;
    }
    startReading(async () => {
      const result = await resolveShare(text);
      if ("error" in result) setError(result.error);
      else apply(result);
    });
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError(MESSAGES.denied);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords: position }) => {
        apply({ latitude: position.latitude, longitude: position.longitude });
        setLocating(false);
      },
      () => {
        setError(MESSAGES.denied);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  const chosen = coords.latitude !== "" && coords.longitude !== "";

  return (
    <div className="loc-picker">
      <p className="loc-hint">{MESSAGES.hint}</p>

      <div className="loc-input-row">
        <input
          className="loc-input"
          type="text"
          inputMode="url"
          dir="ltr"
          value={link}
          placeholder={MESSAGES.placeholder}
          aria-label={MESSAGES.hint}
          onChange={(event) => {
            setLink(event.target.value);
            setError("");
          }}
          // Pasting is the expected gesture — read it without a second click.
          onPaste={(event) => {
            const pasted = event.clipboardData.getData("text");
            if (pasted) window.setTimeout(() => readLink(pasted), 0);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            readLink(link);
          }}
        />
        <button
          type="button"
          className="loc-btn"
          onClick={() => readLink(link)}
          disabled={reading || !link.trim()}
        >
          <MapPin aria-hidden />
          {reading ? MESSAGES.reading : MESSAGES.extract}
        </button>
      </div>

      <button type="button" className="loc-btn loc-btn--ghost" onClick={useCurrentLocation}>
        <LocateFixed aria-hidden />
        {locating ? MESSAGES.locating : MESSAGES.here}
      </button>

      <p className="loc-status" data-state={chosen ? "set" : "empty"} aria-live="polite">
        {chosen ? (
          <>
            <span dir="ltr">
              {Number(coords.latitude).toFixed(6)}, {Number(coords.longitude).toFixed(6)}
            </span>
            <a
              className="loc-verify"
              href={`https://www.google.com/maps/search/?api=1&query=${coords.latitude},${coords.longitude}`}
              target="_blank"
              rel="noreferrer"
            >
              {MESSAGES.verify} <ExternalLink aria-hidden />
            </a>
          </>
        ) : (
          MESSAGES.empty
        )}
      </p>

      {error ? <p className="loc-error">{error}</p> : null}

      <details className="loc-manual">
        <summary>{MESSAGES.manual}</summary>
        <div className="loc-manual-grid">
          <label>
            <span>خط العرض</span>
            <input
              name="latitude"
              type="number"
              step="any"
              dir="ltr"
              value={coords.latitude}
              onChange={(event) =>
                setCoords((current) => ({ ...current, latitude: event.target.value }))
              }
            />
          </label>
          <label>
            <span>خط الطول</span>
            <input
              name="longitude"
              type="number"
              step="any"
              dir="ltr"
              value={coords.longitude}
              onChange={(event) =>
                setCoords((current) => ({ ...current, longitude: event.target.value }))
              }
            />
          </label>
        </div>
      </details>
    </div>
  );
}
