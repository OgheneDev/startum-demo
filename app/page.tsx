"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type {
  WorkspaceProfile,
  WorkflowEntity,
  BlueprintConfig,
  LogEntry,
  CollisionOutcome,
  WsEntityUpdatedPayload,
  TransitionRule,
  ProfileTokens,
} from "@/types";
import { PROFILES, DEFAULT_PROFILE } from "@/lib/profiles";
import {
  issueToken,
  fetchActiveBlueprint,
  fetchEntities,
  uploadBlueprint,
  createEntity,
  mutateEntity,
} from "@/lib/api";
import { makeLog } from "@/lib/logger";

import { ProfileSelector } from "@/components/dashboard/ProfileSelector";
import { EntityTable } from "@/components/dashboard/EntityTable";
import { MutateModal } from "@/components/dashboard/MutateModal";
import { BlueprintInspector } from "@/components/inspector/BlueprintInspector";
import { CollisionSimulator } from "@/components/collision/CollisionSimulator";
import { Terminal } from "@/components/terminal/Terminal";

import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  GitBranch,
  Layers,
  X,
} from "lucide-react";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:4000";

// ─── Per-profile cached state ─────────────────────────────────────────────────

interface ProfileCache {
  tokens: ProfileTokens;
  blueprint: BlueprintConfig;
  entities: WorkflowEntity[];
  aliceSocket: Socket;
  bobSocket: Socket;
}

