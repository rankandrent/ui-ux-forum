import { excerpt } from "@/lib/markdown";
import type { Answer, AuthorSummary, Question } from "@/lib/types";

function person(author: AuthorSummary | null, siteUrl: string) {
  return author
    ? { "@type": "Person", name: author.display_name, url: `${siteUrl}/u/${author.username}/` }
    : { "@type": "Person", name: "Deleted user" };
}

/** schema.org QAPage for a thread (https://developers.google.com/search/docs/appearance/structured-data/qapage). */
export function qaPageJsonLd(question: Question, answers: Answer[], url: string, siteUrl: string) {
  const live = answers.filter((a) => !a.is_deleted);
  const toAnswer = (a: Answer) => ({
    "@type": "Answer",
    text: excerpt(a.body, 5000),
    dateCreated: a.created_at,
    upvoteCount: a.score,
    url: `${url}#answer-${a.id}`,
    author: person(a.author, siteUrl),
  });
  const accepted = live.find((a) => a.is_accepted);
  return {
    "@context": "https://schema.org",
    "@type": "QAPage",
    mainEntity: {
      "@type": "Question",
      name: question.title,
      text: excerpt(question.body, 5000),
      answerCount: live.length,
      upvoteCount: question.score,
      dateCreated: question.created_at,
      author: person(question.author, siteUrl),
      ...(accepted ? { acceptedAnswer: toAnswer(accepted) } : {}),
      suggestedAnswer: live.filter((a) => !a.is_accepted).map(toAnswer),
    },
  };
}

/** Serializes JSON-LD safely for a <script> tag. */
export function jsonLdScript(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
