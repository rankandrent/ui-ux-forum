import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { compactNumber, timeAgo } from "@/lib/format";
import type { AuthorSummary } from "@/lib/types";

export function Byline({ author, date, verb }: { author: AuthorSummary | null; date: string; verb: string }) {
  return (
    <span className="byline">
      {author ? (
        <>
          <Avatar name={author.display_name} src={author.avatar_url} size={24} />
          <Link href={`/u/${author.username}/`}>{author.display_name}</Link>
          <span className="rep" title="Reputation">
            {compactNumber(author.reputation)}
          </span>
        </>
      ) : (
        <span>Deleted user</span>
      )}
      <span className="rep">
        {verb} <time dateTime={date}>{timeAgo(date)}</time>
      </span>
    </span>
  );
}
