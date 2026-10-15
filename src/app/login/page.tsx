import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/AuthForms";
import { GoogleButton } from "@/components/GoogleButton";
import { getViewer } from "@/lib/supabase/server";
import { safeNext } from "@/lib/request";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };

const ERRORS: Record<string, string> = {
  link: "That sign-in link is invalid or has expired. Please request a new one.",
  google: "Google sign-in is not available right now. Please use email instead.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if (await getViewer()) redirect(next);
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;

  return (
    <div className="auth-wrap">
      <div className="card card-pad form">
        <div>
          <h1>Log in</h1>
          <p className="hint">Ask questions, answer others and build your reputation.</p>
        </div>
        {error && (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        )}
        <GoogleButton next={next} />
        <LoginForm next={next} />
        <p className="hint" style={{ margin: 0 }}>
          New here? <Link href="/signup/">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
