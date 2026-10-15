import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/auth/",
        "/mod/",
        "/notifications/",
        "/settings/",
        "/ask/",
        "/login/",
        "/signup/",
        "/search/",
        "/a/",
        "/*/edit/",
      ],
    },
    sitemap: `${env.siteUrl}/sitemap.xml`,
    host: env.siteUrl,
  };
}
