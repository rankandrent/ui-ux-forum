"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient, getViewer } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { pingIndexNow } from "@/lib/indexnow";
import { sendPendingNotificationEmails } from "@/lib/notify";
import { questionPath } from "@/lib/site";
import { verifyChallenge } from "@/lib/turnstile";
import type { ActionResult } from "@/lib/types";

const SIGN_IN_REQUIRED: ActionResult = { ok: false, error: "Please sign in first." };

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function parseTags(raw: string): string[] {
  return raw
    .split(/[,\s]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

function validateQuestion(formData: FormData) {
  const title = text(formData, "title");
  const body = text(formData, "body");
  const category = text(formData, "category");
  const tags = parseTags(text(formData, "tags"));
  if (title.length < 15 || title.length > 150) return { error: "The title should be 15–150 characters." } as const;
  if (body.length < 30 || body.length > 20000) return { error: "Describe your question in at least 30 characters." } as const;
  if (!category) return { error: "Choose a category." } as const;
  if (tags.length < 1 || tags.length > 5) return { error: "Add between 1 and 5 tags." } as const;
  return { title, body, category, tags } as const;
}

export async function createQuestion(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return SIGN_IN_REQUIRED;
  const input = validateQuestion(formData);
  if ("error" in input) return { ok: false, error: input.error! };
  const challengeError = await verifyChallenge(formData, viewer);
  if (challengeError) return { ok: false, error: challengeError };

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("create_question", {
      p_title: input.title,
      p_body: input.body,
      p_category_slug: input.category,
      p_tags: input.tags,
      p_image_url: null,
    })
    .single<{ id: number; slug: string }>();
  if (error || !data) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  redirect(questionPath(data.id, data.slug));
}

export async function updateQuestion(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await getViewer())) return SIGN_IN_REQUIRED;
  const id = Number(formData.get("id"));
  const input = validateQuestion(formData);
  if ("error" in input) return { ok: false, error: input.error! };

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("update_question", {
      p_id: id,
      p_title: input.title,
      p_body: input.body,
      p_category_slug: input.category,
      p_tags: input.tags,
      p_image_url: text(formData, "image_url") || null,
    })
    .single<{ id: number; slug: string }>();
  if (error || !data) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  redirect(questionPath(data.id, data.slug));
}

export async function createAnswer(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return SIGN_IN_REQUIRED;
  const questionId = Number(formData.get("question_id"));
  const body = text(formData, "body");
  if (body.length < 30 || body.length > 20000) return { ok: false, error: "Answers need at least 30 characters." };
  const challengeError = await verifyChallenge(formData, viewer);
  if (challengeError) return { ok: false, error: challengeError };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_answer", { p_question_id: questionId, p_body: body });
  if (error) return { ok: false, error: friendlyError(error) };
  after(sendPendingNotificationEmails);
  // A thread becomes indexable with its first answer — tell IndexNow.
  after(async () => {
    const { data: q } = await supabase.from("questions").select("id, slug, answer_count").eq("id", questionId).single();
    if (q?.answer_count === 1) await pingIndexNow([questionPath(q.id, q.slug)]);
  });

  revalidatePath("/", "layout");
  return { ok: true, message: "Your answer was posted." };
}

export async function updateAnswer(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await getViewer())) return SIGN_IN_REQUIRED;
  const id = Number(formData.get("id"));
  const body = text(formData, "body");
  const back = text(formData, "back");
  if (body.length < 30 || body.length > 20000) return { ok: false, error: "Answers need at least 30 characters." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_answer", { p_id: id, p_body: body });
  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  redirect(back.startsWith("/q/") ? `${back}#answer-${id}` : "/");
}

export async function createComment(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return SIGN_IN_REQUIRED;
  const questionId = Number(formData.get("question_id")) || null;
  const answerId = Number(formData.get("answer_id")) || null;
  const body = text(formData, "body");
  if (body.length < 5 || body.length > 1000) return { ok: false, error: "Comments should be 5–1000 characters." };
  const challengeError = await verifyChallenge(formData, viewer);
  if (challengeError) return { ok: false, error: challengeError };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_comment", {
    p_question_id: answerId ? null : questionId,
    p_answer_id: answerId,
    p_body: body,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  after(sendPendingNotificationEmails);

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function castVote(type: "question" | "answer", id: number, value: -1 | 0 | 1) {
  if (!(await getViewer())) return { ok: false as const, error: "Sign in to vote." };
  if (type !== "question" && type !== "answer") return { ok: false as const, error: "Invalid vote." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cast_vote", { p_type: type, p_id: id, p_value: value });
  if (error) return { ok: false as const, error: friendlyError(error) };
  return { ok: true as const, score: data as number };
}

export async function acceptAnswer(formData: FormData) {
  const answerId = Number(formData.get("answer_id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_answer", { p_answer_id: answerId });
  if (!error) after(sendPendingNotificationEmails);
  revalidatePath("/", "layout");
}

export async function deletePost(formData: FormData) {
  const type = text(formData, "type");
  const id = Number(formData.get("id"));
  const back = text(formData, "back");
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_post", { p_type: type, p_id: id });
  revalidatePath("/", "layout");
  if (!error && type === "question") redirect("/");
  if (back.startsWith("/q/")) redirect(error ? `${back}?error=${encodeURIComponent(friendlyError(error))}` : back);
}

export async function updateProfile(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return SIGN_IN_REQUIRED;

  const username = text(formData, "username").toLowerCase();
  const displayName = text(formData, "display_name");
  const bio = text(formData, "bio");
  const website = text(formData, "website");
  if (!/^[a-z0-9_]{3,30}$/.test(username))
    return { ok: false, error: "Usernames use 3–30 lowercase letters, numbers or underscores." };
  if (displayName.length < 1 || displayName.length > 60) return { ok: false, error: "Enter a display name (max 60)." };
  if (bio.length > 1000) return { ok: false, error: "Keep your bio under 1000 characters." };
  if (website && !/^https?:\/\/[^\s]+$/i.test(website)) return { ok: false, error: "Website must start with https://" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      username,
      display_name: displayName,
      bio,
      website: website || null,
      email_notifications: formData.get("email_notifications") === "on",
    })
    .eq("id", viewer.id);
  if (error) {
    if (error.code === "23505") return { ok: false, error: "That username is taken." };
    return { ok: false, error: friendlyError(error) };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Profile saved." };
}

export async function markAllNotificationsRead() {
  const supabase = await createClient();
  await supabase.rpc("mark_notifications_read", { p_ids: null });
  revalidatePath("/", "layout");
}

export async function createReport(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await getViewer())) return SIGN_IN_REQUIRED;
  const targetType = text(formData, "target_type");
  const targetId = text(formData, "target_id");
  const reason = text(formData, "reason");
  const details = text(formData, "details").slice(0, 500);
  if (!["question", "answer", "comment", "user"].includes(targetType)) return { ok: false, error: "Invalid report." };
  if (!["spam", "offensive", "off_topic", "low_quality", "other"].includes(reason)) {
    return { ok: false, error: "Choose a reason." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_report", {
    p_target_type: targetType,
    p_target_id: targetId,
    p_reason: reason,
    p_details: details,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true, message: "Thanks — a moderator will review this." };
}
