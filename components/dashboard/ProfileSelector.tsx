"use client";

import { PROFILES } from "@/lib/profiles";
import type { WorkspaceProfile } from "@/types";
import clsx from "clsx";
import { Plane, Package, Stethoscope, Loader2 } from "lucide-react";

interface Props {
  active: WorkspaceProfile;
  onChange: (profile: WorkspaceProfile) => void;
  loading: boolean;
}

const INDUSTRY_CONFIG: Record<
  string,
  {
    icon: React.ReactNode;
    color: string;
    glow: string;
    activeBg: string;
    activeText: string;
    activeBorder: string;
  }
> = {
  Aviation: {
    icon: <Plane size={11} />,
    color: "text-sky-400",
    glow: "shadow-[0_0_12px_rgba(56,189,248,0.2)]",
    activeBg: "bg-sky-500/10",
    activeText: "text-sky-300",
    activeBorder: "border-sky-500/40",
  },
  Logistics: {
    icon: <Package size={11} />,
    color: "text-emerald-400",
    glow: "shadow-[0_0_12px_rgba(52,211,153,0.2)]",
    activeBg: "bg-emerald-500/10",
    activeText: "text-emerald-300",
    activeBorder: "border-emerald-500/40",
  },
  Healthcare: {
    icon: <Stethoscope size={11} />,
    color: "text-rose-400",
    glow: "shadow-[0_0_12px_rgba(248,113,113,0.2)]",
    activeBg: "bg-rose-500/10",
    activeText: "text-rose-300",
    activeBorder: "border-rose-500/40",
  },
};

export function ProfileSelector({ active, onChange, loading }: Props) {
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <span className="font-mono text-[9px] text-slate-600 uppercase tracking-[0.15em] hidden md:block">
        workspace
      </span>
      <div className="flex gap-1 sm:gap-1.5">
        {PROFILES.map((p) => {
          const cfg = INDUSTRY_CONFIG[p.industry] ?? {
            icon: null,
            color: "text-slate-400",
            glow: "",
            activeBg: "bg-slate-800",
            activeText: "text-slate-200",
            activeBorder: "border-slate-600",
          };
          const isActive = active.id === p.id;
          return (
            <button
              key={p.id}
              onClick={() => !loading && onChange(p)}
              disabled={loading}
              className={clsx(
                "relative flex items-center gap-1.5 px-2.5 lg:cursor-pointer sm:px-3 py-1.5 rounded-md text-[11px] font-medium transition-all duration-200 border font-sans",
                isActive
                  ? [cfg.activeBg, cfg.activeText, cfg.activeBorder, cfg.glow]
                  : "bg-transparent border-white/5 text-slate-500 hover:text-slate-300 hover:border-white/10 hover:bg-white/3",
                loading && "opacity-40 cursor-not-allowed pointer-events-none",
              )}
            >
              {loading && isActive ? (
                <Loader2 size={10} className="animate-spin" />
              ) : (
                <span className={clsx(isActive ? cfg.color : "text-slate-600")}>
                  {cfg.icon}
                </span>
              )}
              {/* Label — hidden on very small screens to save space */}
              <span className="hidden xs:inline sm:inline">{p.label}</span>
              {/* Fallback: just icon on tiny screens */}
            </button>
          );
        })}
      </div>
    </div>
  );
}
