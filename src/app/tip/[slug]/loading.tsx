export default function TipLoadingPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#2a2a12_0%,#0a0a0a_38%,#050505_100%)] px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-md rounded-[2rem] border border-[#2a2a2a] bg-[linear-gradient(180deg,rgba(17,17,17,0.98),rgba(8,8,8,0.98))] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.48)]">
        <div className="h-3 w-28 animate-pulse rounded-full bg-[#4a4120]" />
        <div className="mt-6 h-10 w-3/4 animate-pulse rounded-2xl bg-[#2a2a2a]" />
        <div className="mt-4 h-5 w-full animate-pulse rounded-full bg-[#1d1d1d]" />
        <div className="mt-2 h-5 w-5/6 animate-pulse rounded-full bg-[#1d1d1d]" />
        <div className="mt-8 h-40 animate-pulse rounded-[1.75rem] bg-[#17170f]" />
        <div className="mt-8 grid grid-cols-3 gap-3">
          <div className="h-16 animate-pulse rounded-2xl bg-[#1d1d1d]" />
          <div className="h-16 animate-pulse rounded-2xl bg-[#1d1d1d]" />
          <div className="h-16 animate-pulse rounded-2xl bg-[#1d1d1d]" />
        </div>
        <div className="mt-6 h-14 animate-pulse rounded-full bg-[#4a4120]" />
      </div>
    </main>
  );
}
