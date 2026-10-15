import Link from "next/link";
import { PAGE_SIZE } from "@/lib/site";

export function Pagination({
  page,
  total,
  makeHref,
}: {
  page: number;
  total: number;
  makeHref: (page: number) => string;
}) {
  const pages = Math.ceil(total / PAGE_SIZE);
  if (pages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      {page > 1 && (
        <Link className="btn btn-secondary" href={makeHref(page - 1)} rel="prev">
          ← Previous
        </Link>
      )}
      <span className="hint" style={{ alignSelf: "center" }}>
        Page {page} of {pages}
      </span>
      {page < pages && (
        <Link className="btn btn-secondary" href={makeHref(page + 1)} rel="next">
          Next →
        </Link>
      )}
    </nav>
  );
}

export function pageHref(basePath: string, params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const qs = search.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
