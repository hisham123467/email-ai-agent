# Email AI Agent

A single control plane for email operations that can be controlled manually from a web dashboard and programmatically from ChatGPT through MCP.

## V1 included

- Manual dashboard
- Shared `agent-service` layer
- MCP endpoint at `/mcp`
- MCP tools: `get_agent_status`, `get_dashboard_stats`, `list_inbox`, `set_auto_reply`, `set_approval_required`, `draft_reply`, `send_reply`
- Safe send guard: email sending is blocked until Gmail OAuth is connected
- Responsive desktop/mobile UI

## Current development limitation

The V1 state is intentionally in memory. Supabase persistence and Gmail OAuth are the next integration step.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000` and connect an MCP inspector/client to `http://localhost:3000/mcp`.

## Prepared database schema

`supabase/schema.sql` contains the dedicated database design with RLS, explicit 2026 Data API grants, email threads/messages/drafts, AI rules, agent settings, and server-only Gmail token storage.
