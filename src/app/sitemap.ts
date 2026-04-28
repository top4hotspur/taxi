import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/siteContent";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/services", "/airport-transfers", "/golf-transfers", "/tours", "/quote"];

  return routes.map((route) => ({
    url: `${siteConfig.url}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: route === "" ? 1 : 0.8,
  }));
}
