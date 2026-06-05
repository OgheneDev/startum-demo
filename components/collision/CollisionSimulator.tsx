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
    <div className="shrink-0 flex flex-col sm:flex-row items-center justify-between gap-2 px-3 sm:px-5 py-2.5 border-b border-white/6 bg-[#080c14]">
      {/* Label — hidden on smallest screens */}
      <div className="hidden sm:flex items-center gap-2">
        <AlertTriangle size={11} className="text-amber-500/70 shrink-0" />
        <span className="font-mono text-[9px] text-slate-600 uppercase tracking-[0.12em] whitespace-nowrap">
          OCC Race Simulator
        </span>
        <span className="hidden lg:block font-mono text-[9px] text-slate-700">
          · Promise.all concurrent dispatch · identical version targeting
        </span>
      </div>

      {/* Button — full width on mobile */}
      <button
        onClick={onSimulate}
        disabled={isDisabled}
        className={clsx(
          "relative group flex items-center justify-center gap-2.5 w-full sm:w-auto px-5 py-2 rounded-lg font-sans font-medium text-xs transition-all duration-200 border overflow-hidden",
          running
            ? "bg-amber-500/10 border-amber-500/30 text-amber-300 cursor-wait"
            : isDisabled
              ? "bg-white/2 border-white/5 text-slate-600 cursor-not-allowed"
              : "bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/15 hover:border-rose-500/50 hover:shadow-[0_0_20px_rgba(248,113,113,0.15)] active:scale-[0.98]",
        )}
      >
        {running ? (
          <>
            <Loader2
              size={13}
              className="animate-spin text-amber-400 shrink-0"
            />
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

      {/* Actor pills — right side, desktop only */}
      <div className="hidden lg:flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/2 border border-white/4">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400/60" />
          <span className="font-mono text-[9px] text-slate-600">alice</span>
        </div>
        <span className="font-mono text-[9px] text-slate-700">vs</span>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/2 border border-white/4">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400/60" />
          <span className="font-mono text-[9px] text-slate-600">bob</span>
        </div>
      </div>
    </div>
  );
}
