import Link from "next/link";
import { SORTS, type SortKey } from "@/lib/site";

export function SortTabs({ basePath, current }: { basePath: string; current: SortKey }) {
  return (
    <nav className="tabs" aria-label="Sort questions">
      {SORTS.map((s) => (
        <Link
          key={s.key}
          href={s.key === "latest" ? basePath : `${basePath}?sort=${s.key}`}
          aria-current={s.key === current ? "page" : undefined}
        >
          {s.label}
        </Link>
      ))}
    </nav>
  );
}
