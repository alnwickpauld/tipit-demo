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
    <section className="rounded-[1.75rem] border border-[#151515] bg-[#090909] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.25)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid flex-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[#8d8d8d]">Venue</p>
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
                        ? "border border-[#f5d31d] bg-[#f5d31d] font-semibold text-[#050505]"
                        : "border border-[#2a2a2a] bg-[#0b0b0b] text-white hover:border-[#5f4d10]",
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
              <p className="text-xs uppercase tracking-[0.22em] text-[#8d8d8d]">
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
                          ? "border border-[#f5d31d] bg-[#f5d31d] font-semibold text-[#050505]"
                          : "border border-[#2a2a2a] bg-[#0b0b0b] text-white hover:border-[#5f4d10]",
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
              <p className="text-xs uppercase tracking-[0.22em] text-[#8d8d8d]">
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
                          ? "border border-[#f5d31d] bg-[#f5d31d] font-semibold text-[#050505]"
                          : "border border-[#2a2a2a] bg-[#0b0b0b] text-white hover:border-[#5f4d10]",
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
              <p className="text-xs uppercase tracking-[0.22em] text-[#8d8d8d]">Rank by</p>
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
                          ? "border border-[#f5d31d] bg-[#f5d31d] font-semibold text-[#050505]"
                          : "border border-[#2a2a2a] bg-[#0b0b0b] text-white hover:border-[#5f4d10]",
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
