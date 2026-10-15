export const SITE_NAME = "UI/UX Forum";
export const SITE_TAGLINE = "Answers to UI/UX design questions for AI, SaaS and startup products";
export const AGENCY_URL = "https://ui-ux.agency";
export const PAGE_SIZE = 20;

export const SORTS = [
  { key: "latest", label: "Latest" },
  { key: "top", label: "Top" },
  { key: "unanswered", label: "Unanswered" },
] as const;
export type SortKey = (typeof SORTS)[number]["key"];

export function parseSort(value: unknown): SortKey {
  return value === "top" || value === "unanswered" ? value : "latest";
}

export function parsePage(value: unknown): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 1 && n < 10000 ? n : 1;
}

export function questionPath(id: number, slug: string) {
  return `/q/${id}-${slug}/`;
}

/** Parses "123-some-slug" → 123. */
export function parseQuestionParam(param: string): number | null {
  const match = /^(\d{1,15})(?:-|$)/.exec(param);
  return match ? Number(match[1]) : null;
}
