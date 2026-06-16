export default function Footer() {
  return (
    <div className="footer">
      <div className="footer-inner">
        <div className="footer-cols">
          <div>
            <div className="footer-brand">
              <span className="ar">تريس</span>
              <span className="en">TRES</span>
            </div>
            <p className="footer-about">
              ثلاثة أصول، حكاية واحدة. قهوة مختصة تُحمّص بدفعاتٍ صغيرة في الطائف،
              مدينة الورد.
            </p>
          </div>
          <div className="footer-col">
            <div className="title">الفروع</div>
            <div className="lines">
              الطائف — شبرا
              <br />
              الرياض — العليا
            </div>
          </div>
          <div className="footer-col">
            <div className="title">ساعات العمل</div>
            <div className="lines">
              السبت – الخميس
              <br />
              7:00ص — 12:00م
            </div>
          </div>
          <div className="footer-col">
            <div className="title">انضمّ لنشرتنا</div>
            <div className="newsletter">
              <input placeholder="بريدك الإلكتروني" />
              <button type="button">اشترك</button>
            </div>
            <div className="socials">
              <a
                href="https://www.instagram.com/tres_saudi"
                target="_blank"
                rel="noopener noreferrer"
              >
                انستقرام
              </a>
              <a
                href="https://www.tiktok.com/@tres.ksa"
                target="_blank"
                rel="noopener noreferrer"
              >
                تيك توك
              </a>
              <a
                href="https://snapchat.com/t/U1ejkI2G"
                target="_blank"
                rel="noopener noreferrer"
              >
                سناب شات
              </a>
            </div>
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
