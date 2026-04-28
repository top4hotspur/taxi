import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/siteContent";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
