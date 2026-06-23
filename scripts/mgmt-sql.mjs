// Run SQL against the Supabase project via the Management API.
// Usage: SUPABASE_PAT=sbp_... SUPABASE_REF=xxxx node scripts/mgmt-sql.mjs "select 1"
const PAT = process.env.SUPABASE_PAT;
const ref = process.env.SUPABASE_REF || "xajdobfusjtikfymxiuo";
const query = process.argv[2];
if (!PAT || !query) {
  console.error("need SUPABASE_PAT env and a SQL argument");
  process.exit(1);
}
const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { Authorization: "Bearer " + PAT, "Content-Type": "application/json" },
  body: JSON.stringify({ query }),
});
console.log("HTTP", r.status);
console.log(await r.text());
