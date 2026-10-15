import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/AuthForms";
import { GoogleButton } from "@/components/GoogleButton";
import { getViewer } from "@/lib/supabase/server";
import { challengeSiteKey } from "@/lib/turnstile";

export const metadata: Metadata = { title: "Sign up", robots: { index: false } };

export default async function SignupPage() {
  if (await getViewer()) redirect("/");
  return (
    <div className="auth-wrap">
      <div className="card card-pad form">
        <div>
          <h1>Join the forum</h1>
          <p className="hint">Free. Get answers from designers who build AI, SaaS and startup products.</p>
        </div>
        <GoogleButton next="/" label="Sign up with Google" />
        <SignupForm siteKey={challengeSiteKey(null)} />
        <p className="hint" style={{ margin: 0 }}>
          Already have an account? <Link href="/login/">Log in</Link>
        </p>
      </div>
    </div>
  );
}
