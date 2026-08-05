/**
 * Host-based routing between the public menu site and the operations system.
 *
 * The whole app is one Next.js deployment. When NEXT_PUBLIC_OPS_HOST is set
 * (e.g. "ops.tres.sa"), the middleware serves the operations system ONLY on
 * that host and redirects operations routes off the main domain onto it. When
 * it is unset (local dev, previews) everything is served in place, so nothing
 * special is needed to run locally.
 *
 * "Operations system" = the Supabase-auth staff app (/staff) plus the owner
 * operations console (/admin/operations). Everything else under /admin is the
 * menu dashboard and stays on the main domain.
 */

export const OPS_HOST = (process.env.NEXT_PUBLIC_OPS_HOST ?? "").trim().toLowerCase();

/** Strip the port so localhost:3000 and ops.localhost:3000 compare cleanly. */
function bareHost(host: string | null | undefined): string {
  return (host ?? "").toLowerCase().split(":")[0];
}

export function opsConfigured(): boolean {
  return OPS_HOST.length > 0;
}

export function isOpsHost(host: string | null | undefined): boolean {
  if (!OPS_HOST) return false;
  return bareHost(host) === bareHost(OPS_HOST);
}

/** Absolute origin of the operations subdomain, or "" when not configured. */
export function opsOrigin(): string {
  return OPS_HOST ? `https://${OPS_HOST}` : "";
}

function underPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

/** Routes that BELONG to the operations subdomain and are redirected there
 *  from the main domain: the staff app and the owner operations console. */
export function isMovedOpsPath(pathname: string): boolean {
  return underPrefix(pathname, "/staff") || underPrefix(pathname, "/admin/operations");
}

/** Everything the ops host is allowed to serve. `/admin/login` + `/admin/logout`
 *  are shared with the menu admin but needed here so the owner can PIN-in to the
 *  operations console. */
export function isOpsAllowedPath(pathname: string): boolean {
  return (
    isMovedOpsPath(pathname) ||
    pathname === "/admin/login" ||
    pathname === "/admin/logout"
  );
}
