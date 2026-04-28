"use client";

type BrandWordmarkProps = {
  className?: string;
  tone?: "dark" | "light";
  title: string;
  subtitle?: string;
};

export function BrandWordmark({
  className = "",
  tone = "light",
  title,
  subtitle,
}: BrandWordmarkProps) {
  const primary = tone === "light" ? "#f8f2eb" : "#4d4036";
  const secondary = tone === "light" ? "rgba(248,242,235,0.82)" : "#8e7d6f";
  const accent = tone === "light" ? "rgba(248,242,235,0.55)" : "rgba(77,64,54,0.28)";
  const initial = title.trim().charAt(0).toUpperCase() || "T";

  return (
    <div className={`text-center ${className}`}>
      <div
        className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border text-[1.35rem] font-semibold"
        style={{ borderColor: accent, color: primary }}
      >
        {initial}
      </div>
      <div className="mt-3">
        <div
          className="text-[2.1rem] font-semibold uppercase leading-none tracking-[0.08em]"
          style={{ color: primary }}
        >
          {title}
        </div>
        {subtitle ? (
          <>
            <div
              className="mx-auto mt-3 h-px w-28"
              style={{ backgroundColor: accent }}
            />
            <div
              className="mt-2 text-[0.72rem] uppercase tracking-[0.3em]"
              style={{ color: secondary }}
            >
              {subtitle}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
