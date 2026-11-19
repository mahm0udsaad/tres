import "server-only";
import { getPublicSettings, THEMES, type ThemeId } from "./data";

/**
 * The skin the public site is wearing right now.
 *
 * One resolver for every surface that branches on the theme — the <html>
 * attribute, the browser chrome colour, and the menu (the winter skin gets the
 * new menu board, the others keep the original experience).
 *
 * Local preview of a skin without touching the live setting:
 *   THEME_PREVIEW=winter npm run dev
 * It is ignored in production builds, so it can never override what the owner
 * picked in the control panel.
 */
export function previewTheme(): ThemeId | null {
  if (process.env.NODE_ENV === "production") return null;
  const v = process.env.THEME_PREVIEW;
  return THEMES.includes(v as ThemeId) ? (v as ThemeId) : null;
}

export async function getActiveTheme(): Promise<ThemeId> {
  return previewTheme() ?? (await getPublicSettings()).theme;
}
