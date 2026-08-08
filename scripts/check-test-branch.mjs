// Prints [TEST] fixture state — used to confirm what the UI actually saved.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const config = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => line.includes("="))
    .map((line) => {
      const at = line.indexOf("=");
      return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
    }),
);

const sb = createClient(config.NEXT_PUBLIC_SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: branches } = await sb.from("branches").select("name,latitude,longitude,radius_meters");
console.table(branches);

const { data: shifts } = await sb
  .from("attendance_records")
  .select("shift_date,status,on_time,start_location,end_location,tasks_completed,points_earned")
  .order("start_time", { ascending: false })
  .limit(3);
console.log("SHIFTS", JSON.stringify(shifts, null, 1));

const { data: reports, error } = await sb
  .from("barista_reports")
  .select("*")
  .order("created_at", { ascending: false })
  .limit(3);
console.log("REPORTS", error?.message ?? JSON.stringify(reports, null, 1));
