import Link from "next/link";
import { getCategories } from "@/lib/queries";
import { AGENCY_URL } from "@/lib/site";

export async function Sidebar({ activeCategory }: { activeCategory?: string }) {
  const categories = await getCategories();
  return (
    <aside className="sidebar">
      <section className="card card-pad">
        <h2>Categories</h2>
        <ul className="cat-list">
          {categories.map((c) => (
            <li key={c.slug}>
              <Link href={`/c/${c.slug}/`} aria-current={c.slug === activeCategory ? "page" : undefined}>
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="cta-card">
        <h2>Need hands-on design help?</h2>
        <p>ui-ux.agency designs AI, SaaS and startup products — research, UX strategy and UI.</p>
        <a className="btn btn-primary" href={AGENCY_URL}>
          Visit ui-ux.agency
        </a>
      </section>
    </aside>
  );
}
