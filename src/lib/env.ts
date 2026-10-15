import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export const env = {
  get supabaseUrl() {
    return required("SUPABASE_URL");
  },
  get supabaseAnonKey() {
    return required("SUPABASE_ANON_KEY");
  },
  get supabaseServiceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  /** Optional: Turnstile is skipped until both keys are set. */
  get turnstileSiteKey() {
    return process.env.TURNSTILE_SITE_KEY || "";
  },
  get turnstileSecretKey() {
    return process.env.TURNSTILE_SECRET_KEY || "";
  },
  /** Optional: notification emails are only sent when this is set. */
  get resendApiKey() {
    return process.env.RESEND_API_KEY || "";
  },
  get emailFrom() {
    return process.env.EMAIL_FROM || "UI/UX Forum <no-reply@forum.ui-ux.agency>";
  },
  get siteUrl() {
    return (process.env.SITE_URL || "https://forum.ui-ux.agency").replace(/\/$/, "");
  },
};
