import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

// Pages that carry `noindex` (login, signup, ask, edit pages, thin tags…) stay crawlable so
// Google can see the noindex. Only private or infinite spaces are disallowed.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/auth/", "/mod/", "/notifications/", "/settings/", "/search/"],
    },
    sitemap: `${env.siteUrl}/sitemap.xml`,
  };
}
