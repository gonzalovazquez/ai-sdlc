#!/bin/sh
# Runs Notion's official MCP server locally over Streamable HTTP.
#
# The hosted server (mcp.notion.com) only accepts OAuth tokens, not integration
# API keys, so we run this local server instead. It authenticates to Notion with
# NOTION_API_KEY and requires the same value as the Bearer token from clients,
# matching what the app already sends. Point MCP_NOTION_URL at it:
#   MCP_NOTION_URL=http://localhost:3010/mcp
set -e

cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

if [ -z "$NOTION_API_KEY" ]; then
  echo "NOTION_API_KEY is not set (expected in .env)" >&2
  exit 1
fi

PORT="${NOTION_MCP_PORT:-3010}"

NOTION_TOKEN="$NOTION_API_KEY" exec npx notion-mcp-server \
  --transport http \
  --port "$PORT" \
  --auth-token "$NOTION_API_KEY"
