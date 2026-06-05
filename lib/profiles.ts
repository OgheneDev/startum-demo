import type { WorkspaceProfile } from "@/types";

export const PROFILES: WorkspaceProfile[] = [
  // ── Aviation Operations ────────────────────────────────────────────────────
  // Alice: dispatcher — handles ground ops assignments
  // Bob: dispatcher — both dispatchers makes sense for aviation coordination
  {
    id: "aviation",
    label: "Aviation Operations",
    tenantId: "skyroute-77",
    entityType: "flight_turnaround",
    industry: "Aviation",
    apiKey: "strat_55d3d32e454f42f598b6b4ef4f18c4ff",
    alice: { id: "alice", role: "dispatcher", label: "Alice / dispatcher" },
    bob: { id: "bob", role: "dispatcher", label: "Bob / dispatcher" },
    blueprint: {
      entity_types: ["flight_turnaround"],
      transitions: [
        {
          from_state: "landed",
          to_state: "deboarding",
          allowed_roles: ["dispatcher", "admin"],
          payload_schema: {
            gate: { type: "string", required: true },
            ground_crew_id: { type: "string", required: true },
          },
        },
        {
          from_state: "deboarding",
          to_state: "cleaning",
          allowed_roles: ["dispatcher"],
          payload_schema: {
            crew_team: { type: "string", required: true },
          },
        },
        {
          from_state: "cleaning",
          to_state: "fueling",
          allowed_roles: ["dispatcher"],
          payload_schema: {
            fuel_volume_kg: { type: "number", required: true },
          },
        },
        {
          from_state: "fueling",
          to_state: "boarding",
          allowed_roles: ["dispatcher", "admin"],
          payload_schema: {
            boarding_agent: { type: "string", required: true },
          },
        },
        {
          from_state: "boarding",
          to_state: "departed",
          allowed_roles: ["dispatcher", "admin"],
          payload_schema: {
            pushback_time: { type: "string", required: true },
          },
        },
      ],
    },
    seedEntities: [
      {
        label: "Flight SK-201 LOS→ABV",
        initial_state: "landed",
        attributes: {
          flight_number: "SK-201",
          route: "LOS→ABV",
          aircraft: "B737-800",
        },
      },
      {
        label: "Flight SK-305 ABV→KAN",
        initial_state: "deboarding",
        attributes: {
          flight_number: "SK-305",
          route: "ABV→KAN",
          aircraft: "A320",
        },
      },
      {
        label: "Flight SK-118 PHC→LOS",
        initial_state: "cleaning",
        attributes: {
          flight_number: "SK-118",
          route: "PHC→LOS",
          aircraft: "B737-700",
        },
      },
    ],
  },

  // ── Logistics and Fleet ────────────────────────────────────────────────────
  // Alice: dispatcher — assigns drivers, manages fleet
  // Bob: driver — executes deliveries
  {
    id: "logistics",
    label: "Logistics & Fleet",
    tenantId: "swiftcargo-99",
    entityType: "dispatch_order",
    industry: "Logistics",
    apiKey: "strat_4bdfde9e6b5f44a3ae82c79c8498b140",
    alice: { id: "alice", role: "dispatcher", label: "Alice / dispatcher" },
    bob: { id: "bob", role: "driver", label: "Bob / driver" },
    blueprint: {
      entity_types: ["dispatch_order"],
      transitions: [
        {
          from_state: "pending",
          to_state: "assigned",
          allowed_roles: ["dispatcher", "admin"],
          payload_schema: {
            driver_id: { type: "string", required: true },
            vehicle_id: { type: "string", required: true },
          },
        },
        {
          from_state: "assigned",
          to_state: "in_transit",
          allowed_roles: ["driver", "dispatcher"],
          payload_schema: {
            departed_at: { type: "string", required: true },
            estimated_km: { type: "number", required: false },
          },
        },
        {
          from_state: "in_transit",
          to_state: "delivered",
          allowed_roles: ["driver"],
          payload_schema: {
            recipient_name: { type: "string", required: true },
            delivery_photo_url: { type: "string", required: false },
          },
        },
        {
          from_state: "pending",
          to_state: "cancelled",
          allowed_roles: ["admin", "dispatcher"],
          payload_schema: {
            reason: { type: "string", required: true },
          },
        },
      ],
    },
    seedEntities: [
      {
        label: "Order #SC-8841 Lagos→Port Harcourt",
        initial_state: "pending",
        attributes: {
          order_ref: "SC-8841",
          origin: "Lagos",
          destination: "Port Harcourt",
          weight_kg: 340,
        },
      },
      {
        label: "Order #SC-8842 Abuja→Kano",
        initial_state: "pending",
        attributes: {
          order_ref: "SC-8842",
          origin: "Abuja",
          destination: "Kano",
          weight_kg: 120,
        },
      },
      {
        label: "Order #SC-8839 Ibadan→Lagos",
        initial_state: "assigned",
        attributes: {
          order_ref: "SC-8839",
          origin: "Ibadan",
          destination: "Lagos",
          weight_kg: 85,
        },
      },
    ],
  },

  // ── Emergency Medicine ─────────────────────────────────────────────────────
  // Alice: nurse — performs triage
  // Bob: doctor — assessment, treatment, discharge
  {
    id: "healthcare",
    label: "Emergency Medicine",
    tenantId: "metrohealth-55",
    entityType: "er_triage",
    industry: "Healthcare",
    apiKey: "strat_5d91aad6a4754f2791df8a891d5c8ecd",
    alice: { id: "alice", role: "nurse", label: "Alice / nurse" },
    bob: { id: "bob", role: "doctor", label: "Bob / doctor" },
    blueprint: {
      entity_types: ["er_triage"],
      transitions: [
        {
          from_state: "waiting",
          to_state: "triage",
          allowed_roles: ["nurse"],
          payload_schema: {
            nurse_id: { type: "string", required: true },
            chief_complaint: { type: "string", required: true },
          },
        },
        {
          from_state: "triage",
          to_state: "assessment",
          allowed_roles: ["doctor"],
          payload_schema: {
            doctor_id: { type: "string", required: true },
            acuity_level: { type: "number", required: true },
          },
        },
        {
          from_state: "assessment",
          to_state: "treatment",
          allowed_roles: ["doctor"],
          payload_schema: {
            diagnosis_code: { type: "string", required: true },
            treatment_plan: { type: "string", required: true },
          },
        },
        {
          from_state: "treatment",
          to_state: "discharged",
          allowed_roles: ["doctor"],
          payload_schema: {
            discharge_notes: { type: "string", required: true },
          },
        },
      ],
    },
    seedEntities: [
      {
        label: "Patient MH-4421",
        initial_state: "waiting",
        attributes: {
          patient_ref: "MH-4421",
          priority: "high",
          arrival: new Date().toISOString(),
        },
      },
      {
        label: "Patient MH-4420",
        initial_state: "triage",
        attributes: {
          patient_ref: "MH-4420",
          priority: "medium",
          arrival: new Date(Date.now() - 900000).toISOString(),
        },
      },
      {
        label: "Patient MH-4419",
        initial_state: "assessment",
        attributes: {
          patient_ref: "MH-4419",
          priority: "low",
          arrival: new Date(Date.now() - 3600000).toISOString(),
        },
      },
    ],
  },
];

export const DEFAULT_PROFILE = PROFILES[1]; // Logistics as default
