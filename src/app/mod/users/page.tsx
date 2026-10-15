import Link from "next/link";
import { modBan, modSetRole, modUnban } from "@/app/actions/mod";
import { Avatar } from "@/components/Avatar";
import { FlashError } from "@/components/FlashError";
import { formatDate } from "@/lib/format";
import { createClient, getViewer } from "@/lib/supabase/server";

type User = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  reputation: number;
  role: "user" | "moderator" | "admin";
  is_banned: boolean;
  banned_until: string | null;
  created_at: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function UsersPage({ searchParams }: PageProps<"/mod/users">) {
  const sp = await searchParams;
  const viewer = await getViewer();
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30) : "";
  const id = typeof sp.id === "string" && UUID_RE.test(sp.id) ? sp.id : "";

  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, reputation, role, is_banned, banned_until, created_at");
  if (id) query = query.eq("id", id);
  else if (q) query = query.ilike("username", `%${q}%`).order("reputation", { ascending: false });
  else query = query.or("is_banned.eq.true,role.neq.user").order("role").order("username");
  const { data } = await query.limit(50);
  const users = (data ?? []) as User[];
  const back = id ? `/mod/users/?id=${id}` : q ? `/mod/users/?q=${q}` : "/mod/users/";
  const isAdmin = viewer?.role === "admin";

  return (
    <section className="card">
      <div className="card-pad">
        <h2 style={{ margin: 0 }}>Users</h2>
        <form action="/mod/users/" className="search-form" style={{ marginTop: 12 }}>
          <label className="sr-only" htmlFor="user-q">
            Username
          </label>
          <input id="user-q" name="q" className="input" defaultValue={q} placeholder="Search by username" />
          <button className="btn btn-primary" type="submit">
            Find
          </button>
        </form>
        {!q && !id && <p className="hint">Showing staff and banned users. Search to find anyone else.</p>}
        <FlashError value={sp.error} />
      </div>
      {users.length === 0 ? (
        <p className="empty">No users found.</p>
      ) : (
        <ul className="mod-list">
          {users.map((u) => {
            const self = u.id === viewer?.id;
            return (
              <li key={u.id} className="mod-item">
                <div className="mod-item-main" style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <Avatar name={u.display_name} src={u.avatar_url} size={40} />
                  <div>
                    <Link href={`/u/${u.username}/`}>
                      <strong>{u.display_name}</strong> @{u.username}
                    </Link>
                    <div className="hint">
                      {u.role} · {u.reputation} rep · joined {formatDate(u.created_at)}
                      {u.is_banned && (
                        <strong className="btn-danger">
                          {" "}
                          · banned {u.banned_until ? `until ${formatDate(u.banned_until)}` : "permanently"}
                        </strong>
                      )}
                    </div>
                  </div>
                </div>
                {!self && (
                  <div className="mod-actions">
                    {u.is_banned ? (
                      <form action={modUnban}>
                        <input type="hidden" name="user_id" value={u.id} />
                        <input type="hidden" name="back" value={back} />
                        <button className="btn btn-secondary" type="submit">Unban</button>
                      </form>
                    ) : (
                      (u.role === "user" || isAdmin) && (
                        <form action={modBan} className="inline-form">
                          <input type="hidden" name="user_id" value={u.id} />
                          <input type="hidden" name="back" value={back} />
                          <label className="sr-only" htmlFor={`days-${u.id}`}>Ban length</label>
                          <select id={`days-${u.id}`} name="days" className="select" defaultValue="7">
                            <option value="1">1 day</option>
                            <option value="7">7 days</option>
                            <option value="30">30 days</option>
                            <option value="permanent">Permanent</option>
                          </select>
                          <label className="sr-only" htmlFor={`note-${u.id}`}>Reason</label>
                          <input id={`note-${u.id}`} name="note" className="input" placeholder="Reason (logged)" maxLength={500} />
                          <button className="btn btn-ghost btn-danger" type="submit">Ban</button>
                        </form>
                      )
                    )}
                    {isAdmin && (
                      <form action={modSetRole} className="inline-form">
                        <input type="hidden" name="user_id" value={u.id} />
                        <input type="hidden" name="back" value={back} />
                        <label className="sr-only" htmlFor={`role-${u.id}`}>Role</label>
                        <select id={`role-${u.id}`} name="role" className="select" defaultValue={u.role}>
                          <option value="user">user</option>
                          <option value="moderator">moderator</option>
                          <option value="admin">admin</option>
                        </select>
                        <button className="btn btn-ghost" type="submit">Set role</button>
                      </form>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
