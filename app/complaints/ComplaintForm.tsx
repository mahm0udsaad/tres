"use client";

import { useState } from "react";
import Link from "next/link";

const TYPES = [
  { value: "service", label: "الخدمة" },
  { value: "product", label: "المنتج أو الطلب" },
  { value: "place", label: "المكان والأجواء" },
  { value: "other", label: "أخرى" },
];

type Status = "idle" | "submitting" | "success" | "error";

export default function ComplaintForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    if (!String(data.contact ?? "").trim()) {
      setError("اكتب رقم الجوال من فضلك.");
      return;
    }

    if (!String(data.message ?? "").trim()) {
      setError("اكتب لنا تفاصيل الشكوى من فضلك.");
      return;
    }

    setStatus("submitting");
    try {
      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("bad response");
      setStatus("success");
      form.reset();
    } catch {
      setStatus("error");
      setError("صار خطأ غير متوقع. جرّب مرة ثانية بعد لحظات.");
    }
  }

  if (status === "success") {
    return (
      <div className="complaint-done" data-reveal>
        <div className="complaint-done-mark">✓</div>
        <h2>وصلتنا شكواك</h2>
        <p>
          شكرًا لأنك أخذت وقتك تكلّمنا. بنطّلع عليها ونتابعها، وبنرجع لك على رقم
          الجوال المسجل.
        </p>
        <div className="complaint-done-actions">
          <button type="button" className="btn btn-cta-primary" onClick={() => setStatus("idle")}>
            إرسال شكوى أخرى
          </button>
          <Link href="/" className="btn-cta-ghost btn">
            الرجوع للرئيسية
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form className="complaint-form" onSubmit={onSubmit} noValidate>
      <div className="complaint-field">
        <label htmlFor="name">الاسم</label>
        <input id="name" name="name" type="text" autoComplete="name" placeholder="اسمك (اختياري)" />
      </div>

      <div className="complaint-field">
        <label htmlFor="contact">رقم الجوال</label>
        <input
          id="contact"
          name="contact"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          placeholder="رقم الجوال عشان نرجع لك"
        />
      </div>

      <div className="complaint-field">
        <label htmlFor="type">نوع الشكوى</label>
        <select id="type" name="type" defaultValue="service">
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="complaint-field">
        <label htmlFor="message">التفاصيل</label>
        <textarea
          id="message"
          name="message"
          rows={6}
          required
          placeholder="اكتب لنا وش صار بالتفصيل…"
        />
      </div>

      {error && <p className="complaint-error">{error}</p>}

      <button type="submit" className="btn btn-cta-primary complaint-submit" disabled={status === "submitting"}>
        {status === "submitting" ? "جاري الإرسال…" : "إرسال الشكوى"}
      </button>
    </form>
  );
}
