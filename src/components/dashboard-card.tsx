type DashboardCardProps = {
  title: string;
  value: string;
  helper?: string;
};

export function DashboardCard({ title, value, helper }: DashboardCardProps) {
  return (
    <section className="rounded-[1.75rem] border border-[#d7c5b2] bg-[rgba(255,250,245,0.82)] p-5 shadow-[0_24px_60px_rgba(97,73,54,0.10)]">
      <p className="text-xs uppercase tracking-[0.24em] text-[#8c7a6c]">{title}</p>
      <p className="mt-3 text-3xl leading-none text-[#43362f]">{value}</p>
      {helper ? <p className="mt-3 text-sm text-[#7f6c5f]">{helper}</p> : null}
    </section>
  );
}
