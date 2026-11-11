import { Page } from "@/lib/content";

export function LayoutPage({ page }: { page: Page }) {
  return (
    <main className="prose prose-stone prose-invert max-w-none">
      {page.content}
    </main>
  );
}
