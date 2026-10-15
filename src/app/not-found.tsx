import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card card-pad empty">
      <h1>Page not found</h1>
      <p>The question may have been removed, or the link is wrong.</p>
      <Link className="btn btn-primary" href="/">
        Browse questions
      </Link>
    </div>
  );
}
