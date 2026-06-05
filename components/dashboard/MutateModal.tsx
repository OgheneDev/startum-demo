"use client";

import { useState } from "react";
import type { WorkflowEntity, TransitionRule } from "@/types";
import clsx from "clsx";
import { X, ArrowRight, Shield, ChevronRight, Terminal } from "lucide-react";

interface Props {
  entity: WorkflowEntity;
  transitions: TransitionRule[];
  actor: "alice" | "bob";
  onConfirm: (rule: TransitionRule, payload: Record<string, unknown>) => void;
  onClose: () => void;
}

export function MutateModal({
  entity,
  transitions,
  actor,
  onConfirm,
  onClose,
}: Props) {
  const available = transitions.filter(
    (t) => t.from_state === entity.currentState,
  );
  const [selectedRule, setSelectedRule] = useState<TransitionRule | null>(
    available[0] ?? null,
  );
  const [fields, setFields] = useState<Record<string, string>>({});

  if (available.length === 0) return null;

  const isAlice = actor === "alice";
  const accentText = isAlice ? "text-sky-400" : "text-violet-400";
  const accentBg = isAlice ? "bg-sky-500/10" : "bg-violet-500/10";
  const accentBorder = isAlice ? "border-sky-500/25" : "border-violet-500/25";
  const accentGlow = isAlice
    ? "shadow-[0_0_40px_rgba(56,189,248,0.1)]"
    : "shadow-[0_0_40px_rgba(167,139,250,0.1)]";
  const activeRuleBg = isAlice
    ? "bg-sky-500/10 border-sky-500/30"
    : "bg-violet-500/10 border-violet-500/30";
  const activeRuleText = isAlice ? "text-sky-300" : "text-violet-300";
  const submitBg = isAlice
    ? "bg-sky-500/15 hover:bg-sky-500/20 border-sky-500/30 text-sky-300"
    : "bg-violet-500/15 hover:bg-violet-500/20 border-violet-500/30 text-violet-300";

  function handleSubmit() {
    if (!selectedRule) return;
    const payload: Record<string, unknown> = {};
    Object.entries(selectedRule.payload_schema).forEach(([key, schema]) => {
      const raw = fields[key] ?? "";
      payload[key] = schema.type === "number" ? Number(raw) : raw;
    });
    onConfirm(selectedRule, payload);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className={clsx(
          "w-full sm:max-w-md rounded-t-2xl sm:rounded-xl border overflow-hidden",
          "bg-[#0d1117]",
          accentBorder,
          accentGlow,
          // On mobile: slide up from bottom, full width
          "animate-slide-up",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle — mobile only */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/10" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-white/6">
          <div className="flex items-center gap-3">
            <div
              className={clsx(
                "flex items-center justify-center w-7 h-7 rounded-lg border",
                accentBg,
                accentBorder,
              )}
            >
              <Terminal size={13} className={accentText} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-sans font-semibold text-sm text-slate-100">
                  Mutate Entity
                </span>
                <span
                  className={clsx(
                    "font-mono text-[10px] px-1.5 py-0.5 rounded",
                    accentBg,
                    accentText,
                  )}
                >
                  {actor}
                </span>
              </div>
              <div className="font-mono text-[9px] text-slate-600 mt-0.5">
                {entity.id.slice(0, 12)}… · v{entity.version}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/4 hover:bg-white/8 border border-white/6 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X size={13} />
          </button>
        </div>

        {/* Body — scrollable on mobile */}
        <div className="px-4 sm:px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Transition selector */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 font-mono text-[9px] text-slate-600 uppercase tracking-widest">
              <ArrowRight size={9} />
              Select Transition
            </label>
            <div className="space-y-1.5">
              {available.map((rule) => {
                const isSelected = selectedRule?.to_state === rule.to_state;
                return (
                  <button
                    key={rule.to_state}
                    onClick={() => {
                      setSelectedRule(rule);
                      setFields({});
                    }}
                    className={clsx(
                      "w-full text-left px-3 py-2.5 rounded-lg border font-mono text-xs transition-all duration-150",
                      isSelected
                        ? [activeRuleBg, activeRuleText]
                        : "bg-white/2 border-white/5 text-slate-500 hover:bg-white/4 hover:border-white/8",
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-y-1 gap-x-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={
                            isSelected ? "text-slate-400" : "text-slate-600"
                          }
                        >
                          {rule.from_state}
                        </span>
                        <ArrowRight
                          size={9}
                          className="text-slate-700 shrink-0"
                        />
                        <span
                          className={
                            isSelected ? "text-slate-100 font-medium" : ""
                          }
                        >
                          {rule.to_state}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {rule.allowed_roles.map((r) => (
                          <span
                            key={r}
                            className="inline-flex items-center gap-0.5 font-mono text-[8px] px-1.5 py-0.5 bg-slate-900 border border-white/5 text-slate-600 rounded"
                          >
                            <Shield size={7} />
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payload fields */}
          {selectedRule &&
            Object.keys(selectedRule.payload_schema).length > 0 && (
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 font-mono text-[9px] text-slate-600 uppercase tracking-widest">
                  <Terminal size={9} />
                  Payload
                </label>
                <div className="space-y-2">
                  {Object.entries(selectedRule.payload_schema).map(
                    ([key, schema]) => (
                      <div key={key}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <label className="font-mono text-[10px] text-slate-500">
                            {key}
                          </label>
                          <span className="font-mono text-[9px] text-blue-400">
                            {schema.type}
                          </span>
                          {schema.required && (
                            <span className="font-mono text-[8px] text-rose-500 font-bold">
                              required
                            </span>
                          )}
                        </div>
                        <input
                          type={schema.type === "number" ? "number" : "text"}
                          value={fields[key] ?? ""}
                          onChange={(e) =>
                            setFields((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                          placeholder={`${schema.type}…`}
                          className={clsx(
                            "w-full bg-white/3 border rounded-lg px-3 py-2.5",
                            "font-mono text-xs text-slate-200 placeholder-slate-700",
                            "transition-colors duration-150 focus:outline-none",
                            "border-white/6 focus:border-white/[0.14]",
                            // larger tap target on mobile
                            "text-base sm:text-xs",
                          )}
                        />
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 sm:px-5 py-3.5 border-t border-white/6 bg-white/1">
          <button
            onClick={onClose}
            className="font-sans text-xs px-3.5 py-2 text-slate-500 hover:text-slate-300 transition-colors rounded-lg hover:bg-white/4"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedRule}
            className={clsx(
              "flex items-center gap-1.5 font-sans font-medium text-xs px-4 py-2 rounded-lg border transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed",
              submitBg,
            )}
          >
            Execute Mutation
            <ChevronRight size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}
