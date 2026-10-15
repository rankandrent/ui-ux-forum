// Sets the Supabase Auth URL configuration through the Management API: `npm run db:auth-config`.
// Only touches site_url and the redirect allow list. Needs SUPABASE_URL and SUPABASE_ACCESS_TOKEN.
const url = process.env.SUPABASE_URL;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!url || !token) {
  console.error("Set SUPABASE_URL and SUPABASE_ACCESS_TOKEN first.");
  process.exit(1);
}
const ref = new URL(url).hostname.split(".")[0];

const config = {
  site_url: "https://forum.ui-ux.agency",
  uri_allow_list: [
    "https://forum.ui-ux.agency/auth/callback/**",
    "http://localhost:3000/auth/callback/**",
  ].join(","),
};

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(config),
});
if (!res.ok) {
  console.error(`FAIL HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`);
  process.exit(1);
}
const saved = await res.json();
console.log(`site_url        ${saved.site_url}`);
console.log(`redirect URLs   ${saved.uri_allow_list}`);
