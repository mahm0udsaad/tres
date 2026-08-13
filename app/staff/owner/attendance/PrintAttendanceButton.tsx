"use client";

import { Printer } from "lucide-react";

export default function PrintAttendanceButton() {
  return (
    <button
      type="button"
      className="owner-attendance-print"
      onClick={() => window.print()}
    >
      <Printer />
      طباعة سجل الحضور
    </button>
  );
}
