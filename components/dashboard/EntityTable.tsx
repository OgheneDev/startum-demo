"use client";

import type { WorkflowEntity, CollisionOutcome, TransitionRule } from "@/types";
import clsx from "clsx";

interface Props {
  entities: WorkflowEntity[];
  actor: "alice" | "bob";
  actorLabel: string;
  actorRole: string;
  loading: boolean;
  collisionEntityId?: string;
  collisionOutcome?: CollisionOutcome;
  onMutate: (entity: WorkflowEntity) => void;
  availableTransitions: TransitionRule[];
}

const STATE_STYLES: Record<string, { dot: string; text: string }> = {
  pending: { dot: "bg-amber-400", text: "text-amber-400" },
  assigned: { dot: "bg-sky-400", text: "text-sky-400" },
  in_transit: { dot: "bg-blue-400", text: "text-blue-400" },
  delivered: { dot: "bg-emerald-400", text: "text-emerald-400" },
  cancelled: { dot: "bg-rose-500", text: "text-rose-500" },
  landed: { dot: "bg-sky-400", text: "text-sky-400" },
  deboarding: { dot: "bg-sky-300", text: "text-sky-300" },
  cleaning: { dot: "bg-slate-400", text: "text-slate-400" },
  fueling: { dot: "bg-amber-400", text: "text-amber-400" },
  boarding: { dot: "bg-emerald-400", text: "text-emerald-400" },
  departed: { dot: "bg-slate-300", text: "text-slate-300" },
  waiting: { dot: "bg-amber-400", text: "text-amber-400" },
  triage: { dot: "bg-orange-400", text: "text-orange-400" },
  assessment: { dot: "bg-blue-400", text: "text-blue-400" },
  treatment: { dot: "bg-purple-400", text: "text-purple-400" },
  discharged: { dot: "bg-emerald-400", text: "text-emerald-400" },
};

function getStateStyle(state: string) {
  return STATE_STYLES[state] ?? { dot: "bg-slate-400", text: "text-slate-400" };
}

export function EntityTable({
  entities,
  actor,
  actorLabel,
  actorRole,
  loading,
  collisionEntityId,
  collisionOutcome,
  onMutate,
  availableTransitions,
}: Props) {
  const accentColor = actor === "alice" ? "text-sky-400" : "text-violet-400";

  return (
    <div className="flex flex-col h-full">
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span
            className={clsx(
              "font-mono text-xs font-bold uppercase tracking-widest",
              accentColor,
            )}
          >
            {actor === "alice" ? "Alice" : "Bob"}
          </span>
          <span className="font-mono text-[10px] text-slate-600">
            / {actorRole}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-[10px] text-slate-600">
            ws connected
          </span>
        </div>
      </div>

      {/* Entity rows */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="p-4 space-y-2 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-14 bg-white/3 rounded" />
            ))}
          </div>
        )}

        {!loading && entities.length === 0 && (
          <div className="p-4">
            <p className="font-mono text-xs text-slate-600 italic">
              No entities found.
            </p>
          </div>
        )}

        {!loading &&
          entities.map((entity) => {
            const style = getStateStyle(entity.currentState);
            const isCollisionTarget = entity.id === collisionEntityId;

            // Only show mutate button for transitions this actor's role can perform
            const hasNextTransition = availableTransitions.some(
              (t) =>
                t.from_state === entity.currentState &&
                t.allowed_roles.includes(actorRole),
            );

            return (
              <div
                key={entity.id}
                className={clsx(
                  "px-4 py-3 border-b border-white/4 transition-all duration-300",
                  isCollisionTarget &&
                    collisionOutcome === "winner" &&
                    "bg-emerald-950/30",
                  isCollisionTarget &&
                    collisionOutcome === "loser" &&
                    "bg-rose-950/30",
                  "hover:bg-white/2",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={clsx(
                          "w-1.5 h-1.5 rounded-full shrink-0",
                          style.dot,
                        )}
                      />
                      <span className="font-mono text-xs text-slate-300 truncate">
                        {entity.id.slice(0, 8)}…
                      </span>
                      <span
                        className={clsx("font-mono text-[10px]", style.text)}
                      >
                        {entity.currentState}
                      </span>
                    </div>

                    <div className="mt-0.5 ml-3.5 font-mono text-[10px] text-slate-600">
                      v{entity.version} · {entity.entityType}
                    </div>

                    <div className="mt-1 ml-3.5 flex flex-wrap gap-x-3 gap-y-0.5">
                      {Object.entries(entity.attributes)
                        .slice(0, 3)
                        .map(([k, v]) => (
                          <span
                            key={k}
                            className="font-mono text-[9px] text-slate-600"
                          >
                            {k}:{" "}
                            <span className="text-slate-500">{String(v)}</span>
                          </span>
                        ))}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {isCollisionTarget && collisionOutcome === "winner" && (
                      <span className="font-mono text-[9px] px-1.5 py-0.5 bg-emerald-900/50 text-emerald-400 rounded border border-emerald-800">
                        committed
                      </span>
                    )}
                    {isCollisionTarget && collisionOutcome === "loser" && (
                      <span className="font-mono text-[9px] px-1.5 py-0.5 bg-rose-900/50 text-rose-400 rounded border border-rose-800">
                        rejected
                      </span>
                    )}
                    {hasNextTransition && !isCollisionTarget && (
                      <button
                        onClick={() => onMutate(entity)}
                        className="font-mono text-[10px] px-2 py-1 bg-white/4 hover:bg-white/8 text-slate-400 hover:text-slate-200 rounded border border-white/8 transition-colors"
                      >
                        mutate →
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
