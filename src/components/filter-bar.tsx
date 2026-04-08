import type { Route } from "next";
import Link from "next/link";

type Option = {
  value: string;
  label: string;
};

type FilterBarProps = {
  basePath: string;
  venueOptions: Option[];
  payrollPeriodOptions?: Option[];
  granularityOptions?: Option[];
  rankingModeOptions?: Option[];
  selectedVenueId?: string | null;
  selectedPayrollPeriodId?: string | null;
  selectedGranularity?: string | null;
  selectedRankingMode?: string | null;
  extraAction?: React.ReactNode;
};

function buildHref(
  basePath: string,
  values: Record<string, string | null | undefined>,
): Route {
  const params = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const query = params.toString();
  return (query ? `${basePath}?${query}` : basePath) as Route;
}

export function FilterBar({
  basePath,
  venueOptions,
  payrollPeriodOptions,
  granularityOptions,
  rankingModeOptions,
  selectedVenueId,
  selectedPayrollPeriodId,
  selectedGranularity,
  selectedRankingMode,
  extraAction,
}: FilterBarProps) {
  return (
    <section className="rounded-[1.75rem] border border-[#d7c5b2] bg-[rgba(255,250,245,0.82)] p-4 shadow-[0_24px_60px_rgba(97,73,54,0.10)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid flex-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[#8c7a6c]">Venue</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[{ value: "", label: "All venues" }, ...venueOptions].map((option) => {
                const isActive = (selectedVenueId ?? "") === option.value;
                return (
                  <Link
                    key={`venue-${option.value || "all"}`}
                    href={buildHref(basePath, {
                      venueId: option.value || null,
                      payrollPeriodId: selectedPayrollPeriodId,
                      granularity: selectedGranularity,
                      rankingMode: selectedRankingMode,
                    })}
                    className={[
                      "rounded-full px-4 py-2 text-sm transition",
                      isActive
                        ? "border border-[#b49e89] bg-[#b49e89] font-semibold text-[#fffaf4]"
                        : "border border-[#d7c5b2] bg-[rgba(255,251,246,0.96)] text-[#5c4d42] hover:border-[#b49e89]",
                    ].join(" ")}
                  >
                    {option.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {payrollPeriodOptions ? (
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[#8c7a6c]">
                Payroll period
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {payrollPeriodOptions.map((option) => {
                  const isActive = selectedPayrollPeriodId === option.value;
                  return (
                    <Link
                      key={`period-${option.value}`}
                      href={buildHref(basePath, {
                        venueId: selectedVenueId,
                        payrollPeriodId: option.value,
                        granularity: selectedGranularity,
                        rankingMode: selectedRankingMode,
                      })}
                      className={[
                        "rounded-full px-4 py-2 text-sm transition",
                        isActive
                          ? "border border-[#b49e89] bg-[#b49e89] font-semibold text-[#fffaf4]"
                          : "border border-[#d7c5b2] bg-[rgba(255,251,246,0.96)] text-[#5c4d42] hover:border-[#b49e89]",
                      ].join(" ")}
                    >
                      {option.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}

          {granularityOptions ? (
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[#8c7a6c]">
                Ranking window
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {granularityOptions.map((option) => {
                  const isActive = selectedGranularity === option.value;
                  return (
                    <Link
                      key={`granularity-${option.value}`}
                      href={buildHref(basePath, {
                        venueId: selectedVenueId,
                        granularity: option.value,
                        rankingMode: selectedRankingMode,
                      })}
                      className={[
                        "rounded-full px-4 py-2 text-sm transition",
                        isActive
                          ? "border border-[#b49e89] bg-[#b49e89] font-semibold text-[#fffaf4]"
                          : "border border-[#d7c5b2] bg-[rgba(255,251,246,0.96)] text-[#5c4d42] hover:border-[#b49e89]",
                      ].join(" ")}
                    >
                      {option.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}

          {rankingModeOptions ? (
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[#8c7a6c]">Rank by</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {rankingModeOptions.map((option) => {
                  const isActive = selectedRankingMode === option.value;
                  return (
                    <Link
                      key={`ranking-mode-${option.value}`}
                      href={buildHref(basePath, {
                        venueId: selectedVenueId,
                        granularity: selectedGranularity,
                        rankingMode: option.value,
                      })}
                      className={[
                        "rounded-full px-4 py-2 text-sm transition",
                        isActive
                          ? "border border-[#b49e89] bg-[#b49e89] font-semibold text-[#fffaf4]"
                          : "border border-[#d7c5b2] bg-[rgba(255,251,246,0.96)] text-[#5c4d42] hover:border-[#b49e89]",
                      ].join(" ")}
                    >
                      {option.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {extraAction ? <div>{extraAction}</div> : null}
      </div>
    </section>
  );
}
