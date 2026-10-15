import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { JsonLd } from "@/components/JsonLd";
import { QuestionList } from "@/components/QuestionList";
import { ReportButton } from "@/components/ReportButton";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { excerpt } from "@/lib/markdown";
import { breadcrumbJsonLd, profilePageJsonLd } from "@/lib/schema";
import { listQuestions } from "@/lib/queries";
import { questionPath } from "@/lib/site";
import { createClient, getViewer } from "@/lib/supabase/server";
import { INDEX_ROBOTS, NOINDEX_ROBOTS, OG_IMAGES } from "@/lib/seo";

type Profile = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  website: string | null;
  avatar_url: string | null;
  reputation: number;
  role: string;
  created_at: string;
};

async function getProfile(username: string) {
  if (!/^[a-z0-9_]{3,30}$/.test(username)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, website, avatar_url, reputation, role, created_at")
    .eq("username", username)
    .maybeSingle<Profile>();
  return data;
}

export async function generateMetadata({ params }: PageProps<"/u/[username]">): Promise<Metadata> {
  const profile = await getProfile((await params).username);
  if (!profile) return {};
  // Profiles are indexed once the user has helped (3+ upvoted answers or an accepted answer).
  const supabase = await createClient();
  const { data: indexable } = await supabase.rpc("profile_is_indexable", { p_user: profile.id });
  const path = `/u/${profile.username}/`;
  const title = `${profile.display_name} (@${profile.username})`;
  const description = profile.bio
    ? excerpt(profile.bio, 155)
    : `${profile.display_name} on ${"UI/UX Forum"} — ${profile.reputation} reputation.`;
  return {
    title,
    description,
    alternates: { canonical: path },
    robots: indexable ? INDEX_ROBOTS : NOINDEX_ROBOTS,
    openGraph: { title, description, url: path, type: "profile", images: profile.avatar_url ? [profile.avatar_url] : OG_IMAGES },
  };
}

export default async function ProfilePage({ params }: PageProps<"/u/[username]">) {
  const profile = await getProfile((await params).username);
  if (!profile) notFound();

  const supabase = await createClient();
  const [viewer, { questions, total: questionTotal }, answersRes, badgesRes] = await Promise.all([
    getViewer(),
    listQuestions({ sort: "latest", page: 1, authorId: profile.id }),
    supabase
      .from("answers")
      .select("id, score, is_accepted, created_at, question:questions!answers_question_id_fkey(id, slug, title)", { count: "exact" })
      .eq("author_id", profile.id)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("user_badges")
      .select("awarded_at, badge:badges(slug, name, description, tier)")
      .eq("user_id", profile.id)
      .order("awarded_at"),
  ]);
  const answers = (answersRes.data ?? []) as unknown as {
    id: number;
    score: number;
    is_accepted: boolean;
    question: { id: number; slug: string; title: string } | null;
  }[];
  const badges = (badgesRes.data ?? []) as unknown as {
    badge: { slug: string; name: string; description: string; tier: string };
  }[];

  return (
    <div className="form" style={{ gap: 20 }}>
      <JsonLd
        data={profilePageJsonLd({
          siteUrl: env.siteUrl,
          profile,
          questionCount: questionTotal,
          answerCount: answersRes.count ?? 0,
        })}
      />
      <JsonLd data={breadcrumbJsonLd(env.siteUrl, [{ name: profile.display_name, path: `/u/${profile.username}/` }])} />
      <section className="card card-pad">
        <div className="profile-head">
          <Avatar name={profile.display_name} src={profile.avatar_url} size={88} />
          <div style={{ flex: 1 }}>
            <h1 style={{ marginBottom: 2 }}>{profile.display_name}</h1>
            <p className="hint" style={{ margin: 0 }}>
              @{profile.username} · Member since {formatDate(profile.created_at)}
              {profile.role !== "user" && ` · ${profile.role}`}
            </p>
            {profile.website && (
              <a href={profile.website} rel="ugc nofollow noopener" target="_blank">
                {profile.website.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
          {viewer?.id === profile.id && (
            <Link className="btn btn-secondary" href="/settings/">
              Edit profile
            </Link>
          )}
          {viewer && viewer.id !== profile.id && <ReportButton type="user" id={profile.id} />}
        </div>
        {profile.bio && <p style={{ whiteSpace: "pre-line" }}>{profile.bio}</p>}
        <div className="stat-row">
          <span>
            <strong>{profile.reputation}</strong> reputation
          </span>
          <span>
            <strong>{questionTotal}</strong> questions
          </span>
          <span>
            <strong>{answersRes.count ?? 0}</strong> answers
          </span>
        </div>
      </section>

      {badges.length > 0 && (
        <section className="card card-pad">
          <h2 style={{ marginTop: 0 }}>Badges</h2>
          <ul className="badge-list">
            {badges.map(({ badge }) => (
              <li key={badge.slug} className={`badge-pill ${badge.tier}`} title={badge.description}>
                {badge.name}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2 className="card-pad" style={{ margin: 0, paddingBottom: 0 }}>
          Questions
        </h2>
        <QuestionList questions={questions} empty={<p>No questions yet.</p>} />
      </section>

      <section className="card card-pad">
        <h2 style={{ marginTop: 0 }}>Recent answers</h2>
        {answers.length === 0 ? (
          <p className="hint">No answers yet.</p>
        ) : (
          <ul className="cat-list">
            {answers
              .filter((a) => a.question)
              .map((a) => (
                <li key={a.id}>
                  <Link href={`${questionPath(a.question!.id, a.question!.slug)}#answer-${a.id}`}>
                    <span className="rep">{a.score}</span> {a.is_accepted ? "✓ " : ""}
                    {a.question!.title}
                  </Link>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}
