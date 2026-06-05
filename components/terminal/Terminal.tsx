"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { LogEntry } from "@/types";
import { formatTs } from "@/lib/logger";
import clsx from "clsx";
import {
  Terminal as TerminalIcon,
  ChevronDown,
  ChevronUp,
  Trash2,
  Maximize2,
  Minimize2,
  Circle,
} from "lucide-react";

interface Props {
  logs: LogEntry[];
  onClear?: () => void;
}

const MIN_HEIGHT = 32; // collapsed — just the header bar
const DEFAULT_HEIGHT = 208;
const MAX_HEIGHT = 520;

const LEVEL_STYLES: Record<
  string,
  { text: string; badge: string; label: string; dot: string }
> = {
  info: {
    text: "text-sky-400",
    badge: "bg-sky-950/60 border-sky-800/50 text-sky-400",
    label: "INFO",
    dot: "bg-sky-400",
  },
  success: {
    text: "text-emerald-400",
    badge: "bg-emerald-950/60 border-emerald-800/50 text-emerald-400",
    label: "COMMIT",
    dot: "bg-emerald-400",
  },
  collision: {
    text: "text-rose-400",
    badge: "bg-rose-950/60 border-rose-800/50 text-rose-400",
    label: "COLLISION",
    dot: "bg-rose-400",
  },
  telemetry: {
    text: "text-slate-500",
    badge: "bg-slate-900/60 border-slate-700/50 text-slate-500",
    label: "TELEMETRY",
    dot: "bg-slate-500",
  },
  error: {
    text: "text-red-400",
    badge: "bg-red-950/60 border-red-800/50 text-red-400",
    label: "ERROR",
    dot: "bg-red-400",
  },
};

const ACTOR_STYLES: Record<
  string,
  { label: string; text: string; bg: string }
> = {
  alice: { label: "ALICE", text: "text-sky-400", bg: "bg-sky-950/50" },
  bob: { label: "BOB", text: "text-violet-400", bg: "bg-violet-950/50" },
  system: { label: "SYS", text: "text-slate-400", bg: "bg-slate-800/50" },
};

