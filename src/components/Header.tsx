import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { Avatar } from "@/components/Avatar";
import { getUnreadNotificationCount } from "@/lib/queries";
import { getViewer } from "@/lib/supabase/server";

export async function Header() {
  const viewer = await getViewer();
  const unread = viewer ? await getUnreadNotificationCount(viewer.id) : 0;
  const staff = viewer?.role === "admin" || viewer?.role === "moderator";
  return (
    <header className="site-header">
      <div className="container">
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            UX
          </span>
          UI/UX Forum
        </Link>
        <nav className="main-nav" aria-label="Main">
          <Link href="/">Questions</Link>
          <Link href="/tags/">Tags</Link>
        </nav>
        <form className="header-search" action="/search/" role="search">
          <label className="sr-only" htmlFor="site-search">
            Search questions
          </label>
          <input id="site-search" name="q" type="search" placeholder="Search questions…" />
        </form>
        <div className="header-actions">
          <Link href="/ask/" className="btn btn-primary">
            Ask
          </Link>
          {viewer ? (
            <>
              {staff && (
                <Link href="/mod/" className="link-light">
                  Mod
                </Link>
              )}
              <Link
                href="/notifications/"
                className="bell link-light"
                title={unread ? `${unread} unread notifications` : "Notifications"}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm7-6V11a7 7 0 0 0-5.5-6.84V3a1.5 1.5 0 0 0-3 0v1.16A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2z"
                  />
                </svg>
                <span className="sr-only">Notifications{unread ? ` (${unread} unread)` : ""}</span>
                {unread > 0 && (
                  <span className="bell-count" aria-hidden="true">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
              <Link href={`/u/${viewer.username}/`} className="byline link-light" title="Your profile">
                <Avatar name={viewer.display_name} src={viewer.avatar_url} size={30} />
                <span className="sr-only">Your profile</span>
              </Link>
              <form action={signOut}>
                <button type="submit" className="btn btn-ghost" style={{ color: "#c9d6f2" }}>
                  Log out
                </button>
              </form>
            </>
          ) : (
            <Link href="/login/" className="link-light">
              Log in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
