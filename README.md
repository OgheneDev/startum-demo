# Stratum Showcase Dashboard

Interactive demo frontend for [Stratum](https://github.com/ogheneDev/stratum-backend), a multi-tenant workflow engine API. Built to demonstrate real-time state synchronization, optimistic concurrency control, and tenant isolation without any registration flow.

---

## What This Is

The dashboard is a single-page monitoring panel that connects directly to a live Stratum backend. It lets you observe the engine's core guarantees in action:

- Two independent operators mutating shared entities in real time
- A Redis pub/sub broadcast propagating state changes across both sessions within milliseconds
- A controlled collision race that proves the OCC write barrier works under concurrent load
- A live telemetry terminal logging every network event with millisecond precision

There is no mock layer. Every HTTP request and WebSocket event targets the real backend.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Real-time | Socket.IO client |

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx          # Main dashboard — full orchestration layer
│   ├── layout.tsx        # Root layout with font imports
│   └── globals.css       # Base styles + scrollbar + scanline overlay
├── components/
│   ├── dashboard/
│   │   ├── ProfileSelector.tsx   # Industry workspace switcher
│   │   ├── EntityTable.tsx       # Per-operator entity list with state badges
│   │   └── MutateModal.tsx       # Transition picker with payload field inputs
│   ├── inspector/
│   │   └── BlueprintInspector.tsx  # Live blueprint contract side panel
│   ├── collision/
│   │   └── CollisionSimulator.tsx  # Race condition trigger button
│   └── terminal/
│       └── Terminal.tsx          # Append-only telemetry log console
├── lib/
│   ├── profiles.ts       # Static industry workspace configurations
│   ├── api.ts            # All HTTP calls to the Stratum backend
│   └── logger.ts         # Log entry factory + timestamp formatter
└── types/
    └── index.ts          # Shared TypeScript types
```

---

## Prerequisites

- Node.js 20+
- A running instance of the [Stratum backend](https://github.com/ogheneDev/stratum-backend)
- Three registered tenants on that backend (one per industry profile)

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/ogheneDev/stratum-dashboard.git
cd stratum-dashboard
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=http://localhost:4000
```

For production point these at your deployed Stratum backend URL.

### 3. Register the three tenants

The dashboard needs a real API key per profile. Using Bruno (or any HTTP client), call the Stratum backend once for each:

```
POST /tenants/register   { "name": "Swift Cargo" }     → save api_key
POST /tenants/register   { "name": "Sky Route" }       → save api_key
POST /tenants/register   { "name": "Metro Health" }    → save api_key
```

### 4. Paste the API keys into profiles

Open `src/lib/profiles.ts` and replace the placeholder for each profile:

```typescript
// Logistics & Fleet
apiKey: "eaas_abc123...",   // paste Swift Cargo api_key here

// Aviation Operations
apiKey: "eaas_def456...",   // paste Sky Route api_key here

// Emergency Medicine
apiKey: "eaas_ghi789...",   // paste Metro Health api_key here
```

The dashboard calls `POST /tenants/token` at runtime to issue fresh JWTs for Alice and Bob on every profile load. Nothing is hardcoded beyond the API key.

### 5. Start the dashboard

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## How It Works

### Profile boot sequence

Selecting a workspace triggers a coordinated boot sequence:

1. Issues fresh JWT tokens for Alice (dispatcher) and Bob (dispatcher) simultaneously via `Promise.all`
2. Tears down existing WebSocket connections and opens two new authenticated ones
3. Fetches the active blueprint from the backend — uploads the pre-baked config if none exists
4. Fetches existing entities for this tenant — seeds demo data if the database is empty

All steps are logged in real time to the telemetry terminal at the bottom of the screen.

### Dual operator columns

Alice and Bob each hold an independent WebSocket connection authenticated to the same tenant stream. Both columns render the same entity list. When either operator mutates an entity, the backend commits the change and publishes to a Redis channel. Both WebSocket connections receive the broadcast and update simultaneously — no polling, no manual refresh.

### Collision simulation

Clicking **simulate microsecond collision race** does the following:

1. Re-fetches the latest entity versions from the database
2. Finds an entity in a state the `dispatcher` role can transition
3. Fires two conflicting mutations via `Promise.all` — Alice and Bob both target the same entity at the same version number with different payloads
4. One write lands first and commits. The other hits the OCC version guard and receives a `409 MUTATION_COLLISION`
5. The winning column gets a green **committed** badge. The losing column gets a red **rejected** badge and logs the exact error

### Telemetry terminal

Every network event is classified and color-coded:

| Color | Level | Meaning |
|---|---|---|
| Blue | INFO | Connection handshakes, token issuance, profile loads |
| Green | COMMIT | Successful DB mutations with version numbers |
| Crimson | COLLISION | 409 rejections with expected vs received version detail |
| Neutral | TELEMETRY | Redis pub/sub propagation, audit worker dispatches |
| Red | ERROR | Failed requests, connection errors |

The terminal is append-only and capped at 500 lines. It auto-scrolls to the latest event.

---

## Industry Profiles

Three pre-baked workspace configurations ship with the dashboard. Each has a complete blueprint contract, realistic seed entities, and domain-appropriate state machines.

**Logistics & Fleet** (`swiftcargo-99`)
Tracks dispatch orders through: `pending → assigned → in_transit → delivered`

**Aviation Operations** (`skyroute-77`)
Tracks flight turnarounds through: `landed → deboarding → cleaning → fueling → boarding → departed`

**Emergency Medicine** (`metrohealth-55`)
Tracks ER triage cases through: `waiting → triage → assessment → treatment → discharged`

Switching profiles tears down all active connections and boots a fresh session for the new tenant. Entities seeded under one profile are never visible from another — tenant isolation is enforced at the database query level on the backend.

---

## Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm start        # Start production server
```

---

## Related

- [Stratum Backend](https://github.com/ogheneDev/stratum-backend) — the engine this dashboard connects to
- [Stratum README](https://github.com/ogheneDev/stratum-backend#readme) — full API reference, architecture notes, and setup guide
