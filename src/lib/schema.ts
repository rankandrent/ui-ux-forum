import { excerpt, plainText } from "@/lib/markdown";
import { AGENCY_URL, SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import type { Answer, AuthorSummary, Comment, Question, QuestionSummary } from "@/lib/types";

// schema.org JSON-LD builders. No Review / AggregateRating markup anywhere: Google treats
// self-serving review markup on forums as spam. Votes are expressed as upvoteCount (net) plus
// InteractionCounter (LikeAction = upvotes, DislikeAction = downvotes).

export type Tally = { ups: number; downs: number };

const ORG_ID = `${AGENCY_URL}/#organization`;

export function organization(siteUrl: string) {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: "ui-ux.agency",
    url: AGENCY_URL,
    logo: { "@type": "ImageObject", url: `${siteUrl}/logo.png`, width: 512, height: 512 },
    sameAs: [AGENCY_URL],
  };
}

export function websiteJsonLd(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: SITE_NAME,
        description: SITE_TAGLINE,
        url: `${siteUrl}/`,
        inLanguage: "en-US",
        publisher: { "@id": ORG_ID },
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${siteUrl}/search/?q={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      },
      organization(siteUrl),
    ],
  };
}

export function breadcrumbJsonLd(siteUrl: string, items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Forum", path: "/" }, ...items].map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${siteUrl}${item.path}`,
    })),
  };
}

/** CollectionPage + ItemList for category and tag listings (only the threads on the page). */
export function collectionJsonLd(siteUrl: string, opts: { name: string; description: string; path: string; questions: QuestionSummary[] }) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: opts.name,
    description: opts.description,
    url: `${siteUrl}${opts.path}`,
    isPartOf: { "@id": `${siteUrl}/#website` },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: opts.questions.length,
      itemListElement: opts.questions.map((q, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${siteUrl}/q/${q.id}-${q.slug}/`,
        name: q.title,
      })),
    },
  };
}

function person(author: AuthorSummary | null, siteUrl: string) {
  if (!author) return { "@type": "Person", name: "Deleted user" };
  return {
    "@type": "Person",
    name: author.display_name,
    url: `${siteUrl}/u/${author.username}/`,
    ...(author.avatar_url ? { image: author.avatar_url } : {}),
  };
}

function votes(tally: Tally | undefined) {
  const t = tally ?? { ups: 0, downs: 0 };
  return [
    { "@type": "InteractionCounter", interactionType: "https://schema.org/LikeAction", userInteractionCount: t.ups },
    { "@type": "InteractionCounter", interactionType: "https://schema.org/DislikeAction", userInteractionCount: t.downs },
  ];
}

function comments(list: Comment[], siteUrl: string, url: string) {
  return list
    .filter((c) => !c.is_deleted)
    .map((c) => ({
      "@type": "Comment",
      text: c.body,
      dateCreated: c.created_at,
      url: `${url}#comment-${c.id}`,
      author: person(c.author, siteUrl),
    }));
}

/** QAPage per https://developers.google.com/search/docs/appearance/structured-data/qapage */
export function qaPageJsonLd(opts: {
  question: Question;
  answers: Answer[];
  comments: Comment[];
  tallies: Map<string, Tally>;
  url: string;
  siteUrl: string;
}) {
  const { question, siteUrl, url, tallies } = opts;
  const live = opts.answers.filter((a) => !a.is_deleted);
  const commentsFor = (pred: (c: Comment) => boolean) => comments(opts.comments.filter(pred), siteUrl, url);

  const toAnswer = (a: Answer) => {
    const c = commentsFor((x) => x.answer_id === a.id);
    return {
      "@type": "Answer",
      text: plainText(a.body),
      url: `${url}#answer-${a.id}`,
      upvoteCount: a.score,
      dateCreated: a.created_at,
      datePublished: a.created_at,
      dateModified: a.updated_at,
      author: person(a.author, siteUrl),
      interactionStatistic: votes(tallies.get(`answer:${a.id}`)),
      ...(c.length ? { commentCount: c.length, comment: c } : {}),
    };
  };
  const accepted = live.find((a) => a.is_accepted);
  const qComments = commentsFor((x) => x.question_id === question.id);

  return {
    "@context": "https://schema.org",
    "@type": "QAPage",
    mainEntity: {
      "@type": "Question",
      name: question.title,
      text: plainText(question.body),
      url,
      answerCount: live.length,
      upvoteCount: question.score,
      dateCreated: question.created_at,
      datePublished: question.created_at,
      dateModified: question.updated_at,
      author: person(question.author, siteUrl),
      interactionStatistic: votes(tallies.get(`question:${question.id}`)),
      ...(question.category ? { about: { "@type": "Thing", name: question.category.name } } : {}),
      ...(question.tags.length ? { keywords: question.tags.join(", ") } : {}),
      ...(qComments.length ? { commentCount: qComments.length, comment: qComments } : {}),
      ...(accepted ? { acceptedAnswer: toAnswer(accepted) } : {}),
      ...(live.some((a) => !a.is_accepted) ? { suggestedAnswer: live.filter((a) => !a.is_accepted).map(toAnswer) } : {}),
    },
  };
}

/** ProfilePage per https://developers.google.com/search/docs/appearance/structured-data/profile-page */
export function profilePageJsonLd(opts: {
  siteUrl: string;
  profile: {
    id: string;
    username: string;
    display_name: string;
    bio: string;
    website: string | null;
    avatar_url: string | null;
    reputation: number;
    created_at: string;
  };
  questionCount: number;
  answerCount: number;
}) {
  const { profile: p, siteUrl } = opts;
  const url = `${siteUrl}/u/${p.username}/`;
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url,
    dateCreated: p.created_at,
    mainEntity: {
      "@type": "Person",
      name: p.display_name,
      alternateName: `@${p.username}`,
      identifier: p.id,
      url,
      ...(p.avatar_url ? { image: p.avatar_url } : {}),
      ...(p.bio ? { description: excerpt(p.bio, 500) } : {}),
      ...(p.website ? { sameAs: [p.website] } : {}),
      interactionStatistic: [
        { "@type": "InteractionCounter", interactionType: "https://schema.org/WriteAction", name: "Questions", userInteractionCount: opts.questionCount },
        { "@type": "InteractionCounter", interactionType: "https://schema.org/WriteAction", name: "Answers", userInteractionCount: opts.answerCount },
      ],
      agentInteractionStatistic: {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/WriteAction",
        userInteractionCount: opts.questionCount + opts.answerCount,
      },
      additionalProperty: { "@type": "PropertyValue", name: "Reputation", value: p.reputation },
    },
  };
}

/** Serializes JSON-LD safely for a <script> tag. */
export function jsonLdScript(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
