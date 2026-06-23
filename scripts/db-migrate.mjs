// Runs every .sql file in supabase/migrations (sorted) against DATABASE_URL.
// Usage: DATABASE_URL=postgresql://... node scripts/db-migrate.mjs
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// load DATABASE_URL from .env.local if not already in env
if (!process.env.DATABASE_URL) {
  try {
    const env = readFileSync(join(root, ".env.local"), "utf8");
    const m = env.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m);
    if (m) process.env.DATABASE_URL = m[1].trim();
  } catch {}
}

const url = process.env.DATABASE_URL;
if (!url || url.includes("[PASSWORD]")) {
  console.error("✗ Set DATABASE_URL (Supabase → Settings → Database → Connection string → URI) in .env.local first.");
  process.exit(1);
}

const dir = join(root, "supabase", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  for (const f of files) {
    process.stdout.write(`→ ${f} ... `);
    await client.query(readFileSync(join(dir, f), "utf8"));
    console.log("ok");
  }
  console.log("✓ migrations applied");
} catch (err) {
  console.error("\n✗ migration failed:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
