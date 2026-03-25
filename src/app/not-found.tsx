import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-6">
      <div className="w-full max-w-md rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-6 text-center shadow-[var(--shadow)] backdrop-blur">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
          Tipit
        </p>
        <h1 className="mt-4 text-4xl leading-tight">This tip link is unavailable.</h1>
        <p className="mt-4 text-base leading-7 text-[var(--muted)]">
          The QR code may be inactive or the link may be incorrect.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-full bg-[var(--accent-strong)] px-6 py-3 text-sm font-semibold text-white no-underline"
        >
          Return home
        </Link>
      </div>
    </main>
  );
}
