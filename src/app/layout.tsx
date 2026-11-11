import type { Metadata } from "next";
import { Ubuntu, Ubuntu_Mono } from "next/font/google";
import "./globals.css";
import blog from "@/lib/blog";
import Link from "next/link";

const ubuntu = Ubuntu({
  variable: "--font-ubuntu",
  weight: ["400", "700"],
  preload: true,
});

const ubuntuMono = Ubuntu_Mono({
  variable: "--font-ubuntu-mono",
  weight: ["400", "700"],
  preload: true,
});

export const metadata: Metadata = {
  title: `${blog.title} | ${blog.description}`,
  description: blog.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${ubuntu.variable} ${ubuntuMono.variable} h-full antialiased`}
    >
      <head>
        <meta
          name="google-site-verification"
          content="dtIjAnaHE4hiPPGD54oAM9CoR1OOq2g5etGKFu3O5IU"
        />
        <script
          defer
          src="https://cloud.umami.is/script.js"
          data-website-id="bfdb12b8-7c9a-47e3-bd42-18dee97bfd30"
        ></script>
      </head>
      <body className="min-h-full flex flex-col items-center">
        <div className="w-full max-w-3xl py-8 px-4 text-stone-300 flex flex-row items-center justify-between">
          <Link href="/" className="text-xl">
            {blog.title}
          </Link>
          <div className="flex flex-row items-center gap-4">
            {blog.social.other.map((item, i) => (
              <Link href={item.link} key={i} target="_blank">
                <item.Icon className="size-4" />
              </Link>
            ))}
          </div>
        </div>
        <div className="w-full max-w-2xl px-4 py-8 relative">{children}</div>
        <div className="self-stretch border-t border-t-stone-700 py-16 mt-8 flex flex-col items-center">
          <div className="w-full max-w-2xl text-stone-300 prose prose-stone prose-invert px-4">
            <div className="flex flex-row items-center justify-between">
              <div>{blog.title}</div>
              <div className="flex flex-row items-center gap-4">
                {blog.social.other.map((item, i) => (
                  <Link href={item.link} key={i} target="_blank">
                    <item.Icon className="size-4" />
                  </Link>
                ))}
              </div>
            </div>
            <p>{blog.description}</p>
          </div>
        </div>
      </body>
    </html>
  );
}
