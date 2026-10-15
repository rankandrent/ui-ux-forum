import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { Avatar } from "@/components/Avatar";
import { getViewer } from "@/lib/supabase/server";

export async function Header() {
  const viewer = await getViewer();
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
