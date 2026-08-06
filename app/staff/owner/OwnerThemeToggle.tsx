"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type OwnerTheme = "light" | "dark";

const STORAGE_KEY = "tres-owner-theme";

function applyTheme(theme: OwnerTheme) {
  document.documentElement.dataset.ownerTheme = theme;
}

export default function OwnerThemeToggle() {
  const [theme, setTheme] = useState<OwnerTheme>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const initialTheme: OwnerTheme = stored === "dark" || stored === "light"
      ? stored
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";

    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, []);

  const nextTheme: OwnerTheme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      className="owner-theme-toggle"
      onClick={() => {
        setTheme(nextTheme);
        applyTheme(nextTheme);
        window.localStorage.setItem(STORAGE_KEY, nextTheme);
      }}
      aria-label={theme === "dark" ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن"}
      aria-pressed={theme === "dark"}
      title={theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}
    >
      {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
      <span>{theme === "dark" ? "فاتح" : "داكن"}</span>
    </button>
  );
}
