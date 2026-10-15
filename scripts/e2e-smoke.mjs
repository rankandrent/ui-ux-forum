// End-to-end smoke test against the real Supabase project: `npm run db:e2e`.
// Creates two temporary users with the service role, runs ask → answer → vote → accept → comment →
// notifications → report as those users (anon key + their sessions, so RLS and RPC checks apply),
// then deletes every row it created and both users. Needs SUPABASE_URL, SUPABASE_ANON_KEY and
// SUPABASE_SERVICE_ROLE_KEY. Prints no secrets. Exits 1 if any step fails or anything is left behind.
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const { SUPABASE_URL: url, SUPABASE_ANON_KEY: anonKey, SUPABASE_SERVICE_ROLE_KEY: serviceKey } = process.env;
if (!url || !anonKey || !serviceKey) {
  console.error("Set SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, serviceKey, opts);
const run = randomBytes(4).toString("hex");
const tag = `e2etest-${run}`;
const password = randomBytes(18).toString("base64url");
const users = [];
const questionIds = [];
let failed = false;

function check(label, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed = true;
  return ok;
}

async function rpc(client, fn, args) {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data;
}

async function newUser(label) {
  const email = `e2e-${run}-${label}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  users.push(data.user.id);
  const client = createClient(url, anonKey, opts);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`signIn: ${signInError.message}`);
  return { id: data.user.id, client };
}

try {
  const asker = await newUser("asker");
  const helper = await newUser("helper");
  check("create + sign in two temporary users", true);

  const { data: profile } = await asker.client.from("profiles").select("id, username").eq("id", asker.id).single();
  check("profile row created by trigger", profile?.id === asker.id);

  const [{ id: qid }] = await rpc(asker.client, "create_question", {
    p_title: `E2E smoke test question ${run}`,
    p_body: "Temporary question created by scripts/e2e-smoke.mjs. It is deleted at the end of the run.",
    p_category_slug: "tools",
    p_tags: [tag],
  });
  questionIds.push(qid);
  check("ask question", Number.isInteger(Number(qid)), `id ${qid}`);

  const { data: anonQ } = await createClient(url, anonKey, opts).from("questions").select("id").eq("id", qid);
  check("anonymous visitors can read the question", anonQ?.length === 1);

  const { error: directInsert } = await helper.client.from("answers").insert({ question_id: qid, body: "x".repeat(40) });
  check("direct table insert is blocked by RLS", !!directInsert);

  const aid = await rpc(helper.client, "create_answer", {
    p_question_id: qid,
    p_body: "Temporary answer from the e2e smoke test. It is deleted at the end of the run.",
  });
  check("answer question", Number.isInteger(Number(aid)), `id ${aid}`);

  check("upvote answer", (await rpc(asker.client, "cast_vote", { p_type: "answer", p_id: aid, p_value: 1 })) === 1);
  check("upvote question", (await rpc(helper.client, "cast_vote", { p_type: "question", p_id: qid, p_value: 1 })) === 1);

  let ownVoteBlocked = false;
  try { await rpc(asker.client, "cast_vote", { p_type: "question", p_id: qid, p_value: 1 }); } catch { ownVoteBlocked = true; }
  check("voting on own post is refused", ownVoteBlocked);

  check("accept answer", (await rpc(asker.client, "accept_answer", { p_answer_id: aid })) === true);

  const commentId = await rpc(asker.client, "create_comment", { p_question_id: null, p_answer_id: aid, p_body: "Temporary e2e comment." });
  await rpc(helper.client, "create_comment", { p_question_id: qid, p_answer_id: null, p_body: "Temporary e2e comment." });
  check("comment on answer and question", true);

  const { data: q } = await admin.from("questions").select("score, answer_count, comment_count, accepted_answer_id").eq("id", qid).single();
  check("question counters", q.score === 1 && q.answer_count === 1 && q.comment_count === 2 && q.accepted_answer_id === aid,
    JSON.stringify(q));

  const { data: rep } = await admin.from("profiles").select("id, reputation").in("id", [asker.id, helper.id]);
  const repOf = (id) => rep.find((r) => r.id === id)?.reputation;
  check("reputation (asker 1+5+2, helper 1+10+15)", repOf(asker.id) === 8 && repOf(helper.id) === 26,
    `asker ${repOf(asker.id)}, helper ${repOf(helper.id)}`);

  const { data: helperNotes } = await helper.client.from("notifications").select("type").neq("type", "badge").order("id");
  const { data: askerNotes } = await asker.client.from("notifications").select("type").neq("type", "badge").order("id");
  check("notifications", helperNotes.map((n) => n.type).sort().join() === "accepted,comment" &&
    askerNotes.map((n) => n.type).sort().join() === "answer,comment",
    `asker [${askerNotes.map((n) => n.type)}], helper [${helperNotes.map((n) => n.type)}]`);

  const { data: othersNotes } = await asker.client.from("notifications").select("id").eq("user_id", helper.id);
  check("users cannot read others' notifications", othersNotes.length === 0);

  await rpc(asker.client, "mark_notifications_read", { p_ids: null });
  const { count: unread } = await asker.client.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  check("mark notifications read", unread === 0);

  let badReportRefused = false;
  try { await rpc(helper.client, "create_report", { p_target_type: "comment", p_target_id: "0", p_reason: "spam", p_details: "" }); }
  catch { badReportRefused = true; }
  check("report on a missing target is refused", badReportRefused);
  await rpc(helper.client, "create_report", { p_target_type: "comment", p_target_id: String(commentId), p_reason: "spam", p_details: "e2e" });
  check("create report", true);

  const hits = await rpc(createClient(url, anonKey, opts), "search_questions", { p_query: `smoke ${run}`, p_category_slug: "tools", p_tag: tag });
  check("ranked search with category + tag filter", hits.length === 1 && hits[0].id === qid);

  // Storage policy: own folder only.
  const tiny = Buffer.from("R0lGODlhAQABAAAAACw=", "base64"); // 1×1 GIF
  const own = await helper.client.storage.from("forum-images").upload(`q/${helper.id}/e2e-${run}.gif`, tiny, { contentType: "image/gif" });
  const other = await helper.client.storage.from("forum-images").upload(`q/${asker.id}/e2e-${run}.gif`, tiny, { contentType: "image/gif" });
  check("storage: upload to own folder allowed, other's folder refused", !own.error && !!other.error, own.error?.message ?? "");

  // Moderation: make the asker a moderator (service role), then act as them.
  let notStaffRefused = false;
  try { await rpc(asker.client, "mod_set_lock", { p_question_id: qid, p_locked: true }); } catch { notStaffRefused = true; }
  check("moderation RPCs refuse normal users", notStaffRefused);
  await admin.from("profiles").update({ role: "moderator" }).eq("id", asker.id);

  const { data: reports } = await asker.client.from("reports").select("id, status").eq("target_id", String(commentId));
  check("staff can read the reports queue", reports?.length === 1);
  await rpc(asker.client, "mod_resolve_report", { p_report_id: reports[0].id, p_status: "resolved", p_note: "e2e" });

  await rpc(asker.client, "mod_set_lock", { p_question_id: qid, p_locked: true, p_note: "e2e" });
  let lockedRefused = false;
  try { await rpc(helper.client, "create_comment", { p_question_id: qid, p_answer_id: null, p_body: "Should be refused." }); }
  catch { lockedRefused = true; }
  check("lock question blocks new comments", lockedRefused);
  await rpc(asker.client, "mod_set_lock", { p_question_id: qid, p_locked: false });

  await rpc(asker.client, "delete_post", { p_type: "comment", p_id: commentId });
  await rpc(asker.client, "mod_restore_post", { p_type: "comment", p_id: commentId, p_note: "e2e" });
  const { data: restored } = await admin.from("comments").select("is_deleted").eq("id", commentId).single();
  check("delete + restore comment", restored.is_deleted === false);

  await rpc(asker.client, "mod_ban_user", { p_user: helper.id, p_days: 1, p_note: "e2e" });
  let bannedRefused = false;
  try { await rpc(helper.client, "cast_vote", { p_type: "question", p_id: qid, p_value: 0 }); } catch { bannedRefused = true; }
  check("banned user cannot post or vote", bannedRefused);
  await rpc(asker.client, "mod_unban_user", { p_user: helper.id });

  const { count: logCount } = await admin.from("moderation_log").select("*", { count: "exact", head: true }).eq("moderator_id", asker.id);
  check("moderation log written", logCount === 6, `${logCount} entries`);
} catch (err) {
  check("flow", false, err.message);
} finally {
  // Cleanup: questions cascade to answers, comments, votes, question_tags and notifications.
  if (questionIds.length) await admin.from("questions").delete().in("id", questionIds);
  await admin.from("questions").delete().eq("title", `E2E smoke test question ${run}`);
  if (users.length) {
    await admin.from("reports").delete().in("reporter_id", users);
    await admin.from("moderation_log").delete().in("moderator_id", users);
  }
  await admin.from("tags").delete().eq("slug", tag);
  for (const id of users) await admin.storage.from("forum-images").remove([`q/${id}/e2e-${run}.gif`]);
  for (const id of users) {
    const { error } = await admin.auth.admin.deleteUser(id); // cascades profile, reputation, badges
    if (error) check(`delete user`, false, error.message);
  }

  const left = [];
  if (users.length) {
    for (const [table, col] of [["profiles", "id"], ["reputation_events", "user_id"], ["user_badges", "user_id"], ["reports", "reporter_id"], ["moderation_log", "moderator_id"]]) {
      const { count } = await admin.from(table).select("*", { count: "exact", head: true }).in(col, users);
      if (count) left.push(`${table}=${count}`);
    }
  }
  const { count: qCount } = await admin.from("questions").select("*", { count: "exact", head: true }).like("title", `%${run}`);
  if (qCount) left.push(`questions=${qCount}`);
  const { count: tagCount } = await admin.from("tags").select("*", { count: "exact", head: true }).eq("slug", tag);
  if (tagCount) left.push(`tags=${tagCount}`);
  check("cleanup: no test rows or users left", left.length === 0, left.join(", "));
}

process.exit(failed ? 1 : 0);
