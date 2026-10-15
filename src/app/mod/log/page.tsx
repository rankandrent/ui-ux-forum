import Link from "next/link";
import { timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Entry = {
  id: number;
  action: string;
  target_type: string;
  target_id: string;
  note: string | null;
  created_at: string;
  moderator: { username: string; display_name: string } | null;
};

function targetHref(e: Entry) {
  if (e.target_type === "question") return `/q/${e.target_id}/`;
  if (e.target_type === "user") return `/mod/users/?id=${e.target_id}`;
  return null;
}

export default async function LogPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("moderation_log")
    .select("id, action, target_type, target_id, note, created_at, moderator:profiles(username, display_name)")
    .order("created_at", { ascending: false })
    .limit(100);
  const entries = (data ?? []) as unknown as Entry[];

  return (
    <section className="card">
      <div className="card-pad">
        <h2 style={{ margin: 0 }}>Moderation log</h2>
        <p className="hint" style={{ margin: "4px 0 0" }}>Last 100 actions.</p>
      </div>
      {entries.length === 0 ? (
        <p className="empty">No moderation actions yet.</p>
      ) : (
        <ul className="mod-list">
          {entries.map((e) => {
            const href = targetHref(e);
            return (
              <li key={e.id} className="mod-item">
                <div className="mod-item-main">
                  <strong>{e.moderator?.display_name ?? "deleted user"}</strong> {e.action.replace("_", " ")}{" "}
                  {e.target_type}{" "}
                  {href ? <Link href={href}>#{e.target_id.slice(0, 8)}</Link> : `#${e.target_id.slice(0, 8)}`}
                  {e.note && <span className="hint"> — {e.note}</span>}
                </div>
                <time className="hint" dateTime={e.created_at}>
                  {timeAgo(e.created_at)}
                </time>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
