type DashboardCardProps = {
  title: string;
  value: string;
  helper?: string;
};

export function DashboardCard({ title, value, helper }: DashboardCardProps) {
  return (
    <section className="rounded-[1.75rem] border border-[#151515] bg-[#090909] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.25)]">
      <p className="text-xs uppercase tracking-[0.24em] text-[#8d8d8d]">{title}</p>
      <p className="mt-3 text-3xl leading-none text-white">{value}</p>
      {helper ? <p className="mt-3 text-sm text-[#9b9b9b]">{helper}</p> : null}
    </section>
  );
}
