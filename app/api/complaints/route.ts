import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { supabasePublic, supabaseConfigured } from "../../lib/supabase";

export const runtime = "nodejs";

// Feedback is stored in Supabase (table `feedback`) when configured, so it
// shows up in the control panel. Falls back to a newline-delimited JSON file
// under /data when Supabase isn't configured (e.g. local without env).
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
  const contact = String(body.contact ?? "").trim();

  if (!contact) {
    return NextResponse.json({ ok: false, error: "phone required" }, { status: 422 });
  }

  if (!message) {
    return NextResponse.json({ ok: false, error: "message required" }, { status: 422 });
  }

  const record = {
    name: String(body.name ?? "").trim() || null,
    contact,
    type: String(body.type ?? "other").trim(),
    message,
  };

  // Primary: Supabase insert (anon key — RLS allows insert into feedback).
  if (supabaseConfigured) {
    try {
      const { error } = await supabasePublic().from("feedback").insert(record);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error("Supabase feedback insert failed, falling back to file:", err);
    }
  }

  // Fallback: append to the local NDJSON file.
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.appendFile(FILE, JSON.stringify({ ...record, createdAt: new Date().toISOString() }) + "\n", "utf8");
  } catch (err) {
    console.error("Failed to persist complaint:", err);
    console.info("COMPLAINT", JSON.stringify(record));
    return NextResponse.json({ ok: false, error: "store failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
