"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, RotateCcw, X } from "lucide-react";
import { t, type Lang } from "../lib/staff-i18n";

const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";
const MAX_CAPTURE_DIMENSION = 1920;
const JPEG_QUALITY = 0.8;

/** Shrink standard camera formats in the browser before they enter a server
 * action. Unsupported formats (notably some HEIC implementations) fall back
 * unchanged rather than preventing the employee from submitting a report. */
async function compressCapture(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || ["image/heic", "image/heif"].includes(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_CAPTURE_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "photo"}.jpg`, {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}

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
  const [processing, setProcessing] = useState(false);
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

  async function selectFiles(nextFiles: File[]) {
    setProcessing(true);
    const compressed = await Promise.all(nextFiles.map(compressCapture));
    if (inputRef.current && !callbackMode) {
      try {
        const transfer = new DataTransfer();
        compressed.forEach((file) => transfer.items.add(file));
        inputRef.current.files = transfer.files;
      } catch {
        // The preview still shows the chosen files; unsupported browsers submit
        // the original capture and the larger server-side fallback applies.
      }
    }
    setFiles(compressed);
    setProcessing(false);
  }

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
        onChange={(event) => void selectFiles(Array.from(event.target.files ?? []))}
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
            <button type="button" className="staff-chip-button" onClick={retake} disabled={busy || processing}>
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
                disabled={busy || processing}
              >
                <Check /> {t("photo_confirm", lang)}
              </button>
            ) : (
              <span className="staff-photo-count">
                <Check /> {processing ? "جارٍ تجهيز الصورة…" : t("photo_selected", lang, { count: files.length })}
              </span>
            )}
          </div>
        </>
      ) : (
        <button type="button" className="staff-photo-tile" onClick={open} disabled={busy || processing}>
          <Camera />
          <span>{label ?? t(multiple ? "photo_take_more" : "photo_take", lang)}</span>
        </button>
      )}
    </div>
  );
}
