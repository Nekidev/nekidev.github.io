import Link from "next/link";

export default function NotFound() {
  return (
    <main className="prose prose-stone prose-invert max-w-none">
      <h1>You sure you should be here?</h1>
      <p>
        This blog post was not found. This usually means the URL is in the old
        format. Try going back to the homepage and searching the blog post
        there, all the old-URL posts are there.
      </p>
      <p>
        <Link href="/">Take me to the homepage</Link>
      </p>
    </main>
  );
}
