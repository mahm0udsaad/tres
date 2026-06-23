import QRCode from "qrcode";
import type { ReactNode } from "react";

/**
 * Branded TRES QR: burgundy rounded dots on cream, custom rounded finder
 * patterns, and the TRES mark knocked into the centre. Error-correction "H"
 * (~30% recovery) keeps it scannable despite the centre logo.
 *
 * Rendered as inline SVG (vector → crisp at any print size).
 */
export function TresQr({
  url,
  fg = "#5a0a20",
  bg = "#f7f0ea",
  logo = "/assets/logo/tres-mark-burgundy.png",
  ariaLabel = "رمز QR لقائمة تريس",
}: {
  url: string;
  fg?: string;
  bg?: string;
  logo?: string;
  ariaLabel?: string;
}) {
  const qr = QRCode.create(url, { errorCorrectionLevel: "H" });
  const N = qr.modules.size;
  const data = qr.modules.data;
  const get = (r: number, c: number) => data[r * N + c] === 1;

  const QZ = 4; // quiet zone (modules)
  const size = N + QZ * 2;

  const inFinder = (r: number, c: number) =>
    (r < 7 && c < 7) || (r < 7 && c >= N - 7) || (r >= N - 7 && c < 7);

  // centre logo clear-zone (kept modest so "H" recovery still scans)
  const logoSpan = Math.round(N * 0.24);
  const logoStart = Math.floor((N - logoSpan) / 2);
  const logoEnd = logoStart + logoSpan;
  const inLogo = (r: number, c: number) =>
    r >= logoStart && r < logoEnd && c >= logoStart && c < logoEnd;

  const dots: ReactNode[] = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (!get(r, c) || inFinder(r, c) || inLogo(r, c)) continue;
      dots.push(
        <circle key={`${r}-${c}`} cx={c + QZ + 0.5} cy={r + QZ + 0.5} r={0.46} />,
      );
    }
  }

  // rounded finder pattern at module-origin (or, oc)
  const finder = (or: number, oc: number, key: string) => (
    <g key={key}>
      <rect x={oc + QZ} y={or + QZ} width={7} height={7} rx={2} ry={2} fill={fg} />
      <rect x={oc + QZ + 1} y={or + QZ + 1} width={5} height={5} rx={1.4} ry={1.4} fill={bg} />
      <rect x={oc + QZ + 2} y={or + QZ + 2} width={3} height={3} rx={0.9} ry={0.9} fill={fg} />
    </g>
  );

  const logoPad = 0.6;
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      height="100%"
      role="img"
      aria-label={ariaLabel}
      shapeRendering="geometricPrecision"
    >
      <rect x={0} y={0} width={size} height={size} rx={3} ry={3} fill={bg} />
      <g fill={fg}>{dots}</g>
      {finder(0, 0, "tl")}
      {finder(0, N - 7, "tr")}
      {finder(N - 7, 0, "bl")}
      {/* centre logo */}
      <rect
        x={logoStart + QZ - logoPad}
        y={logoStart + QZ - logoPad}
        width={logoSpan + logoPad * 2}
        height={logoSpan + logoPad * 2}
        rx={2}
        ry={2}
        fill={bg}
      />
      <image
        href={logo}
        x={logoStart + QZ + logoSpan * 0.12}
        y={logoStart + QZ + logoSpan * 0.12}
        width={logoSpan * 0.76}
        height={logoSpan * 0.76}
        preserveAspectRatio="xMidYMid meet"
      />
    </svg>
  );
}
