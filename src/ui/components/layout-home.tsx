import { getPages, Page } from "@/lib/content";
import { dateFormatter } from "@/lib/formatting";
import Link from "next/link";

export async function LayoutHome({ page }: { page: Page }) {
  const pages = (await getPages()).filter((post) =>
    post.slug.startsWith("blog/"),
  );

  return (
    <main className="prose prose-stone prose-invert max-w-none">
      {page.content}

      <h2>Posts</h2>
      <ul>
        {pages
          .sort((a, b) => b.date!.getTime() - a.date!.getTime())
          .map((page, i) => (
            <li key={i}>
              <div>
                <div className="inline-block opacity-50">
                  {dateFormatter.format(page.date)}
                </div>
                <Link href={page.slug} className="inline ml-2">{page.front.title}</Link>
              </div>
            </li>
          ))}
      </ul>
      <p>
        Or subscribe <Link href="/rss.xml">via RSS</Link>.
      </p>
    </main>
  );
}
