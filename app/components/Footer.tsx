import Image from "next/image";
import SocialLinks from "./SocialLinks";

export default function Footer() {
  return (
    <div className="footer">
      <div className="footer-inner">
        <div className="footer-cols">
          <div>
            <div className="footer-brand">
              <Image
                src="/assets/logo/tres-mark-white.png"
                alt="TRES Logo"
                width={160}
                height={160}
                loading="eager"
                style={{ width: "160px", height: "auto" }}
              />
            </div>
            <p className="footer-about">
              ثلاثة محاصيل، حكاية واحدة. قهوة مختصة من الطائف، نحمّصها بدفعات
              صغيرة ونقدّمها بطعم واضح ومتوازن.
            </p>
          </div>
          <div className="footer-col">
            <div className="title">من الطائف</div>
            <div className="lines">
              قهوة مختصة بثلاثة محاصيل
              <br />
              بطابع تريس الهادئ
            </div>
          </div>
          <div className="footer-col">
            <div className="title">ساعات العمل</div>
            <div className="lines">
              نحدّثها عبر حساباتنا
              <br />
              تابع جديدنا هناك
            </div>
          </div>
          <div className="footer-col">
            <div className="title">تابع جديدنا</div>
            <SocialLinks />
          </div>
        </div>
        <div className="footer-base">
          <span>© 2026 تريس — جميع الحقوق محفوظة.</span>
          <span className="en">THREE ORIGINS · ONE STORY</span>
        </div>
      </div>
    </div>
  );
}
