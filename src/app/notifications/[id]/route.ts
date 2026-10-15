import { NextResponse, type NextRequest } from "next/server";
import { questionPath } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

// Opens a notification: marks it read and redirects to the post it is about.
export async function GET(request: NextRequest, ctx: RouteContext<"/notifications/[id]">) {
  const id = Number((await ctx.params).id);
  const home = new URL("/notifications/", request.url);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.redirect(home);

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return NextResponse.redirect(new URL(`/login/?next=${encodeURIComponent(`/notifications/${id}/`)}`, request.url));
  }

  // RLS only returns the viewer's own notifications.
  const { data: n } = await supabase
    .from("notifications")
    .select("id, answer_id, comment_id, question:questions(id, slug)")
    .eq("id", id)
    .maybeSingle<{ id: number; answer_id: number | null; comment_id: number | null; question: { id: number; slug: string } | null }>();
  if (!n) return NextResponse.redirect(home);

  await supabase.rpc("mark_notifications_read", { p_ids: [n.id] });
  if (!n.question) return NextResponse.redirect(home);
  const hash = n.comment_id ? `#comment-${n.comment_id}` : n.answer_id ? `#answer-${n.answer_id}` : "";
  return NextResponse.redirect(new URL(questionPath(n.question.id, n.question.slug) + hash, request.url));
}
