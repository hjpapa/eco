"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

// WebGL can't render during SSR, so load the 3D campus only on the client.
const CompanyMap3D = dynamic(() => import("./CompanyMap3D").then((m) => m.CompanyMap3D), {
  ssr: false,
  loading: () => (
    <div className="flex h-[300px] items-center justify-center rounded-2xl bg-slate-100 text-sm text-slate-400">
      3D 캠퍼스 불러오는 중…
    </div>
  ),
});

export function CompanyCity(props: ComponentProps<typeof CompanyMap3D>) {
  return <CompanyMap3D {...props} />;
}
