/**
 * Minimal PIN-based admin auth. The owner enters a PIN; on success we set a
 * signed, httpOnly cookie holding an expiry + HMAC signature. Verification uses
 * Web Crypto so it works in both the Edge middleware and Node server actions.
 *
 * This is intentionally simple — one shared PIN for a single store. Not a
 * multi-user identity system.
 */

export const ADMIN_COOKIE = "tres_admin";
const TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

function secret(): string {
  return process.env.ADMIN_SESSION_SECRET || "tres-dev-secret-change-me";
}

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return b64url(sig);
}

/** Create a session token valid for TTL_MS from now (or `now` for testing). */
export async function signSession(now = Date.now()): Promise<string> {
  const exp = String(now + TTL_MS);
  return `${exp}.${await hmac(exp)}`;
}

/** Returns true if the token is well-formed, unexpired and correctly signed. */
export async function verifySession(token: string | undefined, now = Date.now()): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 0) return false;
  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum < now) return false;
  const expected = await hmac(exp);
  // constant-time-ish compare
  if (sig.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

/** Compare a submitted PIN against the configured one. */
export function checkPin(pin: string): boolean {
  const expected = process.env.ADMIN_PIN || "";
  if (!expected) return false;
  const a = pin.trim();
  if (a.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export const SESSION_MAX_AGE = TTL_MS / 1000;
