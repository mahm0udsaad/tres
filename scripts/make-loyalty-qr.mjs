// Generate the loyalty-program QR shown in the on-site popup.
// Usage: node scripts/make-loyalty-qr.mjs "https://your-loyalty-link"
// Replace public/assets/loyalty-qr.png with your own barcode image any time.
import QRCode from "qrcode";

const url = process.argv[2] || "https://www.instagram.com/tres_saudi";
const out = "public/assets/loyalty-qr.png";

await QRCode.toFile(out, url, {
  width: 720,
  margin: 2,
  errorCorrectionLevel: "H",
  color: { dark: "#23120f", light: "#ffffff" },
});
console.log(`wrote ${out} → ${url}`);
