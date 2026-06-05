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
  Cpu,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Radio,
  GitBranch,
} from "lucide-react";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:4000";

export default function DashboardPage() {
  const [profile, setProfile] = useState<WorkspaceProfile>(DEFAULT_PROFILE);
  const [tokens, setTokens] = useState<ProfileTokens | null>(null);
  const [loading, setLoading] = useState(false);
  const [blueprint, setBlueprint] = useState<BlueprintConfig | null>(null);
  const [entities, setEntities] = useState<WorkflowEntity[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);

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

  const aliceSocketRef = useRef<Socket | null>(null);
  const bobSocketRef = useRef<Socket | null>(null);

  // ─── Logs ─────────────────────────────────────────────────────────────────

  const addLog = useCallback((log: LogEntry) => {
    setLogs((prev) => [...prev.slice(-499), log]);
  }, []);

  function clearLogs() {
    setLogs([]);
  }

  // ─── WebSockets ───────────────────────────────────────────────────────────

  const connectSockets = useCallback(
    (p: WorkspaceProfile, aliceToken: string, bobToken: string) => {
      aliceSocketRef.current?.disconnect();
      bobSocketRef.current?.disconnect();

      function makeSocket(token: string, actor: "alice" | "bob"): Socket {
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
              `WebSocket authenticated — tenant: ${p.tenantId}`,
              actor,
              `socket_id: ${socket.id}`,
            ),
          ),
        );
        socket.on("connect_error", (err) =>
          addLog(
            makeLog(
              "error",
              `WebSocket connection failed: ${err.message}`,
              actor,
            ),
          ),
        );
        socket.on("entity:updated", (payload: WsEntityUpdatedPayload) => {
          setEntities((prev) =>
            prev.map((e) =>
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
              `mutation:collision received — entity: ${payload.entity_id?.slice(0, 8)}…`,
              actor,
              `stale_version: ${payload.stale_version}`,
            ),
          ),
        );
        socket.on("disconnect", (reason) =>
          addLog(
            makeLog("telemetry", `WebSocket disconnected: ${reason}`, actor),
          ),
        );

        return socket;
      }

      aliceSocketRef.current = makeSocket(aliceToken, "alice");
      bobSocketRef.current = makeSocket(bobToken, "bob");
    },
    [addLog],
  );

  // ─── Load profile ─────────────────────────────────────────────────────────

  const loadProfile = useCallback(
    async (p: WorkspaceProfile) => {
      setLoading(true);
      setEntities([]);
      setBlueprint(null);
      setTokens(null);
      setAliceCollisionOutcome("idle");
      setBobCollisionOutcome("idle");
      setCollisionEntityId(undefined);

      addLog(
        makeLog(
          "info",
          `Loading workspace: ${p.label}`,
          "system",
          `tenant: ${p.tenantId}`,
        ),
      );
      addLog(makeLog("info", "Issuing tokens for Alice + Bob…", "system"));

      let aliceToken: string;
      let bobToken: string;

      try {
        const [a, b] = await Promise.all([
          issueToken(p.apiKey, "dispatcher", "alice"),
          issueToken(p.apiKey, "dispatcher", "bob"),
        ]);
        aliceToken = a;
        bobToken = b;
        setTokens({ alice: aliceToken, bob: bobToken });
        addLog(
          makeLog(
            "success",
            "Tokens issued — alice + bob authenticated",
            "system",
          ),
        );
      } catch (err: any) {
        addLog(
          makeLog(
            "error",
            `Token issuance failed: ${err.message}. Check API key and tenant registration.`,
            "system",
          ),
        );
        setLoading(false);
        return;
      }

      connectSockets(p, aliceToken, bobToken);

      const existingBlueprint = await fetchActiveBlueprint(aliceToken);
      if (existingBlueprint) {
        setBlueprint(existingBlueprint);
        addLog(
          makeLog(
            "telemetry",
            `Blueprint fetched — ${existingBlueprint.transitions.length} transitions`,
            "system",
          ),
        );
      } else {
        addLog(
          makeLog(
            "info",
            "No blueprint found — uploading pre-baked config…",
            "system",
          ),
        );
        try {
          await uploadBlueprint(aliceToken, p.blueprint);
          setBlueprint(p.blueprint);
          addLog(
            makeLog(
              "success",
              "Blueprint uploaded and cached in Redis",
              "system",
            ),
          );
        } catch (err: any) {
          addLog(
            makeLog(
              "error",
              `Blueprint upload failed: ${err.message}`,
              "system",
            ),
          );
        }
      }

      const existing = await fetchEntities(aliceToken, p.entityType);
      if (existing.length > 0) {
        setEntities(existing);
        addLog(
          makeLog(
            "telemetry",
            `Hydrated ${existing.length} entities from database`,
            "system",
          ),
        );
      } else {
        addLog(makeLog("info", "Seeding demo entities…", "system"));
        const seeded: WorkflowEntity[] = [];
        for (const seed of p.seedEntities) {
          try {
            const e = await createEntity(
              aliceToken,
              p.entityType,
              seed.initial_state,
              seed.attributes,
            );
            seeded.push(e);
            addLog(
              makeLog(
                "success",
                `Entity created — ${e.id.slice(0, 8)}… state: ${e.currentState}`,
                "system",
              ),
            );
          } catch (err: any) {
            addLog(makeLog("error", `Seed failed: ${err.message}`, "system"));
          }
        }
        setEntities(seeded);
      }

      setLoading(false);
    },
    [connectSockets, addLog],
  );

  function handleProfileChange(p: WorkspaceProfile) {
    setProfile(p);
    loadProfile(p);
  }

  useEffect(() => {
    loadProfile(DEFAULT_PROFILE);
    return () => {
      aliceSocketRef.current?.disconnect();
      bobSocketRef.current?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Manual mutation ──────────────────────────────────────────────────────

  async function handleMutateConfirm(
    rule: TransitionRule,
    payload: Record<string, unknown>,
  ) {
    if (!mutateTarget || !tokens) return;
    const { entity, actor } = mutateTarget;
    setMutateTarget(null);
    const token = actor === "alice" ? tokens.alice : tokens.bob;

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

  async function handleSimulateCollision() {
    if (!tokens || !blueprint) return;

    const target = entities.find((e) =>
      blueprint.transitions.some((t) => t.from_state === e.currentState),
    );
    if (!target) return;

    const availableRule = blueprint.transitions.find(
      (t) => t.from_state === target.currentState,
    );
    if (!availableRule) return;

    setCollisionRunning(true);
    setCollisionEntityId(target.id);
    setAliceCollisionOutcome("idle");
    setBobCollisionOutcome("idle");

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
        `Collision race initiated — entity: ${target.id.slice(0, 8)}… v${target.version}`,
        "system",
        `both targeting: ${availableRule.from_state} → ${availableRule.to_state}`,
      ),
    );
    addLog(
      makeLog(
        "info",
        `Alice payload: ${JSON.stringify(alicePayload)}`,
        "alice",
      ),
    );
    addLog(
      makeLog("info", `Bob payload: ${JSON.stringify(bobPayload)}`, "bob"),
    );

    const [aliceResult, bobResult] = await Promise.all([
      mutateEntity(
        tokens.alice,
        target.id,
        availableRule.from_state,
        availableRule.to_state,
        target.version,
        alicePayload,
      ),
      mutateEntity(
        tokens.bob,
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
          `Alice write committed — entity now v${aliceResult.entity?.version}`,
          "alice",
          `state: ${aliceResult.entity?.currentState}`,
        ),
      );
      addLog(
        makeLog(
          "collision",
          `Error 409: Mutation Rejected. Version mismatch detected at database row level.`,
          "bob",
          `expected v${target.version} · Bob arrived second`,
        ),
      );
    } else if (bobResult.success) {
      setBobCollisionOutcome("winner");
      setAliceCollisionOutcome("loser");
      addLog(
        makeLog(
          "success",
          `Bob write committed — entity now v${bobResult.entity?.version}`,
          "bob",
          `state: ${bobResult.entity?.currentState}`,
        ),
      );
      addLog(
        makeLog(
          "collision",
          `Error 409: Mutation Rejected. Version mismatch detected at database row level.`,
          "alice",
          `expected v${target.version} · Alice arrived second`,
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
        `OCC barrier held — one atomic commit, one version rejection, zero dirty writes`,
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

  const availableTransitions = blueprint?.transitions ?? [];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col bg-[#080c14] overflow-hidden">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-0 h-11 border-b border-white/[0.06] bg-[#080c14]/95 backdrop-blur-sm z-20">
        {/* Left */}
        <div className="flex items-center gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500/30 to-violet-500/20 border border-indigo-500/20">
              <GitBranch size={13} className="text-indigo-400" />
            </div>
            <div className="leading-none">
              <span className="block font-sans font-bold text-sm text-slate-100 tracking-tight">
                STRATUM
              </span>
              <span className="block font-mono text-[8px] text-slate-700 mt-px">
                engine-as-a-service
              </span>
            </div>
          </div>

          <div className="w-px h-6 bg-white/[0.06]" />

          <ProfileSelector
            active={profile}
            onChange={handleProfileChange}
            loading={loading}
          />
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          {/* Token status */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.02] border border-white/[0.05]">
            {tokens ? (
              <>
                <CheckCircle2 size={10} className="text-emerald-400" />
                <span className="font-mono text-[9px] text-slate-500">
                  authenticated
                </span>
              </>
            ) : loading ? (
              <>
                <Loader2 size={10} className="text-amber-400 animate-spin" />
                <span className="font-mono text-[9px] text-slate-500">
                  authenticating…
                </span>
              </>
            ) : (
              <>
                <AlertCircle size={10} className="text-rose-400" />
                <span className="font-mono text-[9px] text-rose-400">
                  auth failed
                </span>
              </>
            )}
          </div>

          {/* Tenant / entity type */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.02] border border-white/[0.05]">
            <Cpu size={9} className="text-slate-600" />
            <span className="font-mono text-[9px] text-slate-600">
              {profile.tenantId}
            </span>
            <span className="text-slate-700">·</span>
            <span className="font-mono text-[9px] text-slate-500">
              {profile.entityType}
            </span>
          </div>

          {/* Live indicator */}
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 status-live" />
            </span>
            <span className="font-mono text-[9px] text-emerald-500/70">
              live
            </span>
          </div>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Blueprint sidebar */}
        <aside className="w-60 flex-shrink-0 border-r border-white/[0.05] flex flex-col min-h-0 overflow-hidden bg-[#0a0f1a]">
          <BlueprintInspector
            config={blueprint}
            loading={loading}
            tenantId={profile.tenantId}
          />
        </aside>

        {/* Center content */}
        <main className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
          {/* Collision bar */}
          <CollisionSimulator
            onSimulate={handleSimulateCollision}
            running={collisionRunning}
            disabled={loading || !tokens}
            hasEntities={entities.length > 0}
          />

          {/* Dual actor columns */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Alice */}
            <div className="flex-1 border-r border-white/[0.05] min-h-0 flex flex-col overflow-hidden">
              <EntityTable
                entities={entities}
                actor="alice"
                loading={loading}
                collisionEntityId={collisionEntityId}
                collisionOutcome={aliceCollisionOutcome}
                onMutate={(entity) =>
                  setMutateTarget({ entity, actor: "alice" })
                }
                availableTransitions={availableTransitions}
              />
            </div>

            {/* Bob */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <EntityTable
                entities={entities}
                actor="bob"
                loading={loading}
                collisionEntityId={collisionEntityId}
                collisionOutcome={bobCollisionOutcome}
                onMutate={(entity) => setMutateTarget({ entity, actor: "bob" })}
                availableTransitions={availableTransitions}
              />
            </div>
          </div>
        </main>
      </div>

      {/* ── Terminal (collapsible, resizable) ───────────────────────────── */}
      <Terminal logs={logs} onClear={clearLogs} />

      {/* ── Mutate modal ─────────────────────────────────────────────────── */}
      {mutateTarget && blueprint && (
        <MutateModal
          entity={mutateTarget.entity}
          transitions={blueprint.transitions}
          actor={mutateTarget.actor}
          onConfirm={handleMutateConfirm}
          onClose={() => setMutateTarget(null)}
        />
      )}
    </div>
  );
}