export function Terminal({ logs, onClear }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [collapsed, setCollapsed] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length, autoScroll]);

  // Drag-to-resize
  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragRef.current) return;
    const delta = dragRef.current.startY - e.clientY;
    const next = Math.min(
      MAX_HEIGHT,
      Math.max(80, dragRef.current.startH + delta),
    );
    setHeight(next);
    setCollapsed(false);
    setMaximized(false);
  }, []);

  const onMouseUp = useCallback(() => {
    dragRef.current = null;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    document.body.style.userSelect = "";
  }, [onMouseMove]);

  function startDrag(e: React.MouseEvent) {
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startH: height };
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  function toggleCollapse() {
    setCollapsed((c) => !c);
    setMaximized(false);
  }

  function toggleMaximize() {
    setMaximized((m) => !m);
    setCollapsed(false);
    setHeight(DEFAULT_HEIGHT);
  }

  const effectiveHeight = maximized
    ? MAX_HEIGHT
    : collapsed
      ? MIN_HEIGHT
      : height;

  const lastLevel = logs.at(-1)?.level;
  const statusDot = lastLevel ? LEVEL_STYLES[lastLevel]?.dot : "bg-slate-600";

  return (
    <div
      ref={containerRef}
      className="flex-shrink-0 border-t border-white/[0.06] flex flex-col relative transition-[height] duration-150"
      style={{ height: effectiveHeight }}
    >
      {/* Resize handle */}
      {!collapsed && !maximized && (
        <div
          onMouseDown={startDrag}
          className="resize-handle absolute top-0 left-0 right-0 h-1 z-10 group"
        >
          <div className="resize-bar absolute top-0 left-0 right-0 h-px bg-white/[0.05] transition-colors duration-150" />
          <div className="absolute inset-x-0 -top-1 h-3 cursor-ns-resize" />
        </div>
      )}

      {/* ── Header (VS Code style tab bar) ───────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-0 h-8 bg-[#0a0f1a] border-b border-white/[0.05]">
        {/* Left: tab */}
        <div className="flex items-center h-full">
          <button
            onClick={toggleCollapse}
            className="flex items-center gap-2 h-full px-3 border-r border-white/[0.05] border-t-2 border-t-sky-500 bg-[#0d1117] text-slate-300 hover:text-slate-100 transition-colors"
          >
            <TerminalIcon size={11} />
            <span className="font-sans text-[11px] font-medium">Terminal</span>
            {logs.length > 0 && (
              <span className="font-mono text-[9px] text-slate-600">
                {logs.length}
              </span>
            )}
            {/* Last-event indicator */}
            {lastLevel && (
              <span className={clsx("w-1.5 h-1.5 rounded-full", statusDot)} />
            )}
          </button>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-0.5 pr-1">
          {/* Legend dots */}
          <div className="flex items-center gap-2 mr-3 pr-3 border-r border-white/[0.05]">
            {Object.entries(LEVEL_STYLES).map(([key, s]) => (
              <div
                key={key}
                className="flex items-center gap-1"
                title={s.label}
              >
                <span className={clsx("w-1.5 h-1.5 rounded-full", s.dot)} />
                <span className="font-mono text-[8px] text-slate-700 hidden lg:block">
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          {onClear && (
            <button
              onClick={onClear}
              title="Clear terminal"
              className="flex items-center justify-center w-6 h-6 rounded hover:bg-white/[0.06] text-slate-600 hover:text-slate-400 transition-colors"
            >
              <Trash2 size={11} />
            </button>
          )}
          <button
            onClick={toggleMaximize}
            title={maximized ? "Restore" : "Maximize panel"}
            className="flex items-center justify-center w-6 h-6 rounded hover:bg-white/[0.06] text-slate-600 hover:text-slate-400 transition-colors"
          >
            {maximized ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
          </button>
          <button
            onClick={toggleCollapse}
            title={collapsed ? "Expand panel" : "Collapse panel"}
            className="flex items-center justify-center w-6 h-6 rounded hover:bg-white/[0.06] text-slate-600 hover:text-slate-400 transition-colors"
          >
            {collapsed ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        </div>
      </div>

      {/* ── Log content ──────────────────────────────── */}
      {!collapsed && (
        <div
          className="relative flex-1 overflow-hidden bg-[#080c14] scanlines"
          onScroll={(e) => {
            const el = e.currentTarget;
            const atBottom =
              el.scrollHeight - el.scrollTop - el.clientHeight < 40;
            setAutoScroll(atBottom);
          }}
        >
          <div className="h-full overflow-y-auto p-3 space-y-0.5 font-mono text-[11px]">
            {logs.length === 0 && (
              <div className="flex items-center gap-2 text-slate-700 py-1">
                <span className="animate-blink">█</span>
                <span>awaiting events…</span>
              </div>
            )}

            {logs.map((log) => {
              const style = LEVEL_STYLES[log.level] ?? LEVEL_STYLES.telemetry;
              const actor = log.actor ? ACTOR_STYLES[log.actor] : null;

              return (
                <div
                  key={log.id}
                  className="group flex items-start gap-2 py-0.5 rounded-sm hover:bg-white/[0.02] px-1 -mx-1 animate-fade-in"
                >
                  {/* Timestamp */}
                  <span className="flex-shrink-0 text-slate-700 tabular-nums w-[88px] text-right pt-px">
                    {formatTs(log.ts)}
                  </span>

                  {/* Level badge */}
                  <span
                    className={clsx(
                      "flex-shrink-0 text-[8px] px-1.5 py-px rounded border font-bold tracking-wide",
                      style.badge,
                    )}
                  >
                    {style.label}
                  </span>

                  {/* Actor badge */}
                  {actor && (
                    <span
                      className={clsx(
                        "flex-shrink-0 text-[8px] px-1.5 py-px rounded font-medium",
                        actor.text,
                        actor.bg,
                      )}
                    >
                      {actor.label}
                    </span>
                  )}

                  {/* Message */}
                  <span
                    className={clsx("flex-1 min-w-0 break-words", style.text)}
                  >
                    {log.message}
                    {log.detail && (
                      <span className="text-slate-600 ml-2 text-[10px]">
                        {log.detail}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Auto-scroll indicator */}
          {!autoScroll && (
            <button
              onClick={() => {
                setAutoScroll(true);
                bottomRef.current?.scrollIntoView({ behavior: "smooth" });
              }}
              className="absolute bottom-2 right-2 flex items-center gap-1 font-mono text-[10px] px-2 py-1 bg-slate-800/90 border border-white/[0.1] text-slate-400 rounded-lg hover:text-slate-200 transition-colors backdrop-blur-sm"
            >
              <ChevronDown size={10} />
              scroll to bottom
            </button>
          )}
        </div>
      )}
    </div>
  );
}
