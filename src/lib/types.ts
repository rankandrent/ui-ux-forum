export type AuthorSummary = {
  username: string;
  display_name: string;
  avatar_url: string | null;
  reputation: number;
};

export type Category = {
  id: number;
  slug: string;
  name: string;
  description: string;
};

export type QuestionSummary = {
  id: number;
  title: string;
  slug: string;
  score: number;
  answer_count: number;
  view_count: number;
  accepted_answer_id: number | null;
  created_at: string;
  last_activity_at: string;
  author: AuthorSummary | null;
  category: { slug: string; name: string } | null;
  tags: string[];
};

export type Question = QuestionSummary & {
  body: string;
  image_url: string | null;
  author_id: string | null;
  is_locked: boolean;
  is_deleted: boolean;
  updated_at: string;
  comment_count: number;
};

export type Answer = {
  id: number;
  question_id: number;
  author_id: string | null;
  body: string;
  score: number;
  is_accepted: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  author: AuthorSummary | null;
};

export type Comment = {
  id: number;
  question_id: number | null;
  answer_id: number | null;
  author_id: string | null;
  body: string;
  is_deleted: boolean;
  created_at: string;
  author: AuthorSummary | null;
};

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string } | null;
