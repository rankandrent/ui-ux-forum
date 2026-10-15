"use client";

import { useState, useTransition } from "react";
import { castVote } from "@/app/actions/forum";

type Props = {
  type: "question" | "answer";
  id: number;
  score: number;
  myVote: number;
  canVote: boolean;
};

export function VoteButtons({ type, id, score: initialScore, myVote: initialVote, canVote }: Props) {
  const [score, setScore] = useState(initialScore);
  const [myVote, setMyVote] = useState(initialVote);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function vote(direction: 1 | -1) {
    if (!canVote) {
      setError("Sign in to vote.");
      return;
    }
    const next = myVote === direction ? 0 : direction;
    const prev = { score, myVote };
    setScore(score - myVote + next);
    setMyVote(next);
    setError(null);
    startTransition(async () => {
      const result = await castVote(type, id, next as -1 | 0 | 1);
      if (result.ok) {
        setScore(result.score);
      } else {
        setScore(prev.score);
        setMyVote(prev.myVote);
        setError(result.error);
      }
    });
  }

  return (
    <div className="vote">
      <button type="button" aria-label="Upvote" aria-pressed={myVote === 1} disabled={pending} onClick={() => vote(1)}>
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 6l7 9H5z" fill="currentColor" />
        </svg>
      </button>
      <span className="score" aria-live="polite">
        {score}
      </span>
      <button type="button" aria-label="Downvote" aria-pressed={myVote === -1} disabled={pending} onClick={() => vote(-1)}>
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 18l-7-9h14z" fill="currentColor" />
        </svg>
      </button>
      {error && (
        <span className="vote-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
