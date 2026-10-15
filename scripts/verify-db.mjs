// Checks that the Supabase migrations were applied: `node scripts/verify-db.mjs`
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment. Prints no secrets.
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}

const tables = [
  "profiles", "categories", "tags", "questions", "question_tags", "answers", "comments",
  "question_votes", "answer_votes", "reputation_events", "badges", "user_badges",
  "notifications", "reports", "moderation_log",
];

let failed = false;
for (const table of tables) {
  const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=0`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact" },
  });
  const count = res.headers.get("content-range")?.split("/")[1] ?? "?";
  console.log(`${res.ok ? "ok  " : "FAIL"} ${table.padEnd(18)} rows=${count}`);
  if (!res.ok) failed = true;
}

// Anonymous clients must not be able to call write RPCs.
const anon = process.env.SUPABASE_ANON_KEY;
if (anon) {
  const res = await fetch(`${url}/rest/v1/rpc/create_answer`, {
    method: "POST",
    headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_question_id: 1, p_body: "x".repeat(40) }),
  });
  console.log(`${res.ok ? "FAIL" : "ok  "} anon cannot call create_answer (HTTP ${res.status})`);
  if (res.ok) failed = true;
}

process.exit(failed ? 1 : 0);
