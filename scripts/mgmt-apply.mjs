// Apply one migration file to the Supabase project via the Management API.
// Usage: SUPABASE_PAT=sbp_... node scripts/mgmt-apply.mjs supabase/migrations/<file>.sql
import { readFileSync } from "node:fs";

const PAT = process.env.SUPABASE_PAT;
const ref = process.env.SUPABASE_REF || "xajdobfusjtikfymxiuo";
const file = process.argv[2];
if (!PAT || !file) {
  console.error("need SUPABASE_PAT env and a migration file path");
  process.exit(1);
}
const query = readFileSync(file, "utf8");
const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { Authorization: "Bearer " + PAT, "Content-Type": "application/json" },
  body: JSON.stringify({ query }),
});
const body = await r.text();
console.log("HTTP", r.status, r.ok ? "✓" : "✗", file);
if (!r.ok) {
  console.error(body);
  process.exit(1);
}
