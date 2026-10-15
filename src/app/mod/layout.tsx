import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Moderation", robots: { index: false, follow: false } };

const TABS = [
  { href: "/mod/", label: "Reports" },
  { href: "/mod/deleted/", label: "Deleted posts" },
  { href: "/mod/users/", label: "Users" },
  { href: "/mod/log/", label: "Log" },
];

export default async function ModLayout({ children }: LayoutProps<"/mod">) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login/?next=/mod/");
  if (viewer.role !== "admin" && viewer.role !== "moderator") redirect("/");

  return (
    <div className="form" style={{ gap: 16 }}>
      <div className="page-head">
        <div>
          <h1>Moderation</h1>
          <p>Signed in as {viewer.role}. Every action is recorded in the log.</p>
        </div>
      </div>
      <nav className="tabs" aria-label="Moderation">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href}>
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
