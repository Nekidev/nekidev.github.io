import blog from "@/lib/blog";
import { getPages, Page } from "@/lib/content";
import { dateFormatter } from "@/lib/formatting";
import { HashIcon } from "lucide-react";
import Link from "next/link";

function wordsToDuration(words: number): string {
  const mins = words / 200;

  if (mins < 1) {
    return "Less than 1 min. to read";
  } else {
    return `~${Math.round(mins)} mins. to read`;
  }
}

export async function LayoutPost({ page }: { page: Page }) {
  const pages = (await getPages())
    .filter(
      (p) =>
        !!p.date &&
        (!page.front.spintag ||
          (p.front.tags || []).includes(page.front.spintag)),
    )
    .sort((a, b) => a.date!.getTime() - b.date!.getTime());
  const index = pages.map((page) => page.slug).indexOf(page.slug);

  return (
    <main className="prose prose-stone prose-invert max-w-none">
      <h1>{page.front.title!}</h1>
      <div className="flex flex-row items-center gap-2 -mt-12">
        <div className="flex flex-row items-center gap-2">
          <img
            src={blog.avatar}
            alt="Nyeki's Avatar"
            className="size-6 rounded-full"
          />
          Nyeki
        </div>
        •
        <div className="flex flex-row items-center gap-2">
          {dateFormatter.format(page.date)}
        </div>
        •
        <div className="flex flex-row items-center gap-2">
          {wordsToDuration(page.words)}
        </div>
      </div>
      {page.front.tags && (
        <div className="flex flex-row items-center gap-2 -mt-4 pb-8">
          {page.front.tags.map((tag, i) => (
            <div
              key={i}
              className="bg-stone-800 px-2 rounded text-stone-400 flex flex-row items-center gap-1"
            >
              <HashIcon className="size-4" />
              {tag}
            </div>
          ))}
        </div>
      )}
      {page.content}
      <hr />
      <div className="flex flex-col sm:flex-row gap-8">
        {index != 0 && index !== undefined && (
          <div className="flex-1 shrink-0">
            <div className="opacity-50">Previous post</div>
            <Link href={"/" + pages[index - 1].slug}>
              {pages[index - 1].front.title}
            </Link>
          </div>
        )}
        {index != pages.length - 1 && index !== undefined && (
          <div className="flex-1 shrink-0 sm:text-right">
            <div className="opacity-50">Next post</div>
            <Link href={"/" + pages[index + 1].slug}>
              {pages[index + 1].front.title}
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
