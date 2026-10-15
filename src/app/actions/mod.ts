"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { friendlyError } from "@/lib/errors";
import { createClient, getViewer } from "@/lib/supabase/server";

// Moderator actions. Every RPC re-checks the role in the database (assert_staff) and logs the action.

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

/** Only same-site paths for the post-action redirect. */
function backTo(formData: FormData, fallback: string) {
  const back = text(formData, "back");
  return /^\/(?!\/)[^\s\\]*$/.test(back) ? back : fallback;
}

async function run(formData: FormData, fallback: string, fn: string, args: Record<string, unknown>) {
  const viewer = await getViewer();
  if (!viewer || (viewer.role !== "admin" && viewer.role !== "moderator")) redirect("/");
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  revalidatePath("/", "layout");
  const back = backTo(formData, fallback);
  if (error) {
    const sep = back.includes("?") ? "&" : "?";
    redirect(`${back}${sep}error=${encodeURIComponent(friendlyError(error))}`);
  }
  redirect(back);
}

export async function modSetLock(formData: FormData) {
  await run(formData, "/mod/", "mod_set_lock", {
    p_question_id: Number(formData.get("id")),
    p_locked: text(formData, "locked") === "true",
    p_note: text(formData, "note") || null,
  });
}

export async function modDelete(formData: FormData) {
  await run(formData, "/mod/", "delete_post", { p_type: text(formData, "type"), p_id: Number(formData.get("id")) });
}

export async function modRestore(formData: FormData) {
  await run(formData, "/mod/", "mod_restore_post", {
    p_type: text(formData, "type"),
    p_id: Number(formData.get("id")),
    p_note: text(formData, "note") || null,
  });
}

export async function modResolveReport(formData: FormData) {
  await run(formData, "/mod/", "mod_resolve_report", {
    p_report_id: Number(formData.get("id")),
    p_status: text(formData, "status"),
    p_note: text(formData, "note") || null,
  });
}

export async function modBan(formData: FormData) {
  const days = text(formData, "days");
  await run(formData, "/mod/users/", "mod_ban_user", {
    p_user: text(formData, "user_id"),
    p_days: days === "permanent" ? null : Number(days) || 7,
    p_note: text(formData, "note") || null,
  });
}

export async function modUnban(formData: FormData) {
  await run(formData, "/mod/users/", "mod_unban_user", {
    p_user: text(formData, "user_id"),
    p_note: text(formData, "note") || null,
  });
}

export async function modSetRole(formData: FormData) {
  await run(formData, "/mod/users/", "mod_set_role", { p_user: text(formData, "user_id"), p_role: text(formData, "role") });
}
