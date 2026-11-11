import { readdir, readFile } from "fs/promises";
import matter from "gray-matter";
import { Fragment } from "react/jsx-runtime";
import rehypeReact from "rehype-react";
import remarkFrontmatter from "remark-frontmatter";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import * as runtime from "react/jsx-runtime";
import { ReactNode } from "react";
import rehypeShiki from "@shikijs/rehype";
import theme from "./highlighting";
import remarkGfm from "remark-gfm";

export type Layout = "post" | "page" | "home";

export interface Page {
  path: string;
  slug: string;
  date?: Date;
  words: number;
  front: PageFrontmatter;
  content: ReactNode;
}

export interface PageFrontmatter {
  title: string;
  layout?: Layout;
  tags?: string[];

  // When this is set, next/prev post links will only show posts containing this tag.
  spintag?: string;
}

export async function getPages(): Promise<Page[]> {
  let result = [];

  const processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeShiki, {
      theme,
    })
    .use(rehypeReact, {
      Fragment,
      jsx: runtime.jsx,
      jsxs: runtime.jsxs,
    });

  let paths: string[] = await readdir("content/", { recursive: true });
  for (const path of paths) {
    const slug = path.substring(0, path.lastIndexOf("."));

    try {
      let markdown = matter(await readFile("content/" + path));
      const { date, slug } = getDateAndSlug(path);

      result.push({
        path: "content/" + path,
        slug,
        date,
        words: markdown.content.split(/\s+/).length,
        front: markdown.data as PageFrontmatter,
        content: (await processor.process(markdown.content))
          .result as ReactNode,
      });
    } catch (e) {
      continue;
    }
  }

  return result;
}

export async function getPage(slug: string) {
  return (await getPages()).find((p) => p.slug == slug);
}

function getDateAndSlug(path: string): { date?: Date; slug: string } {
  const parts = path.split("/");
  const last = parts[parts.length - 1];
  const segments = last.split("-");

  if (segments[0].startsWith("20")) {
    const y = segments[0];
    const m = segments[1];
    const d = segments[2];

    const slug = segments.slice(3).join("-").split(".")[0];

    return {
      date: new Date(`${y}-${m}-${d}`),
      slug: [...parts.slice(0, -1), slug].join("/"),
    };
  } else {
    const slug = last.split(".")[0];
    if (slug === "index") {
      if (parts.length === 1) {
        return {
          slug: "",
        };
      } else {
        return {
          slug: parts.slice(0, -1).join("/") + "/",
        };
      }
    } else {
      return {
        slug: [...parts.slice(0, -1), slug].join("/"),
      };
    }
  }
}
