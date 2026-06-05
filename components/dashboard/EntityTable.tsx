"use client";

import type { WorkflowEntity, CollisionOutcome } from "@/types";
import clsx from "clsx";
import {
  ArrowRight,
  CheckCircle2,
  XCircle,
  Wifi,
  ChevronRight,
} from "lucide-react";

interface Props {
  entities: WorkflowEntity[];
  actor: "alice" | "bob";
  loading: boolean;
  collisionEntityId?: string;
  collisionOutcome?: CollisionOutcome;
  onMutate: (entity: WorkflowEntity) => void;
  availableTransitions: Array<{ from_state: string; to_state: string }>;
}

const STATE_STYLES: Record<string, { dot: string; text: string; bg: string }> =
  {
    pending: {
      dot: "bg-amber-400",
      text: "text-amber-300",
      bg: "bg-amber-500/10",
    },
    assigned: { dot: "bg-sky-400", text: "text-sky-300", bg: "bg-sky-500/10" },
    in_transit: {
      dot: "bg-blue-400",
      text: "text-blue-300",
      bg: "bg-blue-500/10",
    },
    delivered: {
      dot: "bg-emerald-400",
      text: "text-emerald-300",
      bg: "bg-emerald-500/10",
    },
    cancelled: {
      dot: "bg-rose-400",
      text: "text-rose-300",
      bg: "bg-rose-500/10",
    },
    landed: { dot: "bg-sky-400", text: "text-sky-300", bg: "bg-sky-500/10" },
    deboarding: { dot: "bg-sky-300", text: "text-sky-200", bg: "bg-sky-500/8" },
    cleaning: {
      dot: "bg-slate-400",
      text: "text-slate-300",
      bg: "bg-slate-500/10",
    },
    fueling: {
      dot: "bg-amber-400",
      text: "text-amber-300",
      bg: "bg-amber-500/10",
    },
    boarding: {
      dot: "bg-emerald-400",
      text: "text-emerald-300",
      bg: "bg-emerald-500/10",
    },
    departed: {
      dot: "bg-slate-300",
      text: "text-slate-200",
      bg: "bg-slate-500/8",
    },
    waiting: {
      dot: "bg-amber-400",
      text: "text-amber-300",
      bg: "bg-amber-500/10",
    },
    triage: {
      dot: "bg-orange-400",
      text: "text-orange-300",
      bg: "bg-orange-500/10",
    },
    assessment: {
      dot: "bg-blue-400",
      text: "text-blue-300",
      bg: "bg-blue-500/10",
    },
    treatment: {
      dot: "bg-purple-400",
      text: "text-purple-300",
      bg: "bg-purple-500/10",
    },
    discharged: {
      dot: "bg-emerald-400",
      text: "text-emerald-300",
      bg: "bg-emerald-500/10",
    },
  };

function getStateStyle(state: string) {
  return (
    STATE_STYLES[state] ?? {
      dot: "bg-slate-400",
      text: "text-slate-300",
      bg: "bg-slate-500/10",
    }
  );
}

