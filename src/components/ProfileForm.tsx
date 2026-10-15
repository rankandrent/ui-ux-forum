"use client";

import { useActionState } from "react";
import { updateProfile } from "@/app/actions/forum";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

type Props = {
  username: string;
  display_name: string;
  bio: string;
  website: string | null;
  email_notifications: boolean;
};

export function ProfileForm({ profile }: { profile: Props }) {
  const [state, action] = useActionState(updateProfile, null);
  return (
    <form action={action} className="form">
      <div className="field">
        <label htmlFor="display_name">Display name</label>
        <input id="display_name" name="display_name" className="input" required maxLength={60} defaultValue={profile.display_name} />
      </div>
      <div className="field">
        <label htmlFor="username">Username</label>
        <input
          id="username"
          name="username"
          className="input"
          required
          pattern="[a-z0-9_]{3,30}"
          defaultValue={profile.username}
        />
        <span className="hint">Lowercase letters, numbers and underscores. Your profile URL is /u/username/.</span>
      </div>
      <div className="field">
        <label htmlFor="bio">Bio</label>
        <textarea id="bio" name="bio" className="textarea small" maxLength={1000} defaultValue={profile.bio} />
      </div>
      <div className="field">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="url" className="input" defaultValue={profile.website ?? ""} placeholder="https://" />
      </div>
      <label className="checkbox">
        <input type="checkbox" name="email_notifications" defaultChecked={profile.email_notifications} />
        Email me when someone answers, comments on or accepts my posts
      </label>
      <FormMessage state={state} />
      <div>
        <SubmitButton>Save profile</SubmitButton>
      </div>
    </form>
  );
}
