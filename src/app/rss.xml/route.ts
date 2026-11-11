import { Feed } from "feed";
import { getPages } from "@/lib/content";
import blog from "@/lib/blog";

export const dynamic = "force-static";

export async function GET() {
  const pages = await getPages();

  const feed = new Feed({
    title: blog.title,
    description: blog.description,
    id: "https://nekidev.github.io/",
    link: "https://nekidev.github.io/",
    language: "en",
    copyright: "All rights reserved.",
    feedLinks: {
      rss: "https://nekidev.github.io/rss.xml",
    },
    author: {
      name: "Nyeki",
      avatar: blog.avatar,
      email: blog.social.email,
    },
  });

  for (const page of pages) {
    if (page.front.layout && page.front.layout != "post") {
      continue;
    }

    feed.addItem({
      title: page.front.title,
      id: `https://nekidev.github.io/${page.slug}`,
      link: `https://nekidev.github.io/${page.slug}`,
      date: page.date || new Date(),
    });
  }

  return new Response(feed.rss2(), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
