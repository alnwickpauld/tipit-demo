"use client";

import { useEffect, useState } from "react";

import { TipForm } from "./tip-form";

type TipFormClientProps = {
  slug: string;
  currency: string;
  targetName: string;
  textColor: string;
  buttonColor: string;
  buttonTextColor: string;
  backgroundColor: string;
};

export function TipFormClient(props: TipFormClientProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="mt-10 space-y-4 text-center">
        <div className="mx-auto h-10 w-40 animate-pulse rounded-2xl bg-[#d9d9d9]" />
        <div className="mx-auto h-5 w-64 animate-pulse rounded-full bg-[#dfdfdf]" />
        <div className="space-y-3">
          <div className="h-16 animate-pulse rounded-xl bg-[#f2f2f2]" />
          <div className="h-16 animate-pulse rounded-xl bg-[#f2f2f2]" />
          <div className="h-16 animate-pulse rounded-xl bg-[#f2f2f2]" />
          <div className="h-16 animate-pulse rounded-xl bg-[#f2f2f2]" />
        </div>
      </div>
    );
  }

  return <TipForm {...props} />;
}
