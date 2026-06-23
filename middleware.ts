import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifySession } from "./app/lib/auth";

// Two jobs:
//  1. Expose the current pathname to server layouts (x-pathname) so the root
//     layout can hide the marketing header/footer on /admin routes.
//  2. Gate the control panel — everything under /admin except /admin/login
//     needs a valid session cookie.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const ok = await verifySession(req.cookies.get(ADMIN_COOKIE)?.value);
    if (!ok) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  // Run on all routes except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|assets|.*\\.[\\w]+$).*)"],
};
