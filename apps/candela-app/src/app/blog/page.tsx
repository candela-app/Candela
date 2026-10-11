import Link from 'next/link';

export default function BlogPage() {
  return (
    <main className="flex min-h-dvh items-center bg-slate-950 px-6 py-24 text-white">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-300">Blogs</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">Stories and updates</h1>
        <p className="mt-4 text-base leading-7 text-slate-300">
          Blog posts will be published here.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-500"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