export function EntityTable({
  entities,
  actor,
  loading,
  collisionEntityId,
  collisionOutcome,
  onMutate,
  availableTransitions,
}: Props) {
  const isAlice = actor === "alice";
  const accentText = isAlice ? "text-sky-400" : "text-violet-400";
  const accentBg = isAlice ? "bg-sky-500/10" : "bg-violet-500/10";
  const accentBorder = isAlice ? "border-sky-500/25" : "border-violet-500/25";
  const mutateHover = isAlice
    ? "hover:bg-sky-500/10 hover:border-sky-500/30 hover:text-sky-300"
    : "hover:bg-violet-500/10 hover:border-violet-500/30 hover:text-violet-300";

  return (
    <div className="flex flex-col h-full">
      {/* Column header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div
            className={clsx(
              "flex items-center justify-center w-5 h-5 rounded-md border",
              accentBg,
              accentBorder,
            )}
          >
            <span
              className={clsx("font-mono font-bold text-[9px]", accentText)}
            >
              {isAlice ? "A" : "B"}
            </span>
          </div>
          <div>
            <span
              className={clsx(
                "block font-sans font-semibold text-xs leading-none",
                accentText,
              )}
            >
              {isAlice ? "Alice" : "Bob"}
            </span>
            <span className="block font-mono text-[9px] text-slate-600 mt-0.5">
              dispatcher
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Wifi size={9} className="text-emerald-400 animate-pulse-slow" />
          <span className="font-mono text-[9px] text-slate-600 hidden sm:block">
            live
          </span>
        </div>
      </div>

      {/* Entity list */}
      <div className="flex-1 overflow-y-auto divide-y divide-white/3">
        {loading && (
          <div className="p-3 space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-17 sm:h-18 rounded-lg shimmer" />
            ))}
          </div>
        )}

        {!loading && entities.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center px-4">
            <span className="font-mono text-slate-600 text-2xl">∅</span>
            <p className="font-sans text-xs text-slate-600">No entities</p>
          </div>
        )}

        {!loading &&
          entities.map((entity) => {
            const style = getStateStyle(entity.currentState);
            const isCollisionTarget = entity.id === collisionEntityId;
            const hasNext = availableTransitions.some(
              (t) => t.from_state === entity.currentState,
            );
            const isWinner = isCollisionTarget && collisionOutcome === "winner";
            const isLoser = isCollisionTarget && collisionOutcome === "loser";

            return (
              <div
                key={entity.id}
                className={clsx(
                  "group relative px-3 sm:px-4 py-3 transition-all duration-300",
                  isWinner && "bg-emerald-950/25",
                  isLoser && "bg-rose-950/25 collision-flash",
                  !isCollisionTarget && "hover:bg-white/2",
                )}
              >
                {/* Left accent bar on collision */}
                {isCollisionTarget && (
                  <span
                    className={clsx(
                      "absolute left-0 top-2 bottom-2 w-0.5 rounded-full",
                      isWinner ? "bg-emerald-400" : "bg-rose-400",
                    )}
                  />
                )}

                <div className="flex items-start justify-between gap-2">
                  {/* Entity info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <span
                        className={clsx(
                          "w-1.5 h-1.5 rounded-full shrink-0",
                          isWinner
                            ? "bg-emerald-400"
                            : isLoser
                              ? "bg-rose-400"
                              : style.dot,
                        )}
                      />
                      <span className="font-mono text-xs text-slate-400 tabular-nums">
                        {entity.id.slice(0, 8)}
                        <span className="text-slate-700">…</span>
                      </span>
                      <span
                        className={clsx(
                          "inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-medium",
                          style.bg,
                          style.text,
                        )}
                      >
                        {entity.currentState}
                      </span>
                    </div>

                    <div className="mt-1 ml-3 flex items-center gap-1.5 sm:gap-2">
                      <span className="font-mono text-[9px] text-slate-700">
                        v{entity.version}
                      </span>
                      <span className="w-px h-2 bg-white/6" />
                      <span className="font-mono text-[9px] text-slate-700">
                        {entity.entityType}
                      </span>
                    </div>

                    {/* Attributes — slightly fewer on mobile */}
                    <div className="mt-1 ml-3 flex flex-wrap gap-x-2 sm:gap-x-3 gap-y-0.5">
                      {Object.entries(entity.attributes)
                        .slice(0, 2)
                        .map(([k, v]) => (
                          <span
                            key={k}
                            className="font-mono text-[9px] text-slate-700"
                          >
                            {k}:{" "}
                            <span className="text-slate-500">{String(v)}</span>
                          </span>
                        ))}
                    </div>
                  </div>

                  {/* Right: badge or mutate button */}
                  <div className="shrink-0 flex items-center gap-1.5">
                    {isWinner && (
                      <span className="animate-fade-in flex items-center gap-1 font-mono text-[9px] px-2 py-1 bg-emerald-900/40 text-emerald-400 rounded-md border border-emerald-500/25">
                        <CheckCircle2 size={9} />
                        <span className="hidden sm:inline">committed</span>
                      </span>
                    )}
                    {isLoser && (
                      <span className="animate-fade-in flex items-center gap-1 font-mono text-[9px] px-2 py-1 bg-rose-900/40 text-rose-400 rounded-md border border-rose-500/25">
                        <XCircle size={9} />
                        <span className="hidden sm:inline">rejected</span>
                      </span>
                    )}

                    {/* Mutate button — always visible on mobile (no hover), hover-only on desktop */}
                    {hasNext && !isCollisionTarget && (
                      <button
                        onClick={() => onMutate(entity)}
                        className={clsx(
                          "flex items-center gap-1 font-mono text-[10px] px-2 py-1.5 rounded-md border transition-all duration-150",
                          "bg-white/3 border-white/8 text-slate-500",
                          // Always visible on touch, hover-reveal on desktop
                          "sm:opacity-0 sm:group-hover:opacity-100",
                          mutateHover,
                        )}
                      >
                        <span className="hidden sm:inline">mutate</span>
                        <ChevronRight size={10} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
