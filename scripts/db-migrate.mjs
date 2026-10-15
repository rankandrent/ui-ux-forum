// Applies supabase/migrations/*.sql in order through the Supabase Management API.
// Usage: `npm run db:migrate` (add `-- --status` to only list applied/pending migrations).
// Needs SUPABASE_URL (project ref is its subdomain) and SUPABASE_ACCESS_TOKEN. Prints no secrets.
//
// Each migration runs in one transaction together with its row in forum_meta.migrations, so a
// failing file leaves nothing half-applied and re-running the script only applies pending files.
// An applied file whose contents changed is reported and stops the run: add a new migration instead.
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const url = process.env.SUPABASE_URL;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!url || !token) {
  console.error("Set SUPABASE_URL and SUPABASE_ACCESS_TOKEN first.");
  process.exit(1);
}
const ref = new URL(url).hostname.split(".")[0];
const statusOnly = process.argv.includes("--status");
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 2000)}`);
  return text ? JSON.parse(text) : [];
}

const literal = (s) => `'${s.replaceAll("'", "''")}'`;

await query(`
  create schema if not exists forum_meta;
  revoke all on schema forum_meta from public, anon, authenticated;
  create table if not exists forum_meta.migrations (
    name       text primary key,
    checksum   text not null,
    applied_at timestamptz not null default now()
  );`);

const applied = new Map(
  (await query("select name, checksum from forum_meta.migrations")).map((r) => [r.name, r.checksum]),
);
const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

for (const file of files) {
  const sql = await readFile(path.join(dir, file), "utf8");
  const checksum = createHash("sha256").update(sql).digest("hex");
  const name = file.replace(/\.sql$/, "");

  if (applied.has(name)) {
    if (applied.get(name) !== checksum) {
      console.error(`CHANGED ${name}: already applied with different contents. Add a new migration instead.`);
      process.exit(1);
    }
    console.log(`applied ${name}`);
    continue;
  }
  if (statusOnly) {
    console.log(`pending ${name}`);
    continue;
  }

  process.stdout.write(`running ${name} … `);
  try {
    await query(`begin;\n${sql}\n;\ninsert into forum_meta.migrations (name, checksum) values (${literal(name)}, ${literal(checksum)});\ncommit;`);
    console.log("done");
  } catch (err) {
    console.log("FAILED");
    console.error(err.message);
    process.exit(1);
  }
}
