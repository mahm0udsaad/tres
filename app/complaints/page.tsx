import type { Metadata } from "next";
import ComplaintForm from "./ComplaintForm";

export const metadata: Metadata = {
  title: "قدّم شكوى — تريس",
  description: "رأيك يهمنا. شاركنا أي ملاحظة أو شكوى وبنتابعها معك.",
};

export default function ComplaintsPage() {
  return (
    <div className="complaints-page">
      <section className="complaints-hero">
        <div className="wrap narrow">
          <div className="section-kicker">COMPLAINTS · شكاوى</div>
          <h1>عندك ملاحظة؟</h1>
          <p>
            رأيك يهمنا. إذا واجهتك أي مشكلة أو عندك شكوى، عبّر لنا عنها هنا
            ونوعدك نتابعها.
          </p>
        </div>
      </section>

      <section className="complaints-body">
        <div className="wrap narrow">
          <ComplaintForm />
        </div>
      </section>
    </div>
  );
}
