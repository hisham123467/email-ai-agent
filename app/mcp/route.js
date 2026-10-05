import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import {
  createReplyDraft,
  getAgentStatus,
  getDashboard,
  listInbox,
  sendReply,
  setApprovalRequired,
  setAutoReply
} from '../../lib/agent-service';

const textResult = (value) => ({
  content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
  structuredContent: value
});

const handler = createMcpHandler((server) => {
  server.registerTool(
    'get_agent_status',
    {
      title: 'Get Email AI Agent status',
      description: 'Check Gmail connection, auto-reply mode, approval requirement, and MCP readiness.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async () => textResult(getAgentStatus())
  );

  server.registerTool(
    'get_dashboard_stats',
    {
      title: 'Get email dashboard stats',
      description: 'Return inbox, needs-reply, waiting, and auto-replied counts.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async () => textResult(getDashboard().stats)
  );

  server.registerTool(
    'list_inbox',
    {
      title: 'List inbox messages',
      description: 'List recent email messages known to Email AI Agent.',
      inputSchema: z.object({
        limit: z.number().int().min(1).max(50).optional(),
        status: z.enum(['needs_reply', 'waiting']).optional()
      }),
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async (args) => textResult(listInbox(args))
  );

  server.registerTool(
    'set_auto_reply',
    {
      title: 'Set auto reply',
      description: 'Turn the Email AI Agent automatic reply setting on or off.',
      inputSchema: z.object({ enabled: z.boolean() }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ enabled }) => textResult({ ok: true, status: setAutoReply(enabled) })
  );

  server.registerTool(
    'set_approval_required',
    {
      title: 'Set send approval requirement',
      description: 'Require or remove manual approval before sending replies.',
      inputSchema: z.object({ enabled: z.boolean() }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ enabled }) => textResult({ ok: true, status: setApprovalRequired(enabled) })
  );

  server.registerTool(
    'draft_reply',
    {
      title: 'Draft email reply',
      description: 'Prepare a reply draft for a known inbox message without sending it.',
      inputSchema: z.object({
        messageId: z.string().min(1),
        instruction: z.string().max(1000).optional()
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }
    },
    async (args) => textResult(createReplyDraft(args))
  );

  server.registerTool(
    'send_reply',
    {
      title: 'Send email reply',
      description: 'Send a reply to a known inbox message. This stays blocked until Gmail OAuth is connected and approval rules allow sending.',
      inputSchema: z.object({
        messageId: z.string().min(1),
        body: z.string().min(1).max(20000)
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true }
    },
    async (args) => textResult(sendReply(args))
  );
});

export { handler as GET, handler as POST };
