import { getPages, getPage } from "@/lib/content";
import { LayoutHome } from "@/ui/components/layout-home";
import { LayoutPage } from "@/ui/components/layout-page";
import { LayoutPost } from "@/ui/components/layout-post";
import { Suspense } from "react";

export const dynamicParams = false;

export async function generateStaticParams(): Promise<{ slug: string[] }[]> {
  const pages = await getPages();

  return pages.map((i) => ({ slug: i.slug.split("/") }));
}

export default async function Post({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  return (
    <Suspense>
      <Details params={params} />
    </Suspense>
  );
}

async function Details({ params }: { params: Promise<{ slug: string[] }> }) {
  let { slug } = await params;
  if (slug === undefined) {
    slug = [];
  }
  const page = (await getPage(slug.join("/")))!;

  switch (page.front.layout) {
    case "page":
      return <LayoutPage page={page} />;
    case "home":
      return <LayoutHome page={page} />;
    case "post":
    case undefined:
      return <LayoutPost page={page} />;
  }
}
