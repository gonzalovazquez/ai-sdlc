# SDLC AI

AI-native software development lifecycle powered by 8 specialist agents orchestrated with [LangGraph](https://langchain-ai.github.io/langgraph/).

Each project flows through a full SDLC pipeline — from requirements gathering to monitoring — with a human-in-the-loop review gate before code generation.

```
User Input → PM → Architect → Design + Infra (parallel) → Human Review → Code → QA → Release → Monitor
```

## Architecture

| Agent | Model | Responsibility |
|-------|-------|----------------|
| **PM** | Sonnet | Extracts project config, requirements, and platform from user input |
| **Architect** | Opus | Makes architecture decisions (UI patterns, data layer, packages) |
| **Design** | Sonnet | Generates UI/UX design assets and screen inventory |
| **Infra** | Sonnet | Generates IaC (Pulumi) and CI/CD configuration |
| **Human Review** | — | Interrupts the pipeline for manual approval |
| **Code** | Opus | Generates implementation code and opens PRs |
| **QA** | Sonnet | Runs validation; loops back to Code on failure |
| **Release** | Sonnet | Handles deployment, versioning, and release notes |
| **Monitor** | Sonnet | Sets up health checks, dashboards, and alerts |

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · LangGraph · PostgreSQL (checkpointing) · SSE streaming

## Prerequisites

- **Node.js** 20+
- **npm** 10+
- **Docker & Docker Compose** (optional, for PostgreSQL and containerized deployment)

## Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.local.example .env.local
```

### Required

| Variable | Description | How to get it |
|----------|-------------|---------------|
| `ANTHROPIC_API_KEY` | Claude API key | [console.anthropic.com](https://console.anthropic.com/) → API Keys |

### Recommended

| Variable | Description | How to get it |
|----------|-------------|---------------|
| `DATABASE_URL` | PostgreSQL connection string for state checkpointing. Without it, state is stored in-memory and lost on restart. | Run `docker compose up postgres` or use any Postgres instance |

### Optional — GitHub Integration

Used by the Code and Release agents to create branches and PRs.

| Variable | Description | How to get it |
|----------|-------------|---------------|
| `GITHUB_TOKEN` | Personal access token with `repo` scope | [github.com/settings/tokens](https://github.com/settings/tokens) |
| `GITHUB_OWNER` | Repository owner (user or org) | Your GitHub username or org name |
| `GITHUB_REPO` | Repository name | The repo where code will be pushed |

### Optional — MCP Server Auth Tokens

Each token enables a corresponding MCP server integration. Agents gracefully skip servers whose tokens are not configured — you only need the ones you want to use.

| Variable | Used by | How to get it |
|----------|---------|---------------|
| `LINEAR_API_KEY` | PM, Monitor | [linear.app/settings/api](https://linear.app/settings/api) |
| `NOTION_API_KEY` | Architect, PM | [notion.so/my-integrations](https://www.notion.so/my-integrations) |
| `PULUMI_ACCESS_TOKEN` | Infra | [app.pulumi.com/account/tokens](https://app.pulumi.com/account/tokens) |
| `GOOGLE_STITCH_API_KEY` | Design | See [Google Stitch setup](#google-stitch-setup) below |
| `SUPABASE_ACCESS_TOKEN` | Infra, Code | [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) |

### Optional — MCP Server URL Overrides

These have sensible defaults. Only set them if you need custom endpoints.

| Variable | Default |
|----------|---------|
| `MCP_STITCH_URL` | `https://stitch.googleapis.com/mcp` |
| `MCP_LINEAR_URL` | `https://mcp.linear.app/mcp` |
| `MCP_PULUMI_URL` | `https://mcp.pulumi.com` |
| `MCP_NOTION_URL` | `https://mcp.notion.com/mcp` |
| `MCP_SUPABASE_URL` | `https://mcp.supabase.com/mcp` |

### Google Stitch Setup

Google Stitch supports two authentication methods:

#### Option A: API Key (recommended)

1. Go to [Stitch Settings](https://stitch.withgoogle.com) and generate an API key
2. Add it to your `.env`:

   ```bash
   GOOGLE_STITCH_API_KEY="your-api-key"
   ```

The key is sent via the `X-Goog-Api-Key` header — no expiration, no refresh needed.

#### Option B: OAuth (for zero-trust environments)

Use this if your organization restricts storing persistent secrets on disk.

1. Install the [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)
2. Authenticate:

   ```bash
   gcloud auth login
   gcloud auth application-default login
   ```

3. Generate a token and add it to your `.env`:

   ```bash
   GOOGLE_STITCH_API_KEY="$(gcloud auth print-access-token)"
   ```

> **Note:** OAuth tokens expire every hour and require manual renewal. For server-side use, the API key method is strongly preferred.

### Optional — Monitoring

| Variable | Description |
|----------|-------------|
| `SENTRY_DSN` | Sentry DSN for error tracking |
| `FIREBASE_PROJECT_ID` | Firebase project ID for the Monitor agent |

## Quick Start (Local)

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.local.example .env.local
# Edit .env.local and add your ANTHROPIC_API_KEY

# 3. (Optional) Start PostgreSQL for state persistence
docker compose up postgres -d

# 4. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click **Create Your First Project**.

## Quick Start (Docker Compose)

Runs both the app and PostgreSQL in containers:

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# 2. Build and start
docker compose up --build
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## Observability (OpenTelemetry)

Every graph node execution is wrapped in an OpenTelemetry span (`src/lib/telemetry.ts`),
so a full SDLC run renders as a single trace whose waterfall mirrors the graph — including
the parallel Design/Infra fork and the QA→Code retry loop. Pino log lines are tagged with
the active `trace_id`/`span_id` and shipped alongside the traces, so you can jump from any
span straight to the logs it produced.

Everything exports over OTLP to [grafana/otel-lgtm](https://github.com/grafana/docker-otel-lgtm)
(OTel Collector + Tempo + Loki + Grafana in one container):

```bash
docker compose up otel-lgtm -d
```

Then open Grafana at [http://localhost:3001](http://localhost:3001) (anonymous admin login)
and explore the **Tempo** (traces) and **Loki** (logs) data sources. In dev, the app exports
to `localhost:4318` automatically; under Docker Compose the app container is pointed at the
`otel-lgtm` service. If no backend is running, telemetry is a no-op.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |
| `npm run test:unit` | Run unit tests only |
| `npm run test:bdd` | Run BDD tests only |
| `npm run test:integration` | Run integration tests only |
| `npm run lint` | Run ESLint |

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/                # API routes (SSE streaming, approval, projects)
│   ├── components/         # React UI components
│   ├── hooks/              # Custom React hooks
│   ├── page.tsx            # Main chat interface
│   └── globals.css         # Global styles
└── lib/
    ├── agents/             # 8 specialist agent nodes + human review
    ├── graph/              # LangGraph state, graph builder, checkpointer
    ├── mcp/                # MCP server configuration
    ├── llm.ts              # Claude model initialization
    └── logger.ts           # Structured logging (pino)
```

## How It Works

1. **Create a project** — provide a name, platform (web/iOS/both), and description
2. **PM Agent** parses your input into structured requirements and project config
3. **Architect Agent** makes technology decisions (UI patterns, data layer, packages)
4. **Design + Infra Agents** run in parallel — generating UI assets and infrastructure config
5. **Human Review** — the pipeline pauses for your approval before generating code
6. **Code Agent** generates implementation files and optionally opens a GitHub PR
7. **QA Agent** validates the code; if it fails, it loops back to the Code Agent
8. **Release Agent** handles versioning and deployment
9. **Monitor Agent** sets up health checks and observability

All agent outputs stream in real-time via Server-Sent Events.
