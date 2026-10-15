import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { markAllNotificationsRead } from "@/app/actions/forum";
import { Avatar } from "@/components/Avatar";
import { timeAgo } from "@/lib/format";
import { listNotifications, type NotificationRow } from "@/lib/queries";
import { getViewer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Notifications", robots: { index: false } };

function describe(n: NotificationRow) {
  const actor = n.actor?.display_name ?? "Someone";
  switch (n.type) {
    case "answer":
      return `${actor} answered your question`;
    case "comment":
      return `${actor} commented on your ${n.answer_id ? "answer" : "question"}`;
    case "accepted":
      return `${actor} accepted your answer`;
    case "badge":
      return n.message ?? "You earned a badge";
    default:
      return n.message ?? "A moderator updated your post";
  }
}

export default async function NotificationsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login/?next=/notifications/");
  const notifications = await listNotifications(viewer.id);
  const unread = notifications.some((n) => !n.read_at);

  return (
    <section className="card" style={{ maxWidth: 760 }}>
      <div className="card-pad notif-head">
        <h1 style={{ margin: 0 }}>Notifications</h1>
        {unread && (
          <form action={markAllNotificationsRead}>
            <button className="btn btn-secondary" type="submit">
              Mark all as read
            </button>
          </form>
        )}
      </div>
      {notifications.length === 0 ? (
        <p className="empty">No notifications yet. You’ll see answers, comments and accepted answers here.</p>
      ) : (
        <ul className="notif-list">
          {notifications.map((n) => (
            <li key={n.id} className={n.read_at ? "notif" : "notif unread"}>
              <Avatar name={n.actor?.display_name ?? "?"} src={n.actor?.avatar_url ?? null} size={32} />
              <div>
                {/* Plain link: the route handler marks it read, then redirects. */}
                <a href={`/notifications/${n.id}/`}>
                  {describe(n)}
                  {n.question && (
                    <>
                      : <strong>{n.question.title}</strong>
                    </>
                  )}
                </a>
                <div className="hint">
                  <time dateTime={n.created_at}>{timeAgo(n.created_at)}</time>
                  {!n.read_at && <span className="sr-only"> (unread)</span>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="hint card-pad" style={{ margin: 0 }}>
        Email notifications can be turned off in <Link href="/settings/">settings</Link>.
      </p>
    </section>
  );
}
