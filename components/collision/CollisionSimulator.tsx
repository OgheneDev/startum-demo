"use client";

import clsx from "clsx";
import { Zap, Loader2, AlertTriangle } from "lucide-react";

interface Props {
  onSimulate: () => void;
  running: boolean;
  disabled: boolean;
  hasEntities: boolean;
}

export function CollisionSimulator({
  onSimulate,
  running,
  disabled,
  hasEntities,
}: Props) {
  const isDisabled = disabled || running || !hasEntities;

  return (
    <div className="relative flex items-center justify-between gap-4 px-5 py-2.5 border-b border-white/[0.06] bg-[#080c14]">
      {/* Left label */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1.5">
          <AlertTriangle size={11} className="text-amber-500/70" />
          <span className="font-mono text-[9px] text-slate-600 uppercase tracking-[0.12em]">
            OCC Race Simulator
          </span>
        </div>
        <span className="hidden md:block font-mono text-[9px] text-slate-700">
          Promise.all concurrent dispatch · identical version targeting
        </span>
      </div>

      {/* Center button */}
      <button
        onClick={onSimulate}
        disabled={isDisabled}
        className={clsx(
          "relative group flex items-center gap-2.5 px-5 py-2 rounded-lg font-sans font-medium text-xs transition-all duration-200 border overflow-hidden",
          running
            ? "bg-amber-500/10 border-amber-500/30 text-amber-300 cursor-wait"
            : isDisabled
              ? "bg-white/[0.02] border-white/5 text-slate-600 cursor-not-allowed"
              : "bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/15 hover:border-rose-500/50 hover:shadow-[0_0_20px_rgba(248,113,113,0.15)] active:scale-[0.98]",
        )}
      >
        {/* Shimmer on hover */}
        {!isDisabled && !running && (
          <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
        )}

        {running ? (
          <>
            <Loader2 size={13} className="animate-spin text-amber-400" />
            <span>Dispatching concurrent writes…</span>
            <span className="flex gap-0.5 ml-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1 h-1 rounded-full bg-amber-400 animate-bounce"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </span>
          </>
        ) : (
          <>
            <Zap
              size={13}
              className={isDisabled ? "text-slate-600" : "text-rose-400"}
            />
            <span>Simulate Collision Race</span>
          </>
        )}
      </button>

      {/* Right info */}
      <div className="hidden lg:flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/[0.02] border border-white/[0.04]">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400/60" />
          <span className="font-mono text-[9px] text-slate-600">alice</span>
        </div>
        <span className="font-mono text-[9px] text-slate-700">vs</span>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/[0.02] border border-white/[0.04]">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400/60" />
          <span className="font-mono text-[9px] text-slate-600">bob</span>
        </div>
      </div>
    </div>
  );
}
