// Turning "where the branch is" into coordinates.
//
// Owners and supervisors do not know latitude/longitude — they know how to
// share a pin from Google Maps. This module accepts whatever they paste and
// extracts a coordinate pair from it: a full Maps URL, a short share link
// (resolved server-side by `resolveShareLink`), an Apple Maps or geo: link,
// or a plain "21.277932, 40.4348957" copied from Maps' right-click menu.

export type LatLng = { latitude: number; longitude: number };

const BIDI_MARKS = /[‎‏‪-‮⁦-⁩]/g;
const EASTERN_DIGITS = /[٠-٩۰-۹]/g;
const NUMBER = String.raw`-?\d{1,3}(?:\.\d+)?`;

/** Strips RTL control marks and converts Arabic-Indic digits to ASCII. */
function normalize(raw: string): string {
  return raw
    .replace(BIDI_MARKS, "")
    .replace(EASTERN_DIGITS, (digit) => {
      const code = digit.charCodeAt(0);
      const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
      return String(code - base);
    })
    .trim();
}

function pair(latitude: number, longitude: number): LatLng | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90) return null;
  if (longitude < -180 || longitude > 180) return null;
  // Google occasionally emits "0,0" for an unresolved pin — treat as no answer.
  if (latitude === 0 && longitude === 0) return null;
  return { latitude, longitude };
}

/** Reads "21.27, 40.43" out of a bare string or a single query parameter. */
function pairFrom(value: string): LatLng | null {
  const match = new RegExp(`(${NUMBER})\\s*[,\\s]\\s*(${NUMBER})`).exec(value);
  return match ? pair(Number(match[1]), Number(match[2])) : null;
}

// Parameters that carry a coordinate in Maps/Apple Maps URLs, most explicit first.
const COORD_PARAMS = ["q", "query", "ll", "sll", "center", "destination", "daddr", "saddr"];

function fromUrl(raw: string): LatLng | null {
  let url: URL;
  try {
    url = new URL(/^[a-z]+:/i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  let href = url.href;
  try {
    href = decodeURIComponent(href);
  } catch {
    // Malformed escapes — fall back to the raw href.
  }

  // 1. The place pin itself: .../data=...!3d<lat>!4d<lng>. This is the marker
  //    the user actually dropped, unlike the viewport centre in the @ segment.
  const pin = new RegExp(`!3d(${NUMBER})!4d(${NUMBER})`).exec(href);
  if (pin) {
    const found = pair(Number(pin[1]), Number(pin[2]));
    if (found) return found;
  }

  // 2. Explicit coordinate parameters (?q=, ?ll=, Maps URL API ?query=, …).
  for (const key of COORD_PARAMS) {
    const value = url.searchParams.get(key);
    if (!value) continue;
    const found = pairFrom(value);
    if (found) return found;
  }

  // 3. geo:21.27,40.43 — Android's share format.
  if (url.protocol === "geo:") {
    const found = pairFrom(url.pathname);
    if (found) return found;
  }

  // 4. Viewport centre: /@<lat>,<lng>,17z. Close to the pin, so it is a usable
  //    last resort when no marker data survived the share.
  const viewport = new RegExp(`@(${NUMBER}),(${NUMBER})`).exec(href);
  if (viewport) {
    const found = pair(Number(viewport[1]), Number(viewport[2]));
    if (found) return found;
  }

  return null;
}

/**
 * Extracts coordinates from anything the user pasted. Returns null when the
 * input holds no usable pin — including short share links, which carry no
 * coordinates at all until they are resolved (see `isShareLink`).
 */
export function parseLatLng(input: string): LatLng | null {
  const value = normalize(input);
  if (!value) return null;
  if (/^[a-z]+:\/\//i.test(value) || /^geo:/i.test(value) || /^[\w.-]+\.[a-z]{2,}\//i.test(value)) {
    return fromUrl(value);
  }
  return pairFrom(value);
}

// Hosts we are willing to make a server-side request to when resolving a share
// link. Anything else is rejected rather than fetched — a pasted URL must never
// become a request to an arbitrary address.
const SHARE_HOSTS = new Set([
  "maps.app.goo.gl",
  "goo.gl",
  "g.co",
  "share.google",
  "maps.apple.com",
]);

function isAllowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (SHARE_HOSTS.has(host)) return true;
  // Redirect targets: google.com, www.google.com.sa, maps.google.de, …
  return /(^|\.)google\.[a-z]{2,}(\.[a-z]{2,})?$/.test(host);
}

/** The https URL to resolve, or null if this is not a short share link. */
export function isShareLink(input: string): string | null {
  const value = normalize(input);
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (!SHARE_HOSTS.has(url.hostname.toLowerCase())) return null;
  return url.href;
}

/**
 * Follows a short share link until a Maps URL with coordinates appears. Only
 * called from server actions, and only for `isShareLink` hosts.
 */
export async function resolveShareLink(input: string): Promise<LatLng | null> {
  let next = isShareLink(input);
  if (!next) return null;

  for (let hop = 0; hop < 5 && next; hop += 1) {
    let response: Response;
    try {
      response = await fetch(next, {
        redirect: "manual",
        headers: {
          // Without a browser UA, Google answers short links with a consent
          // interstitial that carries no coordinates.
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
          "accept-language": "en",
        },
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      return null;
    }

    const location = response.headers.get("location");
    if (location) {
      let target: URL;
      try {
        target = new URL(location, next);
      } catch {
        return null;
      }
      if (target.protocol !== "https:" || !isAllowedHost(target.hostname)) return null;
      const found = parseLatLng(target.href);
      if (found) return found;
      next = target.href;
      continue;
    }

    // Final hop: the coordinates may only exist in the page body.
    const body = await response.text().catch(() => "");
    return parseLatLng(response.url || next) ?? pinFromBody(body);
  }

  return null;
}

function pinFromBody(body: string): LatLng | null {
  const pin = new RegExp(`!3d(${NUMBER})!4d(${NUMBER})`).exec(body);
  if (pin) {
    const found = pair(Number(pin[1]), Number(pin[2]));
    if (found) return found;
  }
  const viewport = new RegExp(`/@(${NUMBER}),(${NUMBER}),`).exec(body);
  if (viewport) return pair(Number(viewport[1]), Number(viewport[2]));
  return null;
}
