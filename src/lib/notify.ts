import "server-only";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_NAME } from "@/lib/site";

type Pending = {
  id: number;
  user_id: string;
  type: "answer" | "comment" | "accepted";
  question: { title: string } | null;
  actor: { display_name: string } | null;
  recipient: { email_notifications: boolean } | null;
};

const SUBJECT: Record<Pending["type"], (actor: string) => string> = {
  answer: (a) => `${a} answered your question`,
  comment: (a) => `${a} commented on your post`,
  accepted: (a) => `${a} accepted your answer`,
};

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * Emails recent unsent notifications through Resend. No-op without RESEND_API_KEY.
 * Rows are claimed (emailed_at set) before sending, so concurrent runs never send twice.
 * Call it via `after()` so it never slows down the response.
 */
export async function sendPendingNotificationEmails() {
  if (!env.resendApiKey) return;
  const admin = createAdminClient();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: claimed, error } = await admin
    .from("notifications")
    .update({ emailed_at: new Date().toISOString() })
    .is("emailed_at", null)
    .in("type", ["answer", "comment", "accepted"])
    .gte("created_at", since)
    .select(
      `id, user_id, type, question:questions(title),
       actor:profiles!notifications_actor_id_fkey(display_name),
       recipient:profiles!notifications_user_id_fkey(email_notifications)`,
    );
  if (error) {
    console.error("notify: claim failed", error.code, error.message);
    return;
  }

  for (const n of (claimed ?? []) as unknown as Pending[]) {
    if (!n.recipient?.email_notifications) continue;
    const { data: user } = await admin.auth.admin.getUserById(n.user_id);
    const to = user?.user?.email;
    if (!to) continue;

    const actor = n.actor?.display_name ?? "Someone";
    const title = n.question?.title ?? "your question";
    const link = `${env.siteUrl}/notifications/${n.id}/`;
    const settings = `${env.siteUrl}/settings/`;
    const subject = SUBJECT[n.type](actor);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.emailFrom,
        to: [to],
        subject: `${subject} — ${SITE_NAME}`,
        text: `${subject}: "${title}"\n\nView it: ${link}\n\nTurn off these emails: ${settings}`,
        html: `<p>${escapeHtml(subject)}: <strong>${escapeHtml(title)}</strong></p>
<p><a href="${link}">View on ${SITE_NAME}</a></p>
<p style="color:#5b6475;font-size:13px">You get this because email notifications are on.
<a href="${settings}">Turn them off</a>.</p>`,
      }),
    }).catch(() => null);
    if (!res?.ok) console.error("notify: resend failed", res?.status);
  }
}
