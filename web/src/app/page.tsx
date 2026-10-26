import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-(--layout-max-width) flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl">אימונים ותזונה</h1>
      <p className="text-text-muted">האפליקציה בבנייה. בינתיים אפשר לראות את מערכת העיצוב.</p>
      <Link href="/design" className="font-semibold text-accent underline underline-offset-4">
        למערכת העיצוב
      </Link>
    </main>
  );
}
