// ─── Profiles ─────────────────────────────────────────────────────────────────

export interface ActorDefinition {
  id: string;
  role: string;
  label: string;
}

export interface WorkspaceProfile {
  id: string;
  label: string;
  tenantId: string;
  entityType: string;
  industry: string;
  apiKey: string;
  alice: ActorDefinition;
  bob: ActorDefinition;
  blueprint: BlueprintConfig;
  seedEntities: SeedEntity[];
}

// ─── Blueprint ────────────────────────────────────────────────────────────────

export interface FieldSchema {
  type: "string" | "number" | "boolean" | "object" | "array";
  required?: boolean;
}

export interface TransitionRule {
  from_state: string;
  to_state: string;
  allowed_roles: string[];
  payload_schema: Record<string, FieldSchema>;
}

export interface BlueprintConfig {
  entity_types: string[];
  transitions: TransitionRule[];
}

// ─── Entity ───────────────────────────────────────────────────────────────────

export interface WorkflowEntity {
  id: string;
  tenantId: string;
  entityType: string;
  currentState: string;
  version: number;
  attributes: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SeedEntity {
  label: string;
  initial_state: string;
  attributes: Record<string, unknown>;
}

// ─── Runtime tokens ───────────────────────────────────────────────────────────

export interface ProfileTokens {
  alice: string;
  bob: string;
}

// ─── WebSocket events ─────────────────────────────────────────────────────────

export interface WsEntityUpdatedPayload {
  entity_id: string;
  tenant_id: string;
  entity_type: string;
  old_state: string;
  new_state: string;
  version: number;
  attributes: Record<string, unknown>;
  actor_id: string;
  actor_role: string;
  timestamp: string;
}

export interface WsMutationCollisionPayload {
  entity_id: string;
  stale_version: number;
  message: string;
}

// ─── Terminal log ─────────────────────────────────────────────────────────────

export type LogLevel = "info" | "success" | "collision" | "telemetry" | "error";

export interface LogEntry {
  id: string;
  ts: number;
  level: LogLevel;
  actor?: "alice" | "bob" | "system";
  message: string;
  detail?: string;
}

// ─── Collision result ─────────────────────────────────────────────────────────

export type CollisionOutcome = "winner" | "loser" | "idle";
