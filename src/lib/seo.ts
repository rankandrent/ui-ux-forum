import type { Metadata } from "next";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

// Page-level `robots` / `openGraph` replace the layout's values instead of merging, so pages
// spread these in explicitly.
export const INDEX_ROBOTS: Metadata["robots"] = {
  index: true,
  follow: true,
  googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
};
export const NOINDEX_ROBOTS: Metadata["robots"] = { index: false, follow: true };

export const OG_IMAGES = [{ url: "/og-default.png", width: 1200, height: 630, alt: `${SITE_NAME} — ${SITE_TAGLINE}` }];
