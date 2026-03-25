import Link from "next/link";

import { apiReferenceRoutes, apiReferenceTags } from "../../server/api-reference";

const authLegend = {
  Public: "Public",
  TIPIT_ADMIN: "Tipit Admin only",
  "TIPIT_ADMIN | CUSTOMER_*": "Any authenticated user",
  CUSTOMER_READ: "Customer viewer or above",
  CUSTOMER_OPERATIONS: "Customer manager or admin",
  CUSTOMER_BILLING: "Customer admin only",
} as const;

export default function ApiReferencePage() {
  return (
    <main className="min-h-screen bg-[#0d1321] text-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(20,31,56,0.96),rgba(11,17,31,0.98))] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.45)] sm:p-8">
          <p className="text-xs uppercase tracking-[0.35em] text-[#f7c948]">Backend Reference</p>
          <h1 className="mt-3 text-balance text-4xl font-semibold sm:text-5xl">Tipit API Reference</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[#c7d2e5] sm:text-base">
            A lightweight reference for the authenticated Tipit backend. Use the login endpoint to
            obtain a bearer token, then call the admin routes below.
          </p>

          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <Link
              href="/api/openapi"
              className="rounded-full bg-[#f7c948] px-5 py-3 font-semibold text-[#111827] no-underline transition hover:brightness-105"
            >
              View OpenAPI JSON
            </Link>
            <span className="rounded-full border border-white/12 bg-white/5 px-4 py-3 text-[#d7dfef]">
              Demo login: `platform-admin@tipit.example` / `Password123!`
            </span>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-[#9db0cf]">Tags</p>
            <div className="mt-4 space-y-2">
              {apiReferenceTags.map((tag) => (
                <a
                  key={tag}
                  href={`#${tag.toLowerCase().replace(/\s+/g, "-")}`}
                  className="block rounded-2xl border border-white/8 bg-[#10192d] px-4 py-3 text-sm text-[#e6ebf5] no-underline transition hover:border-[#f7c948]/50 hover:text-white"
                >
                  {tag}
                </a>
              ))}
            </div>
          </aside>

          <div className="space-y-6">
            {apiReferenceTags.map((tag) => {
              const routes = apiReferenceRoutes.filter((route) => route.tag === tag);

              return (
                <section
                  key={tag}
                  id={tag.toLowerCase().replace(/\s+/g, "-")}
                  className="rounded-[1.75rem] border border-white/10 bg-white p-5 text-[#172033] shadow-[0_18px_40px_rgba(15,23,42,0.16)]"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-[#7a88a6]">Section</p>
                      <h2 className="mt-2 text-2xl font-semibold">{tag}</h2>
                    </div>
                    <p className="text-sm text-[#5d6a85]">{routes.length} route{routes.length === 1 ? "" : "s"}</p>
                  </div>

                  <div className="mt-5 space-y-4">
                    {routes.map((route) => (
                      <article
                        key={`${route.method}-${route.path}`}
                        className="rounded-[1.5rem] border border-[#d9e0ec] bg-[#f8fafd] p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-3">
                            <span
                              className={[
                                "inline-flex min-w-16 justify-center rounded-full px-3 py-1 text-xs font-semibold tracking-[0.16em]",
                                route.method === "GET"
                                  ? "bg-[#d9f4e6] text-[#0a6a3a]"
                                  : route.method === "POST"
                                    ? "bg-[#e4ecff] text-[#2648a5]"
                                    : "bg-[#fff0cc] text-[#8a5b00]",
                              ].join(" ")}
                            >
                              {route.method}
                            </span>
                            <code className="text-sm font-semibold text-[#172033]">{route.path}</code>
                          </div>
                          <span className="rounded-full bg-[#172033] px-3 py-1 text-xs font-semibold text-white">
                            {authLegend[route.auth]}
                          </span>
                        </div>

                        <p className="mt-3 text-sm leading-7 text-[#52607c]">{route.summary}</p>

                        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
                          <div className="rounded-2xl border border-[#dde3ef] bg-white p-4">
                            <p className="text-xs uppercase tracking-[0.22em] text-[#75829c]">Request</p>
                            <p className="mt-2 text-sm text-[#172033]">
                              {route.body && route.body.length > 0
                                ? route.body.join(", ")
                                : "No request body"}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-[#dde3ef] bg-white p-4">
                            <p className="text-xs uppercase tracking-[0.22em] text-[#75829c]">Response</p>
                            <p className="mt-2 text-sm text-[#172033]">{route.response}</p>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
