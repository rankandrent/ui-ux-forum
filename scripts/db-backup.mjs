// Logical backup of all forum tables to the private `backups` bucket in Supabase Storage:
// `npm run db:backup`. Writes backups/db/<UTC timestamp>.json.gz and keeps the newest 14.
// Free-tier friendly (no payment method). Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Prints no secrets.
// Restore: download the file, gunzip, and insert table by table in the order listed in TABLES.
import { createClient } from "@supabase/supabase-js";
import { gzipSync } from "node:zlib";

const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const KEEP = 14;
const TABLES = [
  "profiles", "categories", "tags", "badges", "questions", "answers", "question_tags", "comments",
  "question_votes", "answer_votes", "reputation_events", "user_badges", "notifications", "reports",
  "moderation_log", "uploads",
];

const dump = { created_at: new Date().toISOString(), tables: {} };
for (const table of TABLES) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select("*").range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  dump.tables[table] = rows;
  console.log(`${table.padEnd(18)} ${rows.length}`);
}

const name = `db/${dump.created_at.replace(/[:.]/g, "-")}.json.gz`;
const body = gzipSync(JSON.stringify(dump));
const { error } = await admin.storage.from("backups").upload(name, body, { contentType: "application/gzip" });
if (error) throw new Error(`upload: ${error.message}`);
console.log(`saved backups/${name} (${(body.length / 1024).toFixed(1)} KB)`);

const { data: files } = await admin.storage.from("backups").list("db", { sortBy: { column: "name", order: "desc" } });
const old = (files ?? []).slice(KEEP).map((f) => `db/${f.name}`);
if (old.length) {
  await admin.storage.from("backups").remove(old);
  console.log(`removed ${old.length} old backup(s)`);
}
