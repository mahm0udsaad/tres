import type { Metadata } from "next";
import { TresQr } from "./qr";
import PrintButton from "./PrintButton";

const SITE_URL = "https://tres-three.vercel.app/";

export const metadata: Metadata = {
  title: "بطاقة الطاولة — تريس",
  robots: { index: false },
};

export default function TableCardPage() {
  return (
    <div className="card-stage">
      {/* The printable table tent */}
      <div className="tent" id="tres-card">
        <div className="tent-noise" />
        <div className="tent-top">
          <span className="tent-ar">تريس</span>
          <span className="tent-en">TRES</span>
        </div>

        <p className="tent-kicker">قهوه مختصه . تجربه مختلفه</p>
        <h1 className="tent-title">امسح وتصفّح المنيو</h1>

        <div className="qr-frame">
          <TresQr url={SITE_URL} />
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="tent-mascot" src="/assets/mascot-sitting.png" alt="" aria-hidden="true" />

        <div className="tent-url">tres-three.vercel.app</div>
      </div>

      <PrintButton />
    </div>
  );
}
