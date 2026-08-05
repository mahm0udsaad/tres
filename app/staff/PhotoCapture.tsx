"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, RotateCcw, X } from "lucide-react";
import { t, type Lang } from "../lib/staff-i18n";

const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";

type Props = {
  lang: Lang;
  /** Form-field name. Omit in callback mode. */
  name?: string;
  multiple?: boolean;
  required?: boolean;
  label?: string;
  busy?: boolean;
  /** Callback mode: the caller submits after the employee confirms the shot. */
  onConfirm?: (file: File) => void;
};

/**
 * Big camera tile with a preview step.
 *
 * The old flow fired the upload the instant the file picker returned — no
 * preview, no way to retake a blurry shot. Here the photo is always shown
 * back before it counts: in form mode the previews sit above the submit
 * button, and in callback mode nothing is sent until "use this photo".
 *
 * The native input stays the source of truth for `files`, so this drops into
 * a plain `<form action>` without any FileList reconstruction.
 */
export default function PhotoCapture({
  lang,
  name = "photos",
  multiple = false,
  required = false,
  label,
  busy = false,
  onConfirm,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const callbackMode = typeof onConfirm === "function";

  useEffect(() => {
    const next = files.map((file) => URL.createObjectURL(file));
    setUrls(next);
    return () => next.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  function open() {
    inputRef.current?.click();
  }

  function clear() {
    if (inputRef.current) inputRef.current.value = "";
    setFiles([]);
  }

  function retake() {
    clear();
    open();
  }

  const hasPhotos = files.length > 0;

  return (
    <div className="staff-photo" data-has={hasPhotos}>
      <input
        ref={inputRef}
        // In callback mode the input is detached from any form submission.
        name={callbackMode ? undefined : name}
        type="file"
        accept={PHOTO_ACCEPT}
        capture="environment"
        multiple={multiple}
        required={required && !callbackMode}
        hidden
        onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
      />

      {hasPhotos ? (
        <>
          <div className="staff-photo-previews">
            {urls.map((url, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={url} alt={`${index + 1}`} />
            ))}
            <button type="button" className="staff-photo-clear" onClick={clear} aria-label={t("photo_retake", lang)}>
              <X />
            </button>
          </div>
          <div className="staff-photo-actions">
            <button type="button" className="staff-chip-button" onClick={retake} disabled={busy}>
              <RotateCcw /> {t("photo_retake", lang)}
            </button>
            {callbackMode ? (
              <button
                type="button"
                className="staff-chip-button staff-chip-button--go"
                onClick={() => {
                  const file = files[0];
                  if (file) onConfirm?.(file);
                  clear();
                }}
                disabled={busy}
              >
                <Check /> {t("photo_confirm", lang)}
              </button>
            ) : (
              <span className="staff-photo-count">
                <Check /> {t("photo_selected", lang, { count: files.length })}
              </span>
            )}
          </div>
        </>
      ) : (
        <button type="button" className="staff-photo-tile" onClick={open} disabled={busy}>
          <Camera />
          <span>{label ?? t(multiple ? "photo_take_more" : "photo_take", lang)}</span>
        </button>
      )}
    </div>
  );
}
