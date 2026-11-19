import Image from "next/image";
import Link from "next/link";
import { MapPin } from "lucide-react";
import WhatsAppIcon from "./WhatsAppIcon";
import SocialLinks from "./SocialLinks";
import { getPublicSettings } from "../lib/data";
import { mapsLink, waLink } from "../lib/contact";

export default async function Footer() {
  // Owner-set channels (control panel → الإعدادات). The WhatsApp button is
  // hidden until a number is saved, rather than linking nowhere.
  const settings = await getPublicSettings();
  const wa = waLink(settings.whatsapp, "السلام عليكم، ودي أستفسر عن تريس");
  const maps = mapsLink(settings.mapsUrl);

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
            <div className="title">زورنا</div>
            <div className="lines">
              {settings.address || "قهوة مختصة بثلاثة محاصيل، من الطائف"}
            </div>
            <div className="footer-actions">
              <a className="footer-action" href={maps} target="_blank" rel="noreferrer">
                <MapPin strokeWidth={2} aria-hidden="true" />
                الموقع على الخريطة
              </a>
              {wa && (
                <a className="footer-action" href={wa} target="_blank" rel="noreferrer">
                  <WhatsAppIcon />
                  واتساب
                </a>
              )}
              <Link className="footer-action" href="/catering">
                حجز كاترينغ
              </Link>
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
