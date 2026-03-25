import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[var(--shadow)] backdrop-blur">
        <p className="text-sm uppercase tracking-[0.32em] text-[var(--muted)]">
          Tipit
        </p>
        <h1 className="mt-4 text-balance text-4xl leading-tight">
          Premium digital tipping for hospitality teams.
        </h1>
        <p className="mt-4 text-base leading-7 text-[var(--muted)]">
          Open a public tipping route like <code>/tip/maya-table-qr</code> to
          test the guest payment flow, or sign in to the new admin workspace to
          view customer and venue management screens.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/tip/maya-table-qr"
            className="inline-flex rounded-full bg-[var(--accent-strong)] px-6 py-3 text-sm font-semibold text-white no-underline transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
          >
            Preview Demo Tip Flow
          </Link>
          <Link
            href="/login"
            className="inline-flex rounded-full border border-[var(--border)] bg-white/80 px-6 py-3 text-sm font-semibold text-[var(--foreground)] no-underline transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
          >
            Open Admin Login
          </Link>
        </div>
      </div>
    </main>
  );
}
