import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";

// Complaints are appended to a newline-delimited JSON file under /data.
// Swap this out for a DB insert (e.g. Supabase) or an email/webhook later —
// only the persistence block below needs to change.
const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "complaints.ndjson");

type Payload = {
  name?: string;
  contact?: string;
  type?: string;
  message?: string;
};

export async function POST(request: Request) {
  let body: Payload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const message = String(body.message ?? "").trim();
  if (!message) {
    return NextResponse.json({ ok: false, error: "message required" }, { status: 422 });
  }

  const record = {
    name: String(body.name ?? "").trim() || null,
    contact: String(body.contact ?? "").trim() || null,
    type: String(body.type ?? "other").trim(),
    message,
    createdAt: new Date().toISOString(),
  };

  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.appendFile(FILE, JSON.stringify(record) + "\n", "utf8");
  } catch (err) {
    console.error("Failed to persist complaint:", err);
    // Still surface it in logs so it isn't lost on read-only filesystems.
    console.info("COMPLAINT", JSON.stringify(record));
    return NextResponse.json({ ok: false, error: "store failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
