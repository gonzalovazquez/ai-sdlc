# =============================================================================
# SDLC AI — Multi-stage Docker build
# Based on Next.js standalone output for minimal image size.
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Install dependencies
# ---------------------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# ---------------------------------------------------------------------------
# Stage 2: Build the application
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects anonymous telemetry — disable in CI/Docker
ENV NEXT_TELEMETRY_DISABLED=1

# Build requires these at build time (can be dummies for static pages)
ENV ANTHROPIC_API_KEY=build-placeholder

RUN npm run build

# ---------------------------------------------------------------------------
# Stage 3: Production image
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Set ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# ---------------------------------------------------------------------------
# Runtime environment variables (injected at container start)
# ---------------------------------------------------------------------------
# Required:
#   ANTHROPIC_API_KEY    — Claude API key
#
# Recommended:
#   DATABASE_URL         — PostgreSQL connection string for checkpointing
#
# Optional:
#   GITHUB_TOKEN         — GitHub PAT for Code + Release agents
#   GITHUB_OWNER         — GitHub repo owner
#   GITHUB_REPO          — GitHub repo name
#   LINEAR_API_KEY       — Linear API key for PM + Monitor agents
#   MCP_STITCH_URL       — Google Stitch MCP server URL
#   MCP_LINEAR_URL       — Linear MCP server URL
#   MCP_PULUMI_URL       — Pulumi Neo MCP server URL
#   MCP_NOTION_URL       — Notion MCP server URL
#   MCP_SUPABASE_URL     — Supabase MCP server URL
#   SENTRY_DSN           — Sentry DSN for error tracking
#   FIREBASE_PROJECT_ID  — Firebase project ID for monitor agent
# ---------------------------------------------------------------------------

CMD ["node", "server.js"]
