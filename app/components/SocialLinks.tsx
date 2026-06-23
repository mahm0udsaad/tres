"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { SITE } from "../lib/site";

const SocialQr = dynamic(
  () => import("../table-card/qr").then((module) => module.TresQr),
  {
    ssr: false,
    loading: () => <div className="social-qr-loading" aria-label="جارٍ إنشاء رمز QR" />,
  },
);

const socialLinks = [
  { id: "instagram", label: "إنستغرام", url: SITE.instagram },
  { id: "tiktok", label: "تيك توك", url: SITE.tiktok },
  { id: "snapchat", label: "سناب شات", url: SITE.snapchat },
] as const;

type SocialLink = (typeof socialLinks)[number];

function SocialIcon({ id }: { id: SocialLink["id"] }) {
  if (id === "instagram") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.67 4.77-4.92 4.92-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.15-3.23 1.67-4.77 4.92-4.92 1.27-.06 1.65-.07 4.85-.07ZM12 0C8.74 0 8.33.01 7.05.07 2.7.27.27 2.69.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.36 2.62 6.78 6.98 6.98 1.28.06 1.69.07 4.95.07s3.67-.01 4.95-.07c4.35-.2 6.78-2.62 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95C23.73 2.7 21.31.27 16.95.07 15.67.01 15.26 0 12 0Zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.41-11.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88Z" />
      </svg>
    );
  }

  if (id === "tiktok") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 15.66a6.34 6.34 0 0 0 10.86 4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.1 1.52c-1.39.02-2.73.47-3.86 1.25a6.04 6.04 0 0 0-2.18 3.32c-.32 1.13-.38 2.33-.28 3.5.06.66.19 1.32.41 1.95.14.4.3.79.52 1.15.11.19.24.38.38.56l.09.11c-.2.03-.4.07-.59.13a5.02 5.02 0 0 0-1.8 1.05 4.42 4.42 0 0 0-1.02 1.4c-.23.49-.33 1.03-.31 1.57.02.6.21 1.19.56 1.7a2.8 2.8 0 0 0 1.21.94c.32.14.65.25.99.34.45.1.92.17 1.39.2l.2.02.04.22c.07.41.2 .8.39 1.18.2.4.47.78.78 1.12.35.38.74.7 1.17.97.5.31 1.03.55 1.59.72a6.9 6.9 0 0 0 3.71.05c.53-.14 1.03-.35 1.51-.61.42-.24.81-.54 1.16-.88.35-.35.65-.75.89-1.18.23-.42.4-.87.49-1.34l.05-.28.27-.04c.47-.07.94-.17 1.4-.33.37-.12.72-.28 1.05-.48a3.1 3.1 0 0 0 1.07-1.02 2.3 2.3 0 0 0 .32-1.38c-.03-.55-.2-1.08-.5-1.57a4.2 4.2 0 0 0-1.19-1.22 5.38 5.38 0 0 0-1.83-1c-.24-.07-.49-.12-.74-.16l-.08-.01.07-.1a5.6 5.6 0 0 0 1-2.48c.18-.83.24-1.68.22-2.53-.02-1.04-.21-2.07-.57-3.04A6.16 6.16 0 0 0 16 3.1a6.64 6.64 0 0 0-3.9-1.58zm-.11 1.46c.92-.01 1.83.26 2.59.78a4.67 4.67 0 0 1 1.64 2.51c.25.86.32 1.75.25 2.63-.05.61-.17 1.21-.35 1.8a5.55 5.55 0 0 1-.63 1.34l-.44.7 1.13.1c.4.03.8.09 1.19.19a3.83 3.83 0 0 1 1.33.68c.24.19.44.43.6.7a.84.84 0 0 1 .12.5c.02.26-.06.51-.23.7-.17.18-.39.3-.61.39-.42.17-.86.29-1.3.37-.53.1-1.08.16-1.62.24l-.94.13.25.9c.14.49.17 1.01.09 1.52-.08.48-.26.94-.52 1.36-.26.4-.58.76-.95 1.06-.39.31-.83.56-1.3.74a4.4 4.4 0 0 1-1.8.27 4.6 4.6 0 0 1-1.81-.39c-.43-.19-.84-.44-1.2-.76-.35-.3-.65-.67-.89-1.06a3.52 3.52 0 0 1-.48-1.4 3.73 3.73 0 0 1 .07-1.43l.22-.88-1-.07a10.96 10.96 0 0 1-1.66-.25c-.45-.1-.89-.25-1.3-.47a1.44 1.44 0 0 1-.65-.54.91.91 0 0 1-.13-.56c.01-.29.13-.57.34-.78a3.16 3.16 0 0 1 .76-.55 3.96 3.96 0 0 1 1.23-.46c.38-.08.76-.13 1.15-.17l1.04-.12-.4-.84a4.85 4.85 0 0 1-.43-1.6 5.31 5.31 0 0 1 .07-1.74c.09-.59.26-1.16.51-1.7a4.67 4.67 0 0 1 1.75-2 5.03 5.03 0 0 1 2.78-1.01z" />
    </svg>
  );
}

export default function SocialLinks() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<SocialLink | null>(null);

  useEffect(() => {
    if (selected && !dialogRef.current?.open) {
      dialogRef.current?.showModal();
    }
  }, [selected]);

  return (
    <>
      <div className="socials">
        {socialLinks.map((social) => (
          <button
            key={social.id}
            type="button"
            title={social.label}
            aria-label={`عرض رمز QR ورابط ${social.label}`}
            onClick={() => setSelected(social)}
          >
            <SocialIcon id={social.id} />
          </button>
        ))}
      </div>

      <dialog
        ref={dialogRef}
        className="social-dialog"
        aria-labelledby="social-dialog-title"
        onClose={() => setSelected(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        {selected ? (
          <div className="social-dialog-card">
            <button
              type="button"
              className="social-dialog-close"
              aria-label="إغلاق"
              onClick={() => dialogRef.current?.close()}
            >
              ×
            </button>
            <div className="social-dialog-icon">
              <SocialIcon id={selected.id} />
            </div>
            <h2 id="social-dialog-title">{selected.label}</h2>
            <div className="social-dialog-qr">
              <SocialQr
                url={selected.url}
                ariaLabel={`رمز QR لحساب تريس على ${selected.label}`}
              />
            </div>
            <a
              className="social-dialog-link"
              href={selected.url}
              target="_blank"
              rel="noopener noreferrer"
              dir="ltr"
            >
              {selected.url}
            </a>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
