import { SITE_URL } from "./lib/site";
import type { Metadata } from "next";
import RootShell from "./RootShell";

/**
 * 404 for a URL that matches no route at all. The app has three root layouts
 * (site / admin / staff — see app/RootShell.tsx), so there is no single layout
 * to build this from; Next renders this file on its own instead.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "الصفحة غير موجودة — تريس",
  robots: { index: false },
};

export default function GlobalNotFound() {
  return (
    <RootShell theme="classic">
      <main
        style={{
          minHeight: "100svh",
          display: "grid",
          placeItems: "center",
          textAlign: "center",
          padding: "24px 16px",
        }}
      >
        <div>
          <p style={{ fontSize: 14, opacity: 0.7, letterSpacing: "0.2em" }} dir="ltr">
            404
          </p>
          <h1 style={{ margin: "8px 0 12px" }}>الصفحة اللي تدورها مو هنا</h1>
          <p style={{ opacity: 0.8, marginBottom: 24 }}>يمكن الرابط تغيّر أو انكتب غلط.</p>
          {/* A plain anchor: this page sits outside every root layout, so a
              client-side <Link> would do a full load anyway. */}
          <a href="/" className="btn btn-blush">
            رجوع للرئيسية
          </a>
        </div>
      </main>
    </RootShell>
  );
}
