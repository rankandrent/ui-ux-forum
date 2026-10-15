import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AvatarUpload } from "@/components/AvatarUpload";
import { ProfileForm } from "@/components/ProfileForm";
import { createClient, getViewer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };

export default async function SettingsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login/?next=/settings/");
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, bio, website, email_notifications, avatar_url")
    .eq("id", viewer.id)
    .single();
  if (!profile) redirect("/");

  return (
    <section className="card card-pad" style={{ maxWidth: 640 }}>
      <h1>Edit profile</h1>
      <p className="hint">
        Signed in as {viewer.email}. <Link href={`/u/${viewer.username}/`}>View profile</Link>
      </p>
      <AvatarUpload name={profile.display_name} src={profile.avatar_url} />
      <ProfileForm profile={profile} />
    </section>
  );
}
