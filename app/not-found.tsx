import Link from "next/link";

export default function NotFound() {
  return (
    <div className="cinematic-bg flex min-h-screen items-center justify-center px-6 text-ink">
      <div className="max-w-md rounded-lg border border-line bg-bg-panel p-6 text-center">
        <p className="text-[11px] uppercase tracking-widest text-ink-faint">404</p>
        <h1 className="mt-2 text-[18px] font-semibold">Session not found.</h1>
        <p className="mt-1 text-[13px] text-ink-muted">
          That id isn't in the registry. Maybe it expired, or maybe it never existed.
        </p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-md border border-line bg-bg-subtle px-3 py-1.5 text-[12.5px] text-ink hover:bg-bg-hover"
        >
          ← Back to sessions
        </Link>
      </div>
    </div>
  );
}
