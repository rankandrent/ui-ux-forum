"use client";

import { useActionState, useState } from "react";
import { sendMagicLink, signInWithPassword, signUp } from "@/app/actions/auth";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

export function LoginForm({ next }: { next: string }) {
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [pwState, pwAction] = useActionState(signInWithPassword, null);
  const [linkState, linkAction] = useActionState(sendMagicLink, null);

  return (
    <div className="form">
      {mode === "password" ? (
        <form action={pwAction} className="form">
          <input type="hidden" name="next" value={next} />
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" className="input" autoComplete="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              className="input"
              autoComplete="current-password"
              required
            />
          </div>
          <FormMessage state={pwState} />
          <SubmitButton className="btn btn-primary btn-block" pendingLabel="Signing in…">
            Log in
          </SubmitButton>
        </form>
      ) : (
        <form action={linkAction} className="form">
          <input type="hidden" name="next" value={next} />
          <div className="field">
            <label htmlFor="magic-email">Email</label>
            <input id="magic-email" name="email" type="email" className="input" autoComplete="email" required />
          </div>
          <FormMessage state={linkState} />
          <SubmitButton className="btn btn-primary btn-block" pendingLabel="Sending…">
            Email me a sign-in link
          </SubmitButton>
        </form>
      )}
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => setMode(mode === "password" ? "magic" : "password")}
      >
        {mode === "password" ? "Use a magic link instead (no password)" : "Use email and password instead"}
      </button>
    </div>
  );
}

export function SignupForm() {
  const [state, action] = useActionState(signUp, null);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="form">
      <div className="field">
        <label htmlFor="name">Name</label>
        <input id="name" name="name" className="input" autoComplete="name" maxLength={60} />
      </div>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" className="input" autoComplete="email" required />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          className="input"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <span className="hint">At least 8 characters.</span>
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn btn-primary btn-block" pendingLabel="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}
