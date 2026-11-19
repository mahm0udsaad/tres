"use client";

export default function PrintButton() {
  return (
    <button type="button" className="btn btn-blush card-print" onClick={() => window.print()}>
      اطبع البطاقة
    </button>
  );
}
