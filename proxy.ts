import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifySession } from "./app/lib/auth";
import {
  isMovedOpsPath,
  isOpsAllowedPath,
  isOpsHost,
  opsConfigured,
  opsOrigin,
} from "./app/lib/hosts";

function staffAuthConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const onOpsHost = isOpsHost(request.headers.get("host"));

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  if (onOpsHost) requestHeaders.set("x-ops-host", "1");

  // ── Host separation (only once a subdomain is configured) ──────────────────
  // The operations system (/staff + /admin/operations) lives on ops.<domain>;
  // the menu dashboard and public site live on the main domain. With no
  // NEXT_PUBLIC_OPS_HOST set (local dev, previews) everything serves in place.
  if (opsConfigured()) {
    if (onOpsHost) {
      // The ops subdomain serves only operations routes. Anything else (the
      // public menu, the menu-admin pages) bounces to the staff app.
      if (!isOpsAllowedPath(pathname)) {
        const url = request.nextUrl.clone();
        url.pathname = "/staff";
        url.search = "";
        return NextResponse.redirect(url);
      }
    } else if (isMovedOpsPath(pathname)) {
      // Main domain: send operations routes to the subdomain, keeping the path
      // and query so old links resolve to the same place.
      return NextResponse.redirect(
        new URL(`${pathname}${request.nextUrl.search}`, opsOrigin()),
      );
    }
  }

  // ── Menu-admin / operations-console PIN gate ───────────────────────────────
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const ok = await verifySession(request.cookies.get(ADMIN_COOKIE)?.value);
    if (!ok) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  if (!pathname.startsWith("/staff")) return response;
  if (!staffAuthConfigured()) {
    if (pathname === "/staff/login") return response;
    const url = request.nextUrl.clone();
    url.pathname = "/staff/login";
    url.searchParams.set("error", "config");
    return NextResponse.redirect(url);
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, responseHeaders) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
          Object.entries(responseHeaders).forEach(([name, value]) => {
            response.headers.set(name, value);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLogin = pathname === "/staff/login";

  if (!user && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/staff/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/staff";
    url.search = "";
    return NextResponse.redirect(url);
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|assets|.*\\.[\\w]+$).*)"],
};