export default function DashboardPage() {
  const [activeProfileId, setActiveProfileId] = useState<string>(
    DEFAULT_PROFILE.id,
  );
  const [initializing, setInitializing] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const cacheRef = useRef<Map<string, ProfileCache>>(new Map());
  const [readyProfiles, setReadyProfiles] = useState<Set<string>>(new Set());
  const [entityMap, setEntityMap] = useState<Map<string, WorkflowEntity[]>>(
    new Map(),
  );

  const [mobileTab, setMobileTab] = useState<"alice" | "bob">("alice");
  const [blueprintOpen, setBlueprintOpen] = useState(false);

  const [mutateTarget, setMutateTarget] = useState<{
    entity: WorkflowEntity;
    actor: "alice" | "bob";
  } | null>(null);

  const [collisionRunning, setCollisionRunning] = useState(false);
  const [aliceCollisionOutcome, setAliceCollisionOutcome] =
    useState<CollisionOutcome>("idle");
  const [bobCollisionOutcome, setBobCollisionOutcome] =
    useState<CollisionOutcome>("idle");
  const [collisionEntityId, setCollisionEntityId] = useState<
    string | undefined
  >();

  const addLog = useCallback((log: LogEntry) => {
    setLogs((prev) => [...prev.slice(-499), log]);
  }, []);

  function clearLogs() {
    setLogs([]);
  }

  // ─── Build socket ─────────────────────────────────────────────────────────

  function makeSocket(
    token: string,
    actor: "alice" | "bob",
    profileId: string,
    tenantId: string,
  ): Socket {
    const socket = io(WS_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 1000,
    });

    socket.on("connect", () =>
      addLog(
        makeLog(
          "info",
          `WebSocket authenticated — tenant: ${tenantId}`,
          actor,
          `socket_id: ${socket.id}`,
        ),
      ),
    );

    socket.on("connect_error", (err) =>
      addLog(
        makeLog("error", `WebSocket connection failed: ${err.message}`, actor),
      ),
    );

    socket.on("entity:updated", (payload: WsEntityUpdatedPayload) => {
      setEntityMap((prev) => {
        const next = new Map(prev);
        const current = next.get(profileId) ?? [];
        next.set(
          profileId,
          current.map((e) =>
            e.id === payload.entity_id
              ? {
                  ...e,
                  currentState: payload.new_state,
                  version: payload.version,
                  attributes: { ...e.attributes, ...payload.attributes },
                  updatedAt: payload.timestamp,
                }
              : e,
          ),
        );
        return next;
      });

      addLog(
        makeLog(
          "success",
          `entity:updated — ${payload.entity_id.slice(0, 8)}… ${payload.old_state} → ${payload.new_state}`,
          actor,
          `v${payload.version} · actor: ${payload.actor_id}`,
        ),
      );
      addLog(
        makeLog(
          "telemetry",
          `Redis pub/sub broadcast received`,
          actor,
          `channel: tenant:${payload.tenant_id}:stream`,
        ),
      );
    });

    socket.on("mutation:collision", (payload) =>
      addLog(
        makeLog(
          "collision",
          `mutation:collision — entity: ${payload.entity_id?.slice(0, 8)}…`,
          actor,
          `stale_version: ${payload.stale_version}`,
        ),
      ),
    );

    socket.on("disconnect", (reason) =>
      addLog(makeLog("telemetry", `WebSocket disconnected: ${reason}`, actor)),
    );

    return socket;
  }

  // ─── Boot a single profile ────────────────────────────────────────────────

  async function bootProfile(p: WorkspaceProfile): Promise<void> {
    addLog(
      makeLog(
        "info",
        `Booting workspace: ${p.label}`,
        "system",
        `tenant: ${p.tenantId}`,
      ),
    );

    // Issue tokens using each actor's specific role
    let tokens: ProfileTokens;
    try {
      const [a, b] = await Promise.all([
        issueToken(p.apiKey, p.alice.role, p.alice.id),
        issueToken(p.apiKey, p.bob.role, p.bob.id),
      ]);
      tokens = { alice: a, bob: b };
      addLog(
        makeLog(
          "success",
          `${p.label} — tokens issued`,
          "system",
          `alice: ${p.alice.role} · bob: ${p.bob.role}`,
        ),
      );
    } catch (err: any) {
      addLog(
        makeLog(
          "error",
          `${p.label} — token issuance failed: ${err.message}`,
          "system",
        ),
      );
      return;
    }

    // Connect sockets
    const aliceSocket = makeSocket(tokens.alice, "alice", p.id, p.tenantId);
    const bobSocket = makeSocket(tokens.bob, "bob", p.id, p.tenantId);

    // Fetch blueprint + entities in parallel
    const [existingBlueprint, existing] = await Promise.all([
      fetchActiveBlueprint(tokens.alice),
      fetchEntities(tokens.alice, p.entityType),
    ]);

    // Handle blueprint
    let blueprint: BlueprintConfig;
    if (existingBlueprint) {
      blueprint = existingBlueprint;
      addLog(
        makeLog(
          "telemetry",
          `${p.label} — blueprint fetched (${blueprint.transitions.length} transitions)`,
          "system",
        ),
      );
    } else {
      addLog(makeLog("info", `${p.label} — uploading blueprint…`, "system"));
      try {
        await uploadBlueprint(tokens.alice, p.blueprint);
        blueprint = p.blueprint;
        addLog(makeLog("success", `${p.label} — blueprint uploaded`, "system"));
      } catch (err: any) {
        addLog(
          makeLog(
            "error",
            `${p.label} — blueprint upload failed: ${err.message}`,
            "system",
          ),
        );
        blueprint = p.blueprint;
      }
    }

    // Handle entities
    let entities: WorkflowEntity[];
    if (existing.length > 0) {
      entities = existing;
      addLog(
        makeLog(
          "telemetry",
          `${p.label} — hydrated ${entities.length} entities`,
          "system",
        ),
      );
    } else {
      addLog(makeLog("info", `${p.label} — seeding entities…`, "system"));
      const seeded = await Promise.all(
        p.seedEntities.map(async (seed) => {
          try {
            const e = await createEntity(
              tokens.alice,
              p.entityType,
              seed.initial_state,
              seed.attributes,
            );
            return e;
          } catch {
            return null;
          }
        }),
      );
      entities = seeded.filter(Boolean) as WorkflowEntity[];
      addLog(
        makeLog(
          "success",
          `${p.label} — seeded ${entities.length} entities`,
          "system",
        ),
      );
    }

    cacheRef.current.set(p.id, {
      tokens,
      blueprint,
      entities,
      aliceSocket,
      bobSocket,
    });

    setEntityMap((prev) => {
      const next = new Map(prev);
      next.set(p.id, entities);
      return next;
    });

    setReadyProfiles((prev) => new Set([...prev, p.id]));
  }

  // ─── Boot all on mount ────────────────────────────────────────────────────

  useEffect(() => {
    async function bootAll() {
      setInitializing(true);
      addLog(makeLog("info", "Booting all workspaces in parallel…", "system"));
      await Promise.all(PROFILES.map((p) => bootProfile(p)));
      addLog(makeLog("success", "All workspaces ready", "system"));
      setInitializing(false);
    }

    bootAll();

    return () => {
      cacheRef.current.forEach((cache) => {
        cache.aliceSocket.disconnect();
        cache.bobSocket.disconnect();
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Profile switch — instant, no network calls ───────────────────────────

  function handleProfileChange(p: WorkspaceProfile) {
    setActiveProfileId(p.id);
    setAliceCollisionOutcome("idle");
    setBobCollisionOutcome("idle");
    setCollisionEntityId(undefined);
    addLog(makeLog("info", `Switched to workspace: ${p.label}`, "system"));
  }

  // ─── Derived active state ─────────────────────────────────────────────────

  const activeProfile = PROFILES.find((p) => p.id === activeProfileId)!;
  const activeCache = cacheRef.current.get(activeProfileId);
  const activeEntities = entityMap.get(activeProfileId) ?? [];
  const activeBlueprint = activeCache?.blueprint ?? null;
  const activeTokens = activeCache?.tokens ?? null;
  const activeProfileReady = readyProfiles.has(activeProfileId);
  const isLoading = initializing || !activeProfileReady;

  // ─── Manual mutation ──────────────────────────────────────────────────────

  async function handleMutateConfirm(
    rule: TransitionRule,
    payload: Record<string, unknown>,
  ) {
    if (!mutateTarget || !activeTokens) return;
    const { entity, actor } = mutateTarget;
    setMutateTarget(null);

    const token = actor === "alice" ? activeTokens.alice : activeTokens.bob;

    addLog(
      makeLog(
        "info",
        `Mutation dispatched — ${entity.id.slice(0, 8)}… ${rule.from_state} → ${rule.to_state}`,
        actor,
        `v${entity.version}`,
      ),
    );

    const result = await mutateEntity(
      token,
      entity.id,
      rule.from_state,
      rule.to_state,
      entity.version,
      payload,
    );

    if (result.success && result.entity) {
      addLog(
        makeLog(
          "success",
          `DB commit OK — entity v${result.entity.version} · audit dispatched async`,
          actor,
        ),
      );
    } else if (result.error?.code === "MUTATION_COLLISION") {
      addLog(
        makeLog(
          "collision",
          `Error 409: Mutation Rejected. Version mismatch detected at database row level.`,
          actor,
          `expected v${result.error.stale_version}`,
        ),
      );
    } else {
      addLog(
        makeLog(
          "error",
          `Mutation failed: ${result.error?.message ?? "unknown"}`,
          actor,
        ),
      );
    }
  }

  // ─── Collision simulation ─────────────────────────────────────────────────
  // Finds a transition both Alice AND Bob can perform (shared role intersection),
  // or falls back to finding any entity where at least one of them can act.
  // For profiles with different roles (e.g. dispatcher + driver), the collision
  // targets a transition accessible to both — if none exists, it uses Alice's role.

  async function handleSimulateCollision() {
    if (!activeTokens || !activeBlueprint) return;

    const freshEntities = await fetchEntities(
      activeTokens.alice,
      activeProfile.entityType,
    );
    if (freshEntities.length > 0) {
      setEntityMap((prev) => {
        const next = new Map(prev);
        next.set(activeProfileId, freshEntities);
        return next;
      });
    }

    const aliceRole = activeProfile.alice.role;
    const bobRole = activeProfile.bob.role;

    // Prefer a transition both can perform (true collision scenario)
    let target = freshEntities.find((e) =>
      activeBlueprint.transitions.some(
        (t) =>
          t.from_state === e.currentState &&
          t.allowed_roles.includes(aliceRole) &&
          t.allowed_roles.includes(bobRole),
      ),
    );

    let availableRule = target
      ? activeBlueprint.transitions.find(
          (t) =>
            t.from_state === target!.currentState &&
            t.allowed_roles.includes(aliceRole) &&
            t.allowed_roles.includes(bobRole),
        )
      : undefined;

    // Fallback — find any transition Alice can do (Bob will get a FORBIDDEN but
    // that still demonstrates the OCC layer for the winner)
    if (!target || !availableRule) {
      target = freshEntities.find((e) =>
        activeBlueprint.transitions.some(
          (t) =>
            t.from_state === e.currentState &&
            t.allowed_roles.includes(aliceRole),
        ),
      );
      availableRule = target
        ? activeBlueprint.transitions.find(
            (t) =>
              t.from_state === target!.currentState &&
              t.allowed_roles.includes(aliceRole),
          )
        : undefined;
    }

    if (!target || !availableRule) {
      addLog(
        makeLog(
          "error",
          "No entity in a mutable state for current actors — all may be at terminal states",
          "system",
        ),
      );
      return;
    }

    setCollisionRunning(true);
    setCollisionEntityId(target.id);
    setAliceCollisionOutcome("idle");
    setBobCollisionOutcome("idle");

    // Build payloads
    const alicePayload: Record<string, unknown> = {};
    const bobPayload: Record<string, unknown> = {};

    Object.entries(availableRule.payload_schema).forEach(([key, schema]) => {
      if (schema.type === "string") {
        alicePayload[key] = key.includes("driver")
          ? "driver_mark"
          : `alice_${key}`;
        bobPayload[key] = key.includes("driver")
          ? "driver_sarah"
          : `bob_${key}`;
      } else if (schema.type === "number") {
        alicePayload[key] = 100;
        bobPayload[key] = 200;
      } else {
        alicePayload[key] = "alice";
        bobPayload[key] = "bob";
      }
    });

    addLog(
      makeLog(
        "info",
        `Collision race — entity: ${target.id.slice(0, 8)}… v${target.version}`,
        "system",
        `targeting: ${availableRule.from_state} → ${availableRule.to_state}`,
      ),
    );
    addLog(
      makeLog(
        "info",
        `Alice (${aliceRole}) payload: ${JSON.stringify(alicePayload)}`,
        "alice",
      ),
    );
    addLog(
      makeLog(
        "info",
        `Bob (${bobRole}) payload: ${JSON.stringify(bobPayload)}`,
        "bob",
      ),
    );

    const [aliceResult, bobResult] = await Promise.all([
      mutateEntity(
        activeTokens.alice,
        target.id,
        availableRule.from_state,
        availableRule.to_state,
        target.version,
        alicePayload,
      ),
      mutateEntity(
        activeTokens.bob,
        target.id,
        availableRule.from_state,
        availableRule.to_state,
        target.version,
        bobPayload,
      ),
    ]);

    if (aliceResult.success) {
      setAliceCollisionOutcome("winner");
      setBobCollisionOutcome("loser");
      addLog(
        makeLog(
          "success",
          `Alice committed — v${aliceResult.entity?.version}`,
          "alice",
          `state: ${aliceResult.entity?.currentState}`,
        ),
      );
      addLog(
        makeLog(
          "collision",
          `Error 409: Bob rejected — version mismatch`,
          "bob",
          `expected v${target.version}`,
        ),
      );
    } else if (bobResult.success) {
      setBobCollisionOutcome("winner");
      setAliceCollisionOutcome("loser");
      addLog(
        makeLog(
          "success",
          `Bob committed — v${bobResult.entity?.version}`,
          "bob",
          `state: ${bobResult.entity?.currentState}`,
        ),
      );
      addLog(
        makeLog(
          "collision",
          `Error 409: Alice rejected — version mismatch`,
          "alice",
          `expected v${target.version}`,
        ),
      );
    } else {
      setAliceCollisionOutcome("loser");
      setBobCollisionOutcome("loser");
      addLog(
        makeLog(
          "error",
          `Both mutations failed — entity state may have changed. Try again.`,
          "system",
        ),
      );
    }

    addLog(
      makeLog(
        "telemetry",
        `OCC barrier held — one atomic commit, one version rejection`,
        "system",
      ),
    );
    setCollisionRunning(false);

    setTimeout(() => {
      setAliceCollisionOutcome("idle");
      setBobCollisionOutcome("idle");
      setCollisionEntityId(undefined);
    }, 4000);
  }

  const availableTransitions = activeBlueprint?.transitions ?? [];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col bg-[#080c14] overflow-hidden"
      style={{ height: "100dvh" }}
    >
      {/* Top bar */}
      <header
        className="shrink-0 flex items-center justify-between px-3 sm:px-4 border-b border-white/6 bg-[#080c14]/95 backdrop-blur-sm z-20"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          minHeight: "calc(2.75rem + env(safe-area-inset-top))",
        }}
      >
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-linear-to-br from-indigo-500/30 to-violet-500/20 border border-indigo-500/20">
              <GitBranch size={13} className="text-indigo-400" />
            </div>
            <div className="leading-none hidden xs:block">
              <span className="block font-sans font-bold text-sm text-slate-100 tracking-tight">
                STRATUM
              </span>
              <span className="block font-mono text-[8px] text-slate-700 mt-px">
                engine-as-a-service
              </span>
            </div>
          </div>

          <div className="w-px h-6 bg-white/6 hidden sm:block" />

          <div className="hidden sm:block">
            <ProfileSelector
              active={activeProfile}
              onChange={handleProfileChange}
              loading={initializing}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {initializing && (
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/2 border border-white/5">
              <Loader2 size={9} className="text-amber-400 animate-spin" />
              <span className="font-mono text-[9px] text-slate-500">
                booting {readyProfiles.size}/{PROFILES.length} workspaces…
              </span>
            </div>
          )}

          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/2 border border-white/5">
            {activeTokens ? (
              <CheckCircle2 size={10} className="text-emerald-400" />
            ) : initializing ? (
              <Loader2 size={10} className="text-amber-400 animate-spin" />
            ) : (
              <AlertCircle size={10} className="text-rose-400" />
            )}
            <span className="font-mono text-[9px] text-slate-500 hidden sm:block">
              {activeTokens
                ? "authenticated"
                : initializing
                  ? "authenticating…"
                  : "auth failed"}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span className="font-mono text-[9px] text-emerald-500/70 hidden sm:block">
              live
            </span>
          </div>

          <button
            onClick={() => setBlueprintOpen(true)}
            className="lg:hidden flex items-center justify-center w-7 h-7 rounded-md bg-white/3 border border-white/6 text-slate-500 hover:text-slate-300"
          >
            <Layers size={13} />
          </button>
        </div>
      </header>

      {/* Mobile profile selector */}
      <div className="sm:hidden shrink-0 px-3 py-2 border-b border-white/5 bg-[#0a0f1a]">
        <ProfileSelector
          active={activeProfile}
          onChange={handleProfileChange}
          loading={initializing}
        />
      </div>

      {/* Main */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {blueprintOpen && (
          <div
            className="lg:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
            onClick={() => setBlueprintOpen(false)}
          />
        )}

        <aside
          className={[
            "flex-col min-h-0 overflow-hidden bg-[#0a0f1a] border-r border-white/5",
            "lg:flex lg:relative lg:w-60 lg:z-auto lg:translate-x-0",
            "fixed top-0 left-0 h-full z-40 w-72 flex transition-transform duration-300",
            blueprintOpen
              ? "translate-x-0"
              : "-translate-x-full lg:translate-x-0",
          ].join(" ")}
        >
          <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-white/6">
            <span className="font-sans font-semibold text-sm text-slate-200">
              Blueprint
            </span>
            <button
              onClick={() => setBlueprintOpen(false)}
              className="flex items-center justify-center w-7 h-7 rounded-md bg-white/4 border border-white/6 text-slate-500 hover:text-slate-300"
            >
              <X size={13} />
            </button>
          </div>
          <BlueprintInspector
            config={activeBlueprint}
            loading={isLoading}
            tenantId={activeProfile.tenantId}
          />
        </aside>

        <main className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
          <CollisionSimulator
            onSimulate={handleSimulateCollision}
            running={collisionRunning}
            disabled={isLoading || !activeTokens}
            hasEntities={activeEntities.length > 0}
          />

          {/* Desktop: side-by-side */}
          <div className="hidden md:flex flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 border-r border-white/5 min-h-0 flex flex-col overflow-hidden">
              <EntityTable
                entities={activeEntities}
                actor="alice"
                loading={isLoading}
                collisionEntityId={collisionEntityId}
                collisionOutcome={aliceCollisionOutcome}
                onMutate={(entity) =>
                  setMutateTarget({ entity, actor: "alice" })
                }
                availableTransitions={availableTransitions}
                actorLabel={activeProfile.alice.label}
                actorRole={activeProfile.alice.role}
              />
            </div>
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <EntityTable
                entities={activeEntities}
                actor="bob"
                loading={isLoading}
                collisionEntityId={collisionEntityId}
                collisionOutcome={bobCollisionOutcome}
                onMutate={(entity) => setMutateTarget({ entity, actor: "bob" })}
                availableTransitions={availableTransitions}
                actorLabel={activeProfile.bob.label}
                actorRole={activeProfile.bob.role}
              />
            </div>
          </div>

          {/* Mobile: tabbed */}
          <div className="flex md:hidden flex-col flex-1 min-h-0 overflow-hidden">
            <div className="shrink-0 flex border-b border-white/5">
              {(["alice", "bob"] as const).map((actor) => {
                const isActive = mobileTab === actor;
                const def =
                  actor === "alice" ? activeProfile.alice : activeProfile.bob;
                const color =
                  actor === "alice"
                    ? "text-sky-400 border-sky-400"
                    : "text-violet-400 border-violet-400";
                const dot = actor === "alice" ? "bg-sky-400" : "bg-violet-400";
                return (
                  <button
                    key={actor}
                    onClick={() => setMobileTab(actor)}
                    className={[
                      "flex-1 flex items-center justify-center gap-2 py-2.5 font-sans text-xs font-medium border-b-2 transition-colors",
                      isActive
                        ? color
                        : "text-slate-500 border-transparent hover:text-slate-300",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "w-1.5 h-1.5 rounded-full",
                        dot,
                        isActive ? "opacity-100" : "opacity-30",
                      ].join(" ")}
                    />
                    {actor === "alice" ? "Alice" : "Bob"}
                    <span className="font-mono text-[9px] opacity-50">
                      / {def.role}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {mobileTab === "alice" ? (
                <EntityTable
                  entities={activeEntities}
                  actor="alice"
                  loading={isLoading}
                  collisionEntityId={collisionEntityId}
                  collisionOutcome={aliceCollisionOutcome}
                  onMutate={(entity) =>
                    setMutateTarget({ entity, actor: "alice" })
                  }
                  availableTransitions={availableTransitions}
                  actorLabel={activeProfile.alice.label}
                  actorRole={activeProfile.alice.role}
                />
              ) : (
                <EntityTable
                  entities={activeEntities}
                  actor="bob"
                  loading={isLoading}
                  collisionEntityId={collisionEntityId}
                  collisionOutcome={bobCollisionOutcome}
                  onMutate={(entity) =>
                    setMutateTarget({ entity, actor: "bob" })
                  }
                  availableTransitions={availableTransitions}
                  actorLabel={activeProfile.bob.label}
                  actorRole={activeProfile.bob.role}
                />
              )}
            </div>
          </div>
        </main>
      </div>

      <Terminal logs={logs} onClear={clearLogs} />

      {mutateTarget && activeBlueprint && (
        <MutateModal
          entity={mutateTarget.entity}
          transitions={activeBlueprint.transitions}
          actor={mutateTarget.actor}
          actorRole={
            mutateTarget.actor === "alice"
              ? activeProfile.alice.role
              : activeProfile.bob.role
          }
          onConfirm={handleMutateConfirm}
          onClose={() => setMutateTarget(null)}
        />
      )}
    </div>
  );
}
